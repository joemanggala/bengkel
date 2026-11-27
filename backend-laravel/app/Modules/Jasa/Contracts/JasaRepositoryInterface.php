<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Jasa\Contracts;

use App\Modules\Jasa\Jasa;
use App\Support\Database\SearchTerm;

/** Akses data katalog jasa (tabel services). */
interface JasaRepositoryInterface
{
    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function transaction(callable $callback): mixed;

    /**
     * Semua jasa untuk staf, urut sort_order, name (collation kolom), lalu
     * service_id.
     *
     * @return list<Jasa>
     */
    public function daftar(?bool $isActive, SearchTerm $search): array;

    /**
     * Jasa yang aktif dan tampil di website, dengan urutan yang sama.
     *
     * @return list<Jasa>
     */
    public function daftarPublik(): array;

    public function ambil(string $serviceId): ?Jasa;

    /** Membaca baris dengan SELECT … FOR UPDATE; hanya di dalam transaksi. */
    public function kunci(string $serviceId): ?Jasa;

    /**
     * INSERT jasa baru. Nama kembar menurut collation (indeks unik
     * services_name_key) → ApiError 409 service_name_taken.
     *
     * @param  array<string, mixed>  $values  kolom → nilai, tanpa id dan waktu
     */
    public function simpanBaru(string $serviceId, array $values, string $now): void;

    /**
     * UPDATE hanya kolom yang diberikan, ditambah updated_at. Nama kembar →
     * ApiError 409 service_name_taken.
     *
     * @param  array<string, mixed>  $changes
     */
    public function ubah(string $serviceId, array $changes, string $now): void;
}
