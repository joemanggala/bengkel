<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Http;

use App\Support\Database\SqlError;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Mencatat galat tak terduga tanpa membocorkan data.
 *
 * Pesan galat driver MySQL dan QueryException Laravel memuat SQL beserta
 * nilainya (nomor HP, hash token, isi pesan, token lacak), jadi pesannya tidak pernah
 * ditulis. Yang dicatat hanya rute, jenis galat, kode atau errno-nya, letak
 * di kode, dan untuk galat query: SQL dengan placeholder "?" tanpa nilai.
 * Itu cukup untuk menemukan penyebabnya tanpa menyimpan data pelanggan di log.
 */
final class LogGalat
{
    public static function catat(Throwable $e, string $judul = 'permintaan gagal'): void
    {
        $context = [
            'rute' => self::rute(),
            'galat' => $e::class,
            'kode' => SqlError::errno($e) ?? $e->getCode(),
            'lokasi' => self::lokasi($e),
        ];
        if ($e instanceof QueryException) {
            $context['sql'] = $e->getSql();
        }
        $previous = $e->getPrevious();
        if ($previous !== null && ! $e instanceof QueryException) {
            $context['sebab'] = $previous::class.' (kode '.(SqlError::errno($previous) ?? $previous->getCode()).')';
        }
        Log::error($judul, $context);
    }

    /**
     * Metode dan POLA rute, mis. "GET api/public/work-orders/{trackingToken}",
     * bukan path asli: path rute publik memuat token booking atau token lacak
     * SPK, dan nomor SPK atau ID lain tidak perlu ikut terlihat di log.
     * Query string juga tidak dicatat (bisa memuat nomor HP pencarian). Rute yang
     * tidak dikenal tidak pernah sampai ke sini (dijawab 404, bukan 500), tetapi
     * bila terjadi, hanya metode yang dicatat.
     */
    private static function rute(): string
    {
        if (! app()->bound('request')) {
            return '-';
        }
        $request = request();
        $pola = $request->route()?->uri();

        return $request->getMethod().' '.($pola ?? '(rute tak dikenal)');
    }

    /** Baris pertama di kode aplikasi (app/) yang dilewati galat ini. */
    private static function lokasi(Throwable $e): string
    {
        $base = str_replace('\\', '/', base_path('app/'));
        foreach ([['file' => $e->getFile(), 'line' => $e->getLine()], ...$e->getTrace()] as $frame) {
            $file = str_replace('\\', '/', (string) ($frame['file'] ?? ''));
            if (str_starts_with($file, $base)) {
                return 'app/'.substr($file, strlen($base)).':'.($frame['line'] ?? 0);
            }
        }

        return basename($e->getFile()).':'.$e->getLine();
    }
}
