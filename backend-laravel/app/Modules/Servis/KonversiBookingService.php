<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Booking\BookingDetail;
use App\Modules\Booking\StatusBooking;
use App\Modules\Servis\Contracts\KonversiRepositoryInterface;
use App\Modules\Servis\Contracts\ServisRepositoryInterface;
use App\Modules\Sesi\SesiStaf;
use App\Modules\WhatsApp\JenisPesan;
use App\Support\Http\ApiError;
use App\Support\Security\Uuid;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use LogicException;

/**
 * Menjadikan booking SPK saat pelanggan datang (POST
 * /api/bookings/{bookingId}/convert).
 *
 * Pelanggan dicari dari nomor HP booking dan kendaraan dari kunci platnya;
 * yang belum ada dibuat. Data yang sudah ada dipakai apa adanya dan tidak
 * pernah ditimpa isian form publik (keputusan 0a-10: jangan mengubah data
 * diam-diam). Plat yang terdaftar atas pelanggan lain ditolak supaya kasir
 * memeriksanya dulu, mis. motor sudah dijual atau plat salah ketik.
 */
final class KonversiBookingService
{
    public function __construct(
        private readonly KonversiRepositoryInterface $repository,
        private readonly ServisRepositoryInterface $spk,
        private readonly ServisService $servis,
        private readonly BookingDetail $bookingDetail,
        private readonly Clock $clock,
    ) {}

    /** Booking dari path; bentuk UUID yang salah atau tidak ada → 404. */
    public function pastikanBooking(string $bookingId): void
    {
        if (! Uuid::valid($bookingId) || ! $this->repository->adaBooking($bookingId)) {
            throw ApiError::notFound('Booking tidak ditemukan');
        }
    }

    /**
     * Satu transaksi dengan urutan kunci booking → pelanggan → kendaraan →
     * counters → SPK. Penolakan apa pun (409) membatalkan semuanya, termasuk
     * pelanggan baru yang sempat dibuat. Pesan "SPK dibuat" dikirim sesudah
     * commit.
     *
     * @param  string|null  $estimatedDoneAt  DATETIME(3) UTC
     * @return array{booking: array<string, mixed>, workOrder: array<string, mixed>} HasilJadikanSpk
     */
    public function jadikan(SesiStaf $sesi, string $bookingId, ?string $mechanicId, ?int $odometer, ?string $estimatedDoneAt): array
    {
        $workOrderId = $this->repository->transaksiUlang(function () use ($sesi, $bookingId, $mechanicId, $odometer, $estimatedDoneAt): string {
            $now = Time::toDb($this->clock->now());
            $booking = $this->repository->kunciBooking($bookingId) ?? throw ApiError::notFound('Booking tidak ditemukan');
            StatusBooking::from($booking->status)->pastikanBolehKe(StatusBooking::JadiSpk);

            $customerId = $this->repository->kunciPelanggan($booking->customer_phone);
            if ($customerId === null) {
                $customerId = Uuid::new();
                $this->repository->simpanPelanggan($customerId, $booking->customer_name, $booking->customer_phone, $now);
            }

            $kendaraan = $this->repository->kunciKendaraan($booking->plate_key);
            if ($kendaraan === null) {
                $vehicleId = Uuid::new();
                $this->repository->simpanKendaraan($vehicleId, $customerId, $booking, $now);
            } elseif ($kendaraan->customer_id !== $customerId) {
                throw ApiError::conflict('plate_owned_by_other_customer');
            } else {
                $vehicleId = $kendaraan->vehicle_id;
            }

            $id = $this->servis->simpanBaru(
                new SpkBaru($vehicleId, $customerId, $booking->complaint, $odometer, $estimatedDoneAt, $mechanicId),
                $sesi->staffId,
                $now,
            );
            $this->itemJasaBooking($id, $booking->service_id, $sesi->staffId, $now);
            $this->repository->tandaiJadiSpk($bookingId, $id, $sesi->staffId, $now);

            return $id;
        });
        $this->servis->kirimOtomatis(JenisPesan::SpkDibuat, $workOrderId);

        // Booking dibaca dengan pemeta milik modul Booking, supaya bentuknya
        // sama persis dengan GET /api/bookings/{bookingId}.
        $booking = $this->bookingDetail->ambil($bookingId) ?? throw new LogicException('booking '.$bookingId.' hilang');

        return ['booking' => $booking, 'workOrder' => $this->servis->detail($workOrderId)];
    }

    /**
     * Jasa yang dipilih di booking menjadi item pertama bila masih aktif
     * (boleh sudah tidak tampil di website), dengan nama dan harga katalog
     * saat konversi. Jasa nonaktif dilewati tanpa galat.
     */
    private function itemJasaBooking(string $workOrderId, ?string $serviceId, string $staffId, string $now): void
    {
        $jasa = $serviceId === null ? null : $this->spk->jasa($serviceId);
        if ($jasa === null || ! (bool) $jasa->is_active) {
            return;
        }
        $this->spk->simpanItem($workOrderId, Uuid::new(), [
            'type' => 'SERVICE', 'service_id' => $serviceId, 'part_id' => null, 'item_name' => $jasa->name,
            'price' => (int) $jasa->price, 'cost_price' => 0, 'quantity' => 1,
        ], $staffId, $now);
        $this->spk->hitungUlangTotal($workOrderId, $now);
    }
}
