<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking;

use App\Modules\Booking\Contracts\BookingRepositoryInterface;
use App\Modules\WhatsApp\JenisPesan;
use App\Modules\WhatsApp\PesanWaService;
use App\Support\Time\Time;
use App\Support\Validation\PhoneNumber;

/**
 * Menyusun dua bentuk balasan booking dari baris database:
 *
 *  - Booking (staf): lengkap, termasuk nomor HP utuh, staf penangan, dan
 *    ringkasan pesan WhatsApp;
 *  - BookingPublik (pemegang bookingToken): tanpa ID, tanpa data staf, tanpa
 *    status WhatsApp, tanpa token, dan nomor HP disamarkan. Halaman booking
 *    bisa dibuka siapa saja yang memegang tautannya, jadi yang tidak perlu
 *    dilihat pelanggan tidak pernah dikirim.
 *
 * Modul lain yang membalas Booking (mis. konversi booking menjadi SPK di
 * modul Servis) memakai ambil() supaya bentuknya tetap satu.
 */
final class BookingDetail
{
    /** Jenis pesan di RingkasanWaBooking, urut seperti kunci skemanya. */
    private const JENIS_WA = [JenisPesan::BookingDikonfirmasi, JenisPesan::BookingDitolak];

    public function __construct(
        private readonly BookingRepositoryInterface $repo,
        private readonly PesanWaService $wa,
    ) {}

    /**
     * Booking (staf) untuk satu booking, atau null bila tidak ada. Dipanggil
     * di luar transaksi (sesudah commit), supaya membaca data yang tersimpan.
     *
     * @return array<string, mixed>|null
     */
    public function ambil(string $bookingId): ?array
    {
        $row = $this->repo->baca($bookingId);

        return $row === null ? null : $this->banyak([$row])[0];
    }

    /**
     * Booking (staf) untuk banyak baris sekaligus; ringkasan WhatsApp-nya
     * dibaca dengan satu query untuk semua baris.
     *
     * @param  list<object>  $rows  baris dari BookingRepositoryInterface::baca/daftar
     * @return list<array<string, mixed>>
     */
    public function banyak(array $rows): array
    {
        $ids = array_map(fn (object $row): string => $row->booking_id, $rows);
        $wa = $this->wa->ringkasanBanyak('booking_id', $ids, self::JENIS_WA);

        return array_map(fn (object $row): array => self::staf($row, $wa[$row->booking_id]), $rows);
    }

    /**
     * @param  array<string, array{status: string, createdAt: string}|null>  $wa  RingkasanWaBooking
     * @return array<string, mixed> skema Booking
     */
    public static function staf(object $row, array $wa): array
    {
        return [
            'bookingId' => $row->booking_id,
            'number' => $row->number,
            'status' => $row->status,
            'customerName' => $row->customer_name,
            'phone' => $row->customer_phone,
            'vehicleType' => $row->vehicle_type,
            'plate' => $row->plate_display,
            'plateKey' => $row->plate_key,
            'vehicleBrand' => $row->vehicle_brand,
            'vehicleModel' => $row->vehicle_model,
            // Nama jasa adalah salinan saat booking dibuat, bukan nama jasa sekarang.
            'service' => $row->service_id === null ? null : ['serviceId' => $row->service_id, 'name' => $row->service_name],
            'visitDate' => (string) $row->visit_date,
            'complaint' => $row->complaint,
            'rejectReason' => $row->reject_reason,
            'workOrderNumber' => $row->work_order_number,
            'handledBy' => $row->handled_by_staff_id === null ? null
                : ['staffId' => $row->handled_by_staff_id, 'name' => $row->handled_by_name],
            'wa' => $wa,
            'createdAt' => Time::dbToJson($row->created_at),
            'updatedAt' => Time::dbToJson($row->updated_at),
        ];
    }

    /** @return array<string, mixed> skema BookingPublik */
    public static function publik(object $row): array
    {
        return [
            'number' => $row->number,
            'status' => $row->status,
            'customerName' => $row->customer_name,
            'phone' => PhoneNumber::mask($row->customer_phone),
            'vehicleType' => $row->vehicle_type,
            'plate' => $row->plate_display,
            'vehicleBrand' => $row->vehicle_brand,
            'vehicleModel' => $row->vehicle_model,
            'serviceName' => $row->service_name,
            'visitDate' => (string) $row->visit_date,
            'complaint' => $row->complaint,
            // Satu-satunya teks dari staf yang tampil ke pelanggan.
            'rejectReason' => $row->reject_reason,
            'workOrderNumber' => $row->work_order_number,
            'createdAt' => Time::dbToJson($row->created_at),
        ];
    }
}
