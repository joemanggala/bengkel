<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Database;

use PDOException;
use Throwable;

/**
 * Membaca galat MySQL dari pengecualian Query Builder.
 *
 * Aturan "tidak boleh ganda" (email staf, nomor HP pelanggan, kunci plat,
 * nama jasa, SKU) dijaga
 * indeks unik database, bukan SELECT lalu INSERT, supaya tetap benar walau
 * dua orang menyimpan bersamaan. Repository lalu menerjemahkan galat indeks
 * itu menjadi galat kontrak (mis. 409 email_taken).
 */
final class SqlError
{
    private const DUPLICATE_ENTRY = 1062;

    private const LOCK_WAIT_TIMEOUT = 1205;

    private const DEADLOCK = 1213;

    /**
     * Pelanggaran indeks unik bernama $key. Nama indeks dibaca dari pesan
     * MySQL ("Duplicate entry 'x' for key 'tabel.nama_indeks'"), sehingga satu
     * INSERT bisa membedakan indeks mana yang dilanggar.
     */
    public static function isDuplicateKey(Throwable $e, string $key): bool
    {
        $info = self::errorInfo($e);
        if ($info === null || (int) ($info[1] ?? 0) !== self::DUPLICATE_ENTRY) {
            return false;
        }
        $message = (string) ($info[2] ?? '');

        return str_contains($message, '.'.$key."'") || str_contains($message, "'".$key."'");
    }

    /**
     * Deadlock (1213) atau batas tunggu kunci (1205): transaksi dibatalkan
     * MySQL karena bentrok dengan transaksi lain, bukan karena datanya salah,
     * jadi aman diulang dari awal.
     */
    public static function isConcurrencyConflict(Throwable $e): bool
    {
        return in_array(self::errno($e), [self::DEADLOCK, self::LOCK_WAIT_TIMEOUT], true);
    }

    /**
     * Nomor galat MySQL (mis. 1213) dari rantai pengecualian, atau null.
     * Galat saat menyambung (mis. 1045 sandi salah, 2002 server mati) tidak
     * membawa errorInfo, hanya kode pada pengecualian PDO-nya.
     */
    public static function errno(Throwable $e): ?int
    {
        $info = self::errorInfo($e);
        if (isset($info[1])) {
            return (int) $info[1];
        }
        for ($current = $e; $current !== null; $current = $current->getPrevious()) {
            if ($current instanceof PDOException && is_int($current->getCode()) && $current->getCode() > 0) {
                return $current->getCode();
            }
        }

        return null;
    }

    /** @return array<int, mixed>|null */
    private static function errorInfo(Throwable $e): ?array
    {
        for ($current = $e; $current !== null; $current = $current->getPrevious()) {
            if ($current instanceof PDOException && is_array($current->errorInfo) && isset($current->errorInfo[1])) {
                return $current->errorInfo;
            }
        }

        return null;
    }
}
