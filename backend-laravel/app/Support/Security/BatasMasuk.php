<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Security;

use DateTimeImmutable;

/**
 * Membatasi percobaan masuk yang beruntun, supaya sandi tidak bisa ditebak
 * dengan mencoba terus-menerus. Aturan hitungnya ada di AturanBatasMasuk.
 */
interface BatasMasuk
{
    /**
     * Mencatat satu percobaan untuk nama itu (email atau nama pengguna) sebelum
     * sandinya diperiksa. Hasil 0 berarti boleh lanjut; hasil lebih dari 0
     * berarti nama itu sedang dikunci selama sekian detik lagi dan sandi tidak
     * perlu diperiksa.
     */
    public function coba(string $nama, DateTimeImmutable $sekarang): int;

    /** Menghapus hitungan nama itu setelah login yang benar. */
    public function berhasil(string $nama): void;
}
