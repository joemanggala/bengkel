<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Staf\Contracts;

use App\Modules\Staf\Staf;
use App\Support\Http\ApiError;

/**
 * Akses tabel staff. Langkah yang harus terjadi bersama dijalankan service di
 * dalam transaction(), memakai metode berawalan kunci* yang mengunci baris
 * sampai transaksi selesai.
 */
interface StafRepositoryInterface
{
    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function transaction(callable $callback): mixed;

    public function adaStaf(): bool;

    /**
     * Mengunci baris outlet (SELECT … FOR UPDATE) sebagai mutex untuk semua
     * perubahan staf: setup, membuat staf, dan mengubah staf berjalan satu
     * per satu. Selalu dikunci paling awal, sebelum baris staf mana pun.
     */
    public function kunciOutlet(): void;

    /**
     * Hash sandi dan status aktif untuk masuk; null bila email tak dikenal.
     *
     * @return array{staffId: string, passwordHash: string, isActive: bool}|null
     */
    public function cariUntukMasuk(string $email): ?array;

    public function ambil(string $staffId): ?Staf;

    public function kunci(string $staffId): ?Staf;

    /** @return list<Staf> urut name lalu staff_id */
    public function daftar(): array;

    /** @throws ApiError 409 email_taken bila email sudah dipakai */
    /** @return list<array{staffId: string, name: string}> mekanik aktif, urut nama lalu id */
    public function mekanikAktif(): array;

    public function simpanBaru(string $staffId, string $name, string $email, string $passwordHash, string $role, string $now): void;

    public function emailDipakaiStafLain(string $email, string $staffId): bool;

    /** Mengunci semua pemilik aktif lalu menghitung yang bukan $staffId. */
    public function kunciJumlahPemilikAktifLain(string $staffId): int;

    /**
     * @param  array<string, string|bool>  $changes  kolom → nilai baru
     *
     * @throws ApiError 409 email_taken
     */
    public function ubah(string $staffId, array $changes, string $now): void;
}
