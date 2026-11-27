<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Pelanggan\Contracts;

use App\Modules\Pelanggan\Kendaraan;
use App\Modules\Pelanggan\Pelanggan;
use App\Support\Database\SearchTerm;
use App\Support\Http\ApiError;
use App\Support\Http\Page;

/**
 * Akses tabel customers dan vehicles. Langkah yang harus terjadi bersama
 * dijalankan service di dalam transaction(), memakai metode berawalan kunci*
 * yang mengunci baris sampai transaksi selesai. Keunikan nomor HP dan kunci
 * plat dijaga indeks unik; metode penulis menerjemahkan pelanggarannya
 * menjadi 409.
 */
interface PelangganRepositoryInterface
{
    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function transaction(callable $callback): mixed;

    /** Pelanggan beserta semua kendaraannya; null bila tidak ada. */
    public function ambil(string $customerId): ?Pelanggan;

    public function ada(string $customerId): bool;

    /** SELECT … FOR UPDATE baris pelanggan; false bila tidak ada. */
    public function kunci(string $customerId): bool;

    /**
     * Satu halaman pelanggan yang cocok dengan $search (nama, nomor HP, atau
     * plat salah satu kendaraannya), urut name lalu customer_id.
     *
     * @return array{0: list<Pelanggan>, 1: int} isi halaman dan total yang cocok
     */
    public function daftar(SearchTerm $search, Page $page): array;

    /**
     * @param  array{name: string, phone: string, address: string, notes: string}  $kolom
     *
     * @throws ApiError 409 phone_taken
     */
    public function simpanBaru(string $customerId, array $kolom, string $now): void;

    /**
     * @param  array<string, string>  $changes  kolom → nilai baru, tidak kosong
     *
     * @throws ApiError 409 phone_taken
     */
    public function ubah(string $customerId, array $changes, string $now): void;

    public function ambilKendaraan(string $vehicleId): ?Kendaraan;

    /** SELECT … FOR UPDATE baris kendaraan; false bila tidak ada. */
    public function kunciKendaraan(string $vehicleId): bool;

    /**
     * @param  array<string, string|int|null>  $kolom  kolom vehicles → nilai, tanpa id dan waktu
     *
     * @throws ApiError 409 plate_taken
     */
    public function simpanKendaraanBaru(string $vehicleId, string $customerId, array $kolom, string $now): void;

    /**
     * @param  array<string, string|int|null>  $changes  kolom → nilai baru, tidak kosong
     *
     * @throws ApiError 409 plate_taken
     */
    public function ubahKendaraan(string $vehicleId, array $changes, string $now): void;

    /**
     * Kendaraan yang kunci platnya memuat $bagianKunci, beserta pemiliknya.
     * Urut: kunci yang sama persis dulu, lalu kunci naik (biner), lalu
     * vehicle_id naik.
     *
     * @return array{0: list<array{vehicle: Kendaraan, customer: array{customerId: string, name: string, phone: string}}>, 1: int}
     */
    public function cariPlat(string $bagianKunci, Page $page): array;
}
