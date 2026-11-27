<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sesi;

use App\Modules\Sesi\Contracts\SesiRepositoryInterface;
use App\Support\Http\ApiError;
use App\Support\Http\LogGalat;
use App\Support\Security\SecretToken;
use App\Support\Security\Uuid;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use DateTimeImmutable;
use Throwable;

/**
 * Sesi Bearer di tabel staff_sessions: pemeriksaan token, perpanjangan, sesi
 * baru, dan keluar. Hanya staf (pemilik, kasir, dan mekanik) yang punya sesi;
 * pelanggan memegang token publik (token booking dan token lacak), bukan sesi.
 *
 * Guard auth bawaan Laravel tidak dipakai: sesi bengkel berupa token opaque
 * yang hanya disimpan hash-nya, dengan aturan perpanjangan sendiri, dan tidak
 * ada model Eloquent. Sesi Laravel (cookie) juga tidak dipakai, karena web
 * mengirim token lewat header Authorization dari server Next.js (BFF).
 */
final class SesiService
{
    /** Masa berlaku sesi staf: 30 hari, bergeser dari pemakaian terakhir. */
    public const MASA_BERLAKU_DETIK = 30 * 24 * 60 * 60;

    /**
     * Perpanjangan sesi ditulis ke database paling sering sekali per 5 menit.
     * Tanpa batas ini setiap permintaan menulis satu UPDATE, padahal hasilnya
     * nyaris sama.
     */
    public const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

    public function __construct(
        private readonly SesiRepositoryInterface $repository,
        private readonly Clock $clock,
    ) {}

    /**
     * Memeriksa header Authorization untuk rute staf. Semua kegagalan (tanpa
     * header, skema lain, token rusak, tidak dikenal, kedaluwarsa, atau staf
     * nonaktif) dijawab sama: 401 unauthenticated, supaya penebak tidak tahu
     * bagian mana yang salah.
     */
    public function periksaStaf(string $authorization): SesiStaf
    {
        $sesi = $this->repository->cariSesiStaf(self::tokenHash($authorization));
        if ($sesi === null) {
            throw ApiError::unauthenticated();
        }
        $baru = $this->perpanjangBilaPerlu($sesi->sesiId, $sesi->expiresAt, $sesi->lastUsedAt);

        return $baru === null ? $sesi : $sesi->diperpanjang(...$baru);
    }

    /**
     * Membuat sesi baru (di dalam transaksi pemanggil, bila ada) dan
     * mengembalikan token aslinya. Yang disimpan hanya hash-nya; token asli
     * dikirim sekali ke klien dan tidak pernah bisa dibaca ulang dari
     * database.
     *
     * Hanya INSERT satu baris. Pembersihan sesi lama ada di
     * bersihkanKedaluwarsa(), yang dipanggil sesudah transaksi selesai,
     * supaya transaksi masuk tetap pendek dan tidak bertabrakan dengan
     * pengguna lain.
     */
    public function buka(string $staffId): string
    {
        $now = $this->clock->now();
        [$plain, $hash] = SecretToken::new();
        $this->repository->simpan(Uuid::new(), $staffId, $hash, Time::toDb($now),
            Time::toDb(Time::plusSeconds($now, self::MASA_BERLAKU_DETIK)));

        return $plain;
    }

    /** Hanya sesi yang sedang dipakai yang dihapus; sesi lain milik staf yang sama tetap berlaku. */
    public function tutup(SesiStaf $sesi): void
    {
        $this->repository->hapus($sesi->sesiId);
    }

    /**
     * Mencabut semua sesi milik satu staf, mis. saat staf dinonaktifkan.
     * $kecuali dipakai saat staf mengganti sandinya sendiri: sesi yang sedang
     * dipakai tetap hidup.
     */
    public function cabutSemua(string $staffId, ?string $kecualiSesiId = null): void
    {
        $this->repository->hapusMilik($staffId, $kecualiSesiId);
    }

    /**
     * Membersihkan sesi lama milik staf yang sama, sesudah ia masuk. Hanya
     * bersih-bersih: bila gagal (mis. bentrok kunci dengan permintaan lain),
     * galatnya dicatat dan masuk tetap berhasil.
     */
    public function bersihkanKedaluwarsa(string $staffId): void
    {
        try {
            $this->repository->hapusKedaluwarsa($staffId, Time::toDb($this->clock->now()));
        } catch (Throwable $e) {
            LogGalat::catat($e, 'pembersihan sesi kedaluwarsa gagal');
        }
    }

    /**
     * Menolak sesi kedaluwarsa, lalu menggeser masa berlakunya bila pemakaian
     * terakhir tercatat sudah lebih dari TOUCH_INTERVAL_MS yang lalu.
     *
     * @return array{0: string, 1: string}|null expiresAt dan lastUsedAt baru, atau null bila tidak diubah
     */
    private function perpanjangBilaPerlu(string $sesiId, string $expiresAt, string $lastUsedAt): ?array
    {
        $now = $this->clock->now();
        if (Time::fromDb($expiresAt) <= $now) {
            throw ApiError::unauthenticated();
        }
        if (! self::sudahWaktunyaDiperpanjang(Time::fromDb($lastUsedAt), $now)) {
            return null;
        }
        $baru = [
            Time::toDb(Time::plusSeconds($now, self::MASA_BERLAKU_DETIK)),
            Time::toDb($now),
        ];
        $this->repository->perpanjang($sesiId, ...$baru);

        return $baru;
    }

    private static function sudahWaktunyaDiperpanjang(DateTimeImmutable $lastUsedAt, DateTimeImmutable $now): bool
    {
        return Time::millis($now) - Time::millis($lastUsedAt) > self::TOUCH_INTERVAL_MS;
    }

    /**
     * "Authorization: Bearer <token>" → hash token. Nama skema tidak peka huruf
     * besar/kecil (RFC 9110), lalu tepat satu spasi; tab atau dua spasi
     * ditolak. Tokennya wajib berbentuk token sesi (43 karakter base64url)
     * sebelum dicari di database. Spasi di awal dan akhir nilai header
     * diabaikan seperti biasa di HTTP.
     */
    private static function tokenHash(string $authorization): string
    {
        $authorization = trim($authorization, " \t");
        $space = strpos($authorization, ' ');
        if ($space === false || strcasecmp(substr($authorization, 0, $space), 'Bearer') !== 0) {
            throw ApiError::unauthenticated();
        }
        $token = substr($authorization, $space + 1);
        if (! SecretToken::valid($token)) {
            throw ApiError::unauthenticated();
        }

        return SecretToken::hash($token);
    }
}
