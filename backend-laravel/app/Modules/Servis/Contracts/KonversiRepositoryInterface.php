<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis\Contracts;

/**
 * Akses data untuk menjadikan booking SPK: baris booking, pelanggan, dan
 * kendaraan. Tabel-tabel itu milik modul Booking dan Pelanggan, tetapi
 * konversi harus menguncinya di transaksi yang sama dengan pembuatan SPK
 * (urutan kunci booking → pelanggan → kendaraan → counters), jadi query-nya
 * ditulis sendiri di sini.
 */
interface KonversiRepositoryInterface
{
    /**
     * Transaksi yang diulang dari awal bila bentrok dengan transaksi lain:
     * deadlock/batas tunggu kunci, atau kunci ganda (1062) saat membuat
     * pelanggan atau kendaraan yang baru saja dibuat permintaan lain.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function transaksiUlang(callable $callback): mixed;

    public function adaBooking(string $bookingId): bool;

    /** Booking yang dikunci {status, customer_name, customer_phone, vehicle_type, plate_display, plate_key, vehicle_brand, vehicle_model, service_id, complaint}. */
    public function kunciBooking(string $bookingId): ?object;

    /** customer_id pemilik nomor HP itu (dikunci), atau null. */
    public function kunciPelanggan(string $phone): ?string;

    public function simpanPelanggan(string $customerId, string $name, string $phone, string $now): void;

    /** Kendaraan berkunci plat itu {vehicle_id, customer_id} (dikunci), atau null. */
    public function kunciKendaraan(string $plateKey): ?object;

    public function simpanKendaraan(string $vehicleId, string $customerId, object $booking, string $now): void;

    public function tandaiJadiSpk(string $bookingId, string $workOrderId, string $staffId, string $now): void;
}
