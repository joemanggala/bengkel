<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Database;

use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Transaksi yang diulang bila MySQL membatalkannya karena bentrok.
 *
 * Kunci celah (gap lock) InnoDB membuat dua permintaan yang tidak saling
 * berhubungan pun bisa saling menunggu, mis. dua SPK untuk kendaraan berbeda
 * yang disimpan bersamaan, lalu MySQL memilih satu korban deadlock (errno 1213).
 * Itu bukan galat pengguna, jadi transaksi diulang dari awal, paling banyak tiga
 * kali, dengan jeda acak 10–50 ms supaya tidak langsung bertabrakan lagi.
 *
 * Karena bisa diulang, isi $callback hanya boleh berupa kerja database. Kerja
 * lain (mengirim WhatsApp, menghitung bcrypt) dilakukan sebelum atau sesudahnya.
 */
final class Transaksi
{
    /** Pengulangan sesudah percobaan pertama. */
    public const MAX_RETRIES = 3;

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public static function jalankan(callable $callback): mixed
    {
        // Di dalam transaksi lain, deadlock membatalkan transaksi luar juga;
        // yang mengulang adalah pemanggil terluar.
        if (DB::transactionLevel() > 0) {
            return DB::transaction($callback);
        }
        for ($attempt = 0; ; $attempt++) {
            try {
                return DB::transaction($callback);
            } catch (Throwable $e) {
                if ($attempt >= self::MAX_RETRIES || ! SqlError::isConcurrencyConflict($e)) {
                    throw $e;
                }
                usleep(random_int(10_000, 50_000));
            }
        }
    }
}
