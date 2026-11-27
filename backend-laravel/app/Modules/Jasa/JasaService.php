<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Jasa;

use App\Modules\Jasa\Contracts\JasaRepositoryInterface;
use App\Support\Database\SearchTerm;
use App\Support\Http\ApiError;
use App\Support\Security\Uuid;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use LogicException;

/**
 * Aturan katalog jasa. Jasa tidak pernah dihapus; yang tidak dipakai lagi
 * dinonaktifkan, karena item SPK dan booking lama menyalin nama dan harganya.
 */
final class JasaService
{
    public function __construct(
        private readonly JasaRepositoryInterface $repository,
        private readonly Clock $clock,
    ) {}

    /** @return list<Jasa> */
    public function daftar(?bool $isActive, SearchTerm $search): array
    {
        // Term dengan byte UTF-8 rusak tidak pernah cocok, dan MySQL menolak
        // membandingkannya dengan kolom utf8mb4, jadi tidak perlu bertanya.
        if ($search->neverMatches()) {
            return [];
        }

        return $this->repository->daftar($isActive, $search);
    }

    /** @return list<Jasa> */
    public function publik(): array
    {
        return $this->repository->daftarPublik();
    }

    /** @param  array<string, mixed>  $values  kolom services dari JasaInput::buat */
    public function buat(array $values): Jasa
    {
        $serviceId = Uuid::new();
        $this->repository->simpanBaru($serviceId, $values, Time::toDb($this->clock->now()));

        return $this->repository->ambil($serviceId) ?? throw new LogicException('jasa '.$serviceId.' hilang');
    }

    /**
     * Jasa yang akan diubah; 404 sebelum badan divalidasi. ID yang bentuknya
     * bukan UUID kanonik huruf kecil langsung 404 tanpa bertanya ke database.
     */
    public function cari(string $serviceId): Jasa
    {
        $jasa = Uuid::valid($serviceId) ? $this->repository->ambil($serviceId) : null;

        return $jasa ?? throw ApiError::notFound('Jasa tidak ditemukan');
    }

    /**
     * Perubahan sebagian. Baris dikunci lebih dulu, lalu UPDATE hanya
     * menyentuh kolom yang dikirim, sehingga dua PATCH serentak yang mengubah
     * field berbeda sama-sama bertahan. Nama kembar dengan jasa lain → 409
     * dari indeks unik; nama sendiri (walau beda huruf) bukan bentrok karena
     * barisnya sama.
     *
     * @param  array<string, mixed>  $changes  kolom services dari JasaInput::ubah
     */
    public function ubah(string $serviceId, array $changes): Jasa
    {
        return $this->repository->transaction(function () use ($serviceId, $changes): Jasa {
            $this->repository->kunci($serviceId) ?? throw ApiError::notFound('Jasa tidak ditemukan');
            if ($changes !== []) {
                $this->repository->ubah($serviceId, $changes, Time::toDb($this->clock->now()));
            }

            return $this->repository->ambil($serviceId) ?? throw new LogicException('jasa '.$serviceId.' hilang');
        });
    }
}
