<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking;

use App\Modules\Booking\Contracts\BookingRepositoryInterface;
use App\Modules\Booking\Requests\BuatBookingInput;
use App\Modules\Outlet\Contracts\OutletRepositoryInterface;
use App\Modules\Sesi\SesiStaf;
use App\Modules\WhatsApp\JenisPesan;
use App\Modules\WhatsApp\PesanWaService;
use App\Modules\WhatsApp\Templat;
use App\Support\Config\Settings;
use App\Support\Http\ApiError;
use App\Support\Http\Page;
use App\Support\Security\SecretToken;
use App\Support\Security\Uuid;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use App\Support\Validation\FieldCode;
use LogicException;

/**
 * Aturan booking: dibuat pelanggan dari website tanpa akun, lalu diterima
 * atau ditolak staf. Menjadikan booking SPK ada di modul Servis.
 *
 * Form publik bisa diisi siapa saja, jadi pengamannya berlapis: booking
 * selalu mulai PENDING dan harus diterima staf, paling banyak 3 booking
 * menunggu per nomor HP, dan tidak ada pesan WhatsApp yang dikirim dari form
 * publik (nomornya bisa milik orang lain). Pesan pertama baru dikirim saat
 * staf mengonfirmasi atau menolak.
 */
final class BookingService
{
    /** Batas booking PENDING per nomor HP, untuk menahan banjir booking palsu dari form publik. */
    public const MAKS_MENUNGGU = 3;

    public function __construct(
        private readonly BookingRepositoryInterface $repo,
        private readonly BookingDetail $detail,
        private readonly OutletRepositoryInterface $outlet,
        private readonly PesanWaService $wa,
        private readonly Settings $settings,
        private readonly Clock $clock,
    ) {}

    /**
     * Rujukan serviceId di form booking: tidak ada, atau ada tetapi tidak
     * tampil di website → unknown_reference (jasa nonpublik diperlakukan
     * seperti tidak ada, karena dari sisi pelanggan jasa itu memang tidak
     * pernah tampil); publik tetapi nonaktif →
     * inactive_reference.
     *
     * @return array{0: string|null, 1: string} nama jasa saat ini (untuk disalin) dan kode galat ("" bila sah)
     */
    public function rujukanJasa(string $serviceId): array
    {
        $jasa = $this->repo->jasa($serviceId);
        if ($jasa === null || ! (bool) $jasa->is_public) {
            return [null, FieldCode::UNKNOWN_REFERENCE];
        }
        if (! (bool) $jasa->is_active) {
            return [null, FieldCode::INACTIVE_REFERENCE];
        }

        return [$jasa->name, ''];
    }

    /**
     * POST /api/public/bookings, sesudah validasi lolos. Satu transaksi yang
     * mengunci counters booking_number: kunci yang sama menjadi mutex batas
     * booking menunggu, jadi booking serentak dengan nomor HP yang sama tidak
     * pernah melampaui batas, dan nomor booking tidak terpakai bila ditolak.
     *
     * @return array{bookingToken: string, booking: array<string, mixed>} BookingDibuat
     */
    public function buat(BuatBookingInput $isian, ?string $serviceName): array
    {
        $plate = $isian->plate ?? throw new LogicException('plat harus sudah divalidasi');
        // Token dikirim sekali ke pemesan; database hanya menyimpan hash-nya.
        [$token, $hash] = SecretToken::new();
        $bookingId = Uuid::new();
        $now = Time::toDb($this->clock->now());

        $this->repo->transaction(function () use ($isian, $plate, $serviceName, $hash, $bookingId, $now): void {
            $nilai = $this->repo->kunciPenghitung();
            if ($this->repo->jumlahMenunggu($isian->phone) >= self::MAKS_MENUNGGU) {
                throw ApiError::conflict('too_many_pending_bookings');
            }
            $nilai++;
            $this->repo->simpanPenghitung($nilai);
            $this->repo->simpanBaru([
                'booking_id' => $bookingId,
                'number' => NomorBooking::dari($nilai),
                'customer_name' => $isian->customerName,
                'customer_phone' => $isian->phone,
                'vehicle_type' => $isian->vehicleType,
                'plate_display' => $plate->display,
                'plate_key' => $plate->key,
                'vehicle_brand' => $isian->vehicleBrand,
                'vehicle_model' => $isian->vehicleModel,
                'service_id' => $isian->serviceId,
                // CHECK bookings_nama_jasa_sesuai: nama jasa ada tepat saat jasa dipilih.
                'service_name' => $isian->serviceId === null ? null : $serviceName,
                'visit_date' => $isian->visitDate,
                'complaint' => $isian->complaint,
                'status' => StatusBooking::Menunggu->value,
                'reject_reason' => null,
                'booking_token_hash' => $hash,
                'work_order_id' => null,
                'handled_by_staff_id' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });

        $row = $this->repo->baca($bookingId) ?? throw new LogicException('booking yang baru disimpan tidak terbaca');

        return ['bookingToken' => $token, 'booking' => BookingDetail::publik($row)];
    }

    /** GET /api/public/bookings/{bookingToken} */
    public function lihatPublik(string $token): array
    {
        $hash = self::hashToken($token);
        $row = $this->repo->bacaDenganHash($hash) ?? throw self::tidakAda();

        return BookingDetail::publik($row);
    }

    /**
     * POST /api/public/bookings/{bookingToken}/cancel. Hanya dari PENDING;
     * baris booking dikunci, jadi pembatalan yang serentak dengan konfirmasi
     * atau konversi staf menghasilkan tepat satu pemenang. Staf penangan
     * tetap kosong (CHECK bookings_penangan_sesuai) dan tidak ada pesan.
     */
    public function batalkanPublik(string $token): array
    {
        $hash = self::hashToken($token);
        $now = Time::toDb($this->clock->now());
        $this->repo->transaction(function () use ($hash, $now): void {
            $booking = $this->repo->kunciDenganHash($hash) ?? throw self::tidakAda();
            StatusBooking::from($booking->status)->pastikanBolehKe(StatusBooking::Dibatalkan);
            $this->repo->ubah($booking->booking_id, ['status' => StatusBooking::Dibatalkan->value, 'updated_at' => $now]);
        });

        return BookingDetail::publik($this->repo->bacaDenganHash($hash) ?? throw self::tidakAda());
    }

    /**
     * GET /api/bookings
     *
     * @return array{0: list<array<string, mixed>>, 1: int}
     */
    public function daftar(FilterBooking $filter, Page $page): array
    {
        // Term dengan byte UTF-8 tidak sah tidak pernah cocok, dan tidak
        // boleh dikirim ke kolom utf8mb4.
        if (! $filter->search->isEmpty() && $filter->search->neverMatches()) {
            return [[], 0];
        }
        [$rows, $total] = $this->repo->daftar($filter, $page);

        return [$this->detail->banyak($rows), $total];
    }

    /** GET /api/bookings/{bookingId} */
    public function rincian(string $bookingId): array
    {
        if (! Uuid::valid($bookingId)) {
            throw self::tidakAda();
        }

        return $this->detail->ambil($bookingId) ?? throw self::tidakAda();
    }

    /**
     * 404 untuk rute yang menilai badan sesudah sumber di path (tolak): ID
     * berbentuk salah langsung 404 tanpa query.
     */
    public function pastikanAda(string $bookingId): void
    {
        if (! Uuid::valid($bookingId) || ! $this->repo->ada($bookingId)) {
            throw self::tidakAda();
        }
    }

    /**
     * POST /api/bookings/{bookingId}/confirm: PENDING → CONFIRMED. Pesan
     * booking_confirmed dikirim sesudah commit; gagal kirim hanya tercatat
     * di wa_messages, balasan tetap 200.
     */
    public function konfirmasi(SesiStaf $sesi, string $bookingId): array
    {
        if (! Uuid::valid($bookingId)) {
            throw self::tidakAda();
        }
        $booking = $this->ubahStatus($bookingId, StatusBooking::Dikonfirmasi, ['handled_by_staff_id' => $sesi->staffId]);

        $this->wa->kirimOtomatis(JenisPesan::BookingDikonfirmasi, $bookingId, fn (): array => [
            $booking->customer_phone,
            Templat::bookingDikonfirmasi($this->outlet->ambil(), $booking->number, $booking->plate_display,
                (string) $booking->visit_date, $booking->service_name),
        ]);

        return $this->detail->ambil($bookingId) ?? throw self::tidakAda();
    }

    /**
     * POST /api/bookings/{bookingId}/reject: PENDING atau CONFIRMED →
     * REJECTED dengan alasan yang sudah dipangkas (pemanggil sudah memastikan
     * booking ada dan alasannya sah). Alasan itu terlihat pelanggan, di
     * halaman booking dan di pesan booking_rejected.
     */
    public function tolak(SesiStaf $sesi, string $bookingId, string $reason): array
    {
        $booking = $this->ubahStatus($bookingId, StatusBooking::Ditolak, [
            'reject_reason' => $reason,
            'handled_by_staff_id' => $sesi->staffId,
        ]);

        $this->wa->kirimOtomatis(JenisPesan::BookingDitolak, $bookingId, fn (): array => [
            $booking->customer_phone,
            Templat::bookingDitolak($this->outlet->ambil(), $booking->number, $booking->plate_display,
                (string) $booking->visit_date, $reason, $this->settings->publicWebUrl),
        ]);

        return $this->detail->ambil($bookingId) ?? throw self::tidakAda();
    }

    /**
     * Perpindahan status oleh staf dalam satu transaksi yang mengunci baris
     * booking: dua staf yang bertindak bersamaan menghasilkan satu 200 dan
     * satu 409 booking_transition_invalid. Penyedia WhatsApp tidak dipanggil
     * di sini; pemanggil mengirim pesan sesudah fungsi ini kembali.
     *
     * @param  array<string, mixed>  $kolomLain
     * @return object baris yang dikunci (data salinan booking untuk pesan)
     */
    private function ubahStatus(string $bookingId, StatusBooking $tujuan, array $kolomLain): object
    {
        $now = Time::toDb($this->clock->now());

        return $this->repo->transaction(function () use ($bookingId, $tujuan, $kolomLain, $now): object {
            $booking = $this->repo->kunci($bookingId) ?? throw self::tidakAda();
            StatusBooking::from($booking->status)->pastikanBolehKe($tujuan);
            $this->repo->ubah($bookingId, ['status' => $tujuan->value, 'updated_at' => $now] + $kolomLain);

            return $booking;
        });
    }

    /**
     * Token berbentuk selain 43 karakter base64url langsung 404 tanpa
     * menyentuh database; yang berbentuk sah dicari lewat hash-nya.
     */
    private static function hashToken(string $token): string
    {
        if (! SecretToken::valid($token)) {
            throw self::tidakAda();
        }

        return SecretToken::hash($token);
    }

    private static function tidakAda(): ApiError
    {
        return ApiError::notFound('Booking tidak ditemukan');
    }
}
