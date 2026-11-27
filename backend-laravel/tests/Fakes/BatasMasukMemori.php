<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Fakes;

use App\Support\Security\AturanBatasMasuk;
use App\Support\Security\BatasMasuk;
use DateTimeImmutable;

/** Pembatas login di memori (tanpa database), memakai aturan hitung yang sama dengan produksi. */
final class BatasMasukMemori implements BatasMasuk
{
    /** @var array<string, array{percobaan: int, mulai: DateTimeImmutable, kunciSampai: DateTimeImmutable|null}> */
    private array $data = [];

    public function coba(string $nama, DateTimeImmutable $sekarang): int
    {
        $hasil = AturanBatasMasuk::terapkan($this->data[$nama] ?? null, $sekarang);
        if ($hasil['berubah']) {
            $this->data[$nama] = $hasil['catatan'];
        }

        return $hasil['sisaDetik'];
    }

    public function berhasil(string $nama): void
    {
        unset($this->data[$nama]);
    }
}
