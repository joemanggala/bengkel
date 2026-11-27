<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Sesi\SesiStaf;
use App\Support\Http\ApiError;
use App\Support\Validation\JsonObject;

/**
 * Batas mekanik di rute SPK (spec, "Peran dan sesi", "Batas mekanik"):
 * mekanik hanya melihat dan mengubah SPK yang ditugaskan kepadanya, dan di
 * PATCH hanya boleh mengirim diagnosis. Uang, stok, dan pembatalan tetap di
 * kasir (yang bertanggung jawab atas kas), dan rute itu sudah ditolak lebih awal
 * oleh middleware peran.
 *
 * Pemilik dan kasir tidak dibatasi apa pun di sini.
 */
final class BatasMekanik
{
    /** Kunci badan PATCH SPK yang hanya boleh dikirim pemilik dan kasir. */
    public const KUNCI_KHUSUS_KASIR = ['mechanicId', 'complaint', 'odometer', 'estimatedDoneAt'];

    /**
     * Rincian, PATCH, dan ubah status SPK: mekanik yang membuka SPK bukan
     * miliknya, termasuk SPK yang belum punya mekanik → 403 forbidden.
     * Dipanggil sesudah SPK ditemukan (404 lebih dulu) dan sebelum badan
     * divalidasi, supaya mekanik yang membuka SPK orang lain selalu mendapat
     * jawaban yang sama apa pun isi badannya. Rute ubah status memanggilnya lagi sesudah baris SPK
     * dikunci, karena mekaniknya bisa diganti kasir di antara keduanya.
     */
    public static function bolehBuka(SesiStaf $sesi, ?string $mechanicStaffId): void
    {
        if ($sesi->mekanik() && $mechanicStaffId !== $sesi->staffId) {
            throw ApiError::forbidden();
        }
    }

    /**
     * PATCH SPK oleh mekanik: badan yang memuat salah satu kunci khusus kasir,
     * apa pun nilainya (termasuk null), → 403 forbidden. Hanya keberadaan
     * kuncinya yang dinilai, jadi dipanggil sebelum isi badan divalidasi.
     */
    public static function bolehUbah(SesiStaf $sesi, JsonObject $badan): void
    {
        if (! $sesi->mekanik()) {
            return;
        }
        foreach (self::KUNCI_KHUSUS_KASIR as $kunci) {
            if ($badan->has($kunci)) {
                throw ApiError::forbidden();
            }
        }
    }

    /**
     * Saringan mekanik untuk daftar SPK (MechanicIdQuery): untuk peminta
     * ber-peran mekanik, ?mechanicId= diabaikan (sesudah formatnya diperiksa)
     * dan daftar selalu hanya SPK miliknya. Untuk peran lain, saringan dari
     * query dipakai apa adanya (null = semua mekanik).
     */
    public static function saringanDaftar(SesiStaf $sesi, ?string $mechanicIdQuery): ?string
    {
        return $sesi->mekanik() ? $sesi->staffId : $mechanicIdQuery;
    }
}
