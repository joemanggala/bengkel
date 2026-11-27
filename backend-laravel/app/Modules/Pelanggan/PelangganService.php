<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Pelanggan;

use App\Modules\Pelanggan\Contracts\PelangganRepositoryInterface;
use App\Support\Database\SearchTerm;
use App\Support\Http\ApiError;
use App\Support\Http\Page;
use App\Support\Security\Uuid;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use LogicException;

/**
 * Aturan pelanggan dan kendaraan. Tidak tahu soal HTTP; mengembalikan data
 * atau melempar ApiError. Nomor HP dan plat sudah dinormalisasi lapisan
 * masukan (Requests), jadi di sini tinggal keunikan dan penguncian.
 */
final class PelangganService
{
    public function __construct(
        private readonly PelangganRepositoryInterface $repository,
        private readonly Clock $clock,
    ) {}

    /** @return array{0: list<Pelanggan>, 1: int} */
    public function daftar(SearchTerm $search, Page $page): array
    {
        // Term dengan byte UTF-8 tidak sah tidak pernah cocok, dan MySQL
        // menolaknya di kolom utf8mb4, jadi langsung dijawab daftar kosong.
        if ($search->neverMatches()) {
            return [[], 0];
        }

        return $this->repository->daftar($search, $page);
    }

    /**
     * Pelanggan yang diminta di path; 404 bila tidak ada. UUID yang bentuknya
     * salah (termasuk huruf besar) tidak mungkin ada, jadi langsung 404 tanpa
     * bertanya ke database.
     */
    public function cari(string $customerId): Pelanggan
    {
        $pelanggan = Uuid::valid($customerId) ? $this->repository->ambil($customerId) : null;

        return $pelanggan ?? throw self::pelangganTakAda();
    }

    /** 404 lebih dulu dari validasi badan (POST …/vehicles, PATCH). */
    public function pastikanAda(string $customerId): void
    {
        if (! Uuid::valid($customerId) || ! $this->repository->ada($customerId)) {
            throw self::pelangganTakAda();
        }
    }

    /**
     * Nomor kembar ditolak indeks unik customers_phone_key, bukan SELECT
     * lalu INSERT, jadi dua permintaan serentak dengan nomor yang sama →
     * satu 201 dan satu 409 phone_taken.
     *
     * @param  array{name: string, phone: string, address: string, notes: string}  $kolom
     */
    public function buat(array $kolom): Pelanggan
    {
        $customerId = Uuid::new();
        $now = Time::toDb($this->clock->now());
        $this->repository->transaction(fn () => $this->repository->simpanBaru($customerId, $kolom, $now));

        return $this->wajibAda($customerId);
    }

    /**
     * Perubahan sebagian. Baris dikunci (SELECT … FOR UPDATE) di transaksi
     * yang sama dengan UPDATE, dan UPDATE hanya menyentuh kolom yang dikirim,
     * jadi dua PATCH serentak untuk field berbeda sama-sama bertahan. `{}`
     * tidak menulis apa pun.
     *
     * @param  array<string, string>  $changes
     */
    public function ubah(string $customerId, array $changes): Pelanggan
    {
        if ($changes !== []) {
            $now = Time::toDb($this->clock->now());
            $this->repository->transaction(function () use ($customerId, $changes, $now): void {
                if (! $this->repository->kunci($customerId)) {
                    throw self::pelangganTakAda();
                }
                $this->repository->ubah($customerId, $changes, $now);
            });
        }

        return $this->wajibAda($customerId);
    }

    /**
     * Kendaraan baru untuk pelanggan yang sudah dipastikan ada. Kunci plat
     * kembar (milik pelanggan ini maupun pelanggan lain) ditolak indeks unik
     * vehicles_plate_key_key → 409 plate_taken.
     *
     * @param  array<string, string|int|null>  $kolom
     */
    public function tambahKendaraan(string $customerId, array $kolom): Kendaraan
    {
        $vehicleId = Uuid::new();
        $now = Time::toDb($this->clock->now());
        $this->repository->transaction(fn () => $this->repository->simpanKendaraanBaru($vehicleId, $customerId, $kolom, $now));

        return $this->kendaraanWajibAda($vehicleId);
    }

    /** Kendaraan yang diminta di path; 404 bila tidak ada atau UUID-nya salah bentuk. */
    public function cariKendaraan(string $vehicleId): Kendaraan
    {
        $kendaraan = Uuid::valid($vehicleId) ? $this->repository->ambilKendaraan($vehicleId) : null;

        return $kendaraan ?? throw self::kendaraanTakAda();
    }

    /**
     * Sama dengan ubah() untuk pelanggan: baris kendaraan dikunci, lalu hanya
     * kolom yang dikirim yang diubah. Plat miliknya sendiri dalam bentuk lain
     * menghasilkan kunci yang sama dengan barisnya sendiri, jadi bukan
     * bentrok; kunci milik kendaraan lain → 409 plate_taken.
     *
     * @param  array<string, string|int|null>  $changes
     */
    public function ubahKendaraan(string $vehicleId, array $changes): Kendaraan
    {
        if ($changes !== []) {
            $now = Time::toDb($this->clock->now());
            $this->repository->transaction(function () use ($vehicleId, $changes, $now): void {
                if (! $this->repository->kunciKendaraan($vehicleId)) {
                    throw self::kendaraanTakAda();
                }
                $this->repository->ubahKendaraan($vehicleId, $changes, $now);
            });
        }

        return $this->kendaraanWajibAda($vehicleId);
    }

    /** @return array{0: list<array{vehicle: Kendaraan, customer: array{customerId: string, name: string, phone: string}}>, 1: int} */
    public function cariPlat(string $bagianKunci, Page $page): array
    {
        return $this->repository->cariPlat($bagianKunci, $page);
    }

    /** Pelanggan dan kendaraan tidak pernah dihapus, jadi baris yang baru ditulis pasti ada. */
    private function wajibAda(string $customerId): Pelanggan
    {
        return $this->repository->ambil($customerId) ?? throw new LogicException('pelanggan '.$customerId.' hilang');
    }

    private function kendaraanWajibAda(string $vehicleId): Kendaraan
    {
        return $this->repository->ambilKendaraan($vehicleId) ?? throw new LogicException('kendaraan '.$vehicleId.' hilang');
    }

    private static function pelangganTakAda(): ApiError
    {
        return ApiError::notFound('Pelanggan tidak ditemukan');
    }

    private static function kendaraanTakAda(): ApiError
    {
        return ApiError::notFound('Kendaraan tidak ditemukan');
    }
}
