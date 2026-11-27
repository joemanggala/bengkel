<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sparepart;

use App\Modules\Sparepart\Contracts\SparepartRepositoryInterface;
use App\Modules\Stok\Contracts\StokRepositoryInterface;
use App\Modules\Stok\JenisPergerakan;
use App\Support\Database\SearchTerm;
use App\Support\Http\ApiError;
use App\Support\Http\Page;
use App\Support\Security\Uuid;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use LogicException;

/**
 * Aturan katalog sparepart. Sparepart tidak pernah dihapus (item SPK dan
 * kartu stok menunjuk ke sini), dan stoknya tidak pernah diubah di sini
 * kecuali stok awal saat dibuat, yang dicatat sebagai kartu stok IN.
 */
final class SparepartService
{
    /** Catatan baku kartu stok untuk stok awal (PergerakanStok.note). */
    public const CATATAN_STOK_AWAL = 'Stok awal';

    public function __construct(
        private readonly SparepartRepositoryInterface $repository,
        private readonly StokRepositoryInterface $stok,
        private readonly Clock $clock,
    ) {}

    /** @return array{0: list<Sparepart>, 1: int} */
    public function daftar(?bool $isActive, ?bool $lowStock, SearchTerm $search, Page $page): array
    {
        // Term dengan byte UTF-8 rusak tidak pernah cocok dan tidak boleh
        // dikirim ke kolom utf8mb4: langsung halaman kosong.
        if ($search->neverMatches()) {
            return [[], 0];
        }

        return $this->repository->daftar($isActive, $lowStock, $search, $page);
    }

    /**
     * Sparepart dan baris kartu stok "Stok awal" dibuat dalam satu
     * transaksi, sehingga stock selalu sama dengan jumlah kartu stoknya,
     * bahkan bila INSERT kartu gagal di tengah jalan.
     *
     * @param  array<string, mixed>  $values  kolom dari SparepartInput::buat
     */
    public function buat(array $values, int $initialStock, string $staffId): Sparepart
    {
        $partId = Uuid::new();
        $this->repository->transaction(function () use ($partId, $values, $initialStock, $staffId): void {
            $now = Time::toDb($this->clock->now());
            $this->repository->simpanBaru($partId, $values, $initialStock, $now);
            if ($initialStock > 0) {
                $this->stok->catat($partId, JenisPergerakan::Masuk, $initialStock, $initialStock, self::CATATAN_STOK_AWAL, $staffId, $now);
            }
        });

        return $this->profil($partId);
    }

    /**
     * Sparepart di path; 404 sebelum badan atau query divalidasi. ID yang
     * bentuknya bukan UUID kanonik huruf kecil langsung 404 tanpa query.
     */
    public function cari(string $partId): Sparepart
    {
        $part = Uuid::valid($partId) ? $this->repository->ambil($partId) : null;

        return $part ?? throw ApiError::notFound('Sparepart tidak ditemukan');
    }

    /**
     * Perubahan sebagian. Baris dikunci lebih dulu dan UPDATE hanya menyentuh
     * kolom yang dikirim (tidak pernah stock), jadi PATCH yang serentak dengan
     * item SPK atau stok masuk tidak menimpa stok. SKU sendiri bukan bentrok
     * karena barisnya sama; SKU milik sparepart lain → 409 dari indeks unik.
     *
     * @param  array<string, mixed>  $changes  kolom dari SparepartInput::ubah
     */
    public function ubah(string $partId, array $changes): Sparepart
    {
        return $this->repository->transaction(function () use ($partId, $changes): Sparepart {
            $this->repository->kunci($partId) ?? throw ApiError::notFound('Sparepart tidak ditemukan');
            if ($changes !== []) {
                $this->repository->ubah($partId, $changes, Time::toDb($this->clock->now()));
            }

            return $this->profil($partId);
        });
    }

    private function profil(string $partId): Sparepart
    {
        return $this->repository->ambil($partId) ?? throw new LogicException('sparepart '.$partId.' hilang');
    }
}
