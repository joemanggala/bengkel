<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sesi\Contracts;

use App\Modules\Sesi\SesiStaf;

/**
 * Akses tabel staff_sessions. Semua waktu berupa teks DATETIME(3) UTC dari
 * jam aplikasi.
 */
interface SesiRepositoryInterface
{
    /** Sesi milik staf yang masih aktif; staf nonaktif dianggap tidak punya sesi. */
    public function cariSesiStaf(string $tokenHash): ?SesiStaf;

    public function simpan(string $sesiId, string $staffId, string $tokenHash, string $now, string $expiresAt): void;

    public function perpanjang(string $sesiId, string $expiresAt, string $lastUsedAt): void;

    public function hapus(string $sesiId): void;

    /** Membersihkan sesi kedaluwarsa milik satu staf. */
    public function hapusKedaluwarsa(string $staffId, string $now): void;

    /** Menghapus semua sesi milik satu staf, kecuali $kecualiSesiId bila diisi. */
    public function hapusMilik(string $staffId, ?string $kecualiSesiId = null): void;
}
