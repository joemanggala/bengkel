<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sesi;

use Illuminate\Http\Request;
use LogicException;

/** Sesi staf yang sedang dipakai satu permintaan, dititipkan middleware staff. */
final class SesiStaf
{
    public const ATRIBUT = 'bengkel.sesi-staf';

    /** expiresAt dan lastUsedAt berupa nilai DATETIME(3) UTC dari database. */
    public function __construct(
        public readonly string $sesiId,
        public readonly string $staffId,
        public readonly Peran $peran,
        public readonly string $expiresAt,
        public readonly string $lastUsedAt,
    ) {}

    public function pemilik(): bool
    {
        return $this->peran === Peran::Pemilik;
    }

    /** Mekanik dibatasi ke SPK miliknya; peran lain tidak (lihat Servis\BatasMekanik). */
    public function mekanik(): bool
    {
        return $this->peran === Peran::Mekanik;
    }

    public function diperpanjang(string $expiresAt, string $lastUsedAt): self
    {
        return new self($this->sesiId, $this->staffId, $this->peran, $expiresAt, $lastUsedAt);
    }

    /**
     * Sesi milik permintaan ini. Hanya boleh dipanggil di rute yang memakai
     * middleware staff; selain itu kesalahan pemrograman (500).
     */
    public static function dari(Request $request): self
    {
        $sesi = $request->attributes->get(self::ATRIBUT);
        if (! $sesi instanceof self) {
            throw new LogicException('rute ini tidak memakai middleware staff');
        }

        return $sesi;
    }
}
