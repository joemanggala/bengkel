<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Security;

use App\Support\Database\Transaksi;
use App\Support\Time\Time;
use DateTimeImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Menyimpan hitungan di tabel login_attempts. PHP-FPM menjalankan banyak proses
 * yang tidak berbagi memori, jadi hitungan harus di database. Baris nama itu
 * dikunci (SELECT ... FOR UPDATE) selama dihitung, sehingga permintaan
 * serentak untuk nama yang sama diproses satu per satu dan tetap hanya
 * mendapat 10 kesempatan. Kuncinya SHA-256 dari nama, supaya email penebak
 * tidak tersimpan.
 */
final class BatasMasukDatabase implements BatasMasuk
{
    /** Satu dari sekian panggilan ikut membersihkan baris lama. */
    private const PELUANG_BERSIH = 50;

    public function coba(string $nama, DateTimeImmutable $sekarang): int
    {
        $kunci = hash('sha256', $nama);
        $sisa = Transaksi::jalankan(function () use ($kunci, $sekarang): int {
            // Baris dibuat lebih dulu supaya SELECT ... FOR UPDATE di bawah
            // selalu menemukan satu baris untuk dikunci, termasuk untuk nama
            // yang baru pertama kali dicoba. Sengaja ON DUPLICATE KEY UPDATE
            // (yang langsung memegang kunci eksklusif), bukan INSERT IGNORE:
            // INSERT IGNORE hanya memegang kunci bersama pada baris yang sudah
            // ada, lalu SELECT ... FOR UPDATE menaikkannya, dan permintaan
            // serentak untuk nama yang sama saling menunggu (deadlock 1213).
            //
            // CHECK login_attempts_positif melarang attempts 0, jadi baris baru
            // langsung mencatat percobaan pertama ini. MySQL melaporkan 1 baris
            // berubah untuk INSERT baru dan 0 untuk baris yang sudah ada (UPDATE
            // yang tidak mengubah apa pun), sehingga terlihat mana yang terjadi.
            $baru = DB::affectingStatement(
                'INSERT INTO login_attempts (key_hash, attempts, window_start, locked_until) VALUES (?, 1, ?, NULL) '
                .'ON DUPLICATE KEY UPDATE key_hash = key_hash',
                [$kunci, Time::toDb($sekarang)],
            ) === 1;
            if ($baru && AturanBatasMasuk::MAKS_PERCOBAAN > 1) {
                return 0;
            }
            $baris = DB::selectOne(
                'SELECT attempts, window_start, locked_until FROM login_attempts WHERE key_hash = ? FOR UPDATE',
                [$kunci],
            );
            $hasil = AturanBatasMasuk::terapkan([
                'percobaan' => (int) $baris->attempts,
                'mulai' => Time::fromDb($baris->window_start),
                'kunciSampai' => $baris->locked_until === null ? null : Time::fromDb($baris->locked_until),
            ], $sekarang);
            if ($hasil['berubah']) {
                $catatan = $hasil['catatan'];
                DB::update('UPDATE login_attempts SET attempts = ?, window_start = ?, locked_until = ? WHERE key_hash = ?', [
                    $catatan['percobaan'],
                    Time::toDb($catatan['mulai']),
                    $catatan['kunciSampai'] === null ? null : Time::toDb($catatan['kunciSampai']),
                    $kunci,
                ]);
            }

            return $hasil['sisaDetik'];
        });
        if (random_int(1, self::PELUANG_BERSIH) === 1) {
            $this->bersihkan($sekarang);
        }

        return $sisa;
    }

    public function berhasil(string $nama): void
    {
        DB::delete('DELETE FROM login_attempts WHERE key_hash = ?', [hash('sha256', $nama)]);
    }

    /**
     * Membuang baris yang tidak lagi berpengaruh: percobaan pertamanya sudah
     * di luar jendela dan tidak sedang dikunci. Tanpa ini, banjir nama palsu
     * membuat tabel membengkak.
     */
    private function bersihkan(DateTimeImmutable $sekarang): void
    {
        $batas = Time::toDb(Time::plusSeconds($sekarang, -AturanBatasMasuk::JENDELA_DETIK));
        DB::delete(
            'DELETE FROM login_attempts WHERE window_start < ? AND (locked_until IS NULL OR locked_until < ?) LIMIT 500',
            [$batas, Time::toDb($sekarang)],
        );
    }
}
