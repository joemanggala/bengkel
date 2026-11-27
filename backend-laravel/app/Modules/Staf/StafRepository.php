<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Staf;

use App\Modules\Staf\Contracts\StafRepositoryInterface;
use App\Support\Database\SqlError;
use App\Support\Database\Transaksi;
use App\Support\Http\ApiError;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

final class StafRepository implements StafRepositoryInterface
{
    private const COLUMNS = ['staff_id', 'name', 'email', 'role', 'is_active', 'created_at'];

    public function transaction(callable $callback): mixed
    {
        return Transaksi::jalankan($callback);
    }

    public function adaStaf(): bool
    {
        return DB::table('staff')->exists();
    }

    public function kunciOutlet(): void
    {
        DB::table('outlet')->where('outlet_id', 1)->lockForUpdate()->value('outlet_id');
    }

    public function cariUntukMasuk(string $email): ?array
    {
        $row = DB::table('staff')->where('email', $email)->first(['staff_id', 'password_hash', 'is_active']);

        return $row === null ? null
            : ['staffId' => $row->staff_id, 'passwordHash' => $row->password_hash, 'isActive' => (bool) $row->is_active];
    }

    public function ambil(string $staffId): ?Staf
    {
        $row = DB::table('staff')->where('staff_id', $staffId)->first(self::COLUMNS);

        return $row === null ? null : Staf::fromRow($row);
    }

    public function kunci(string $staffId): ?Staf
    {
        $row = DB::table('staff')->where('staff_id', $staffId)->lockForUpdate()->first(self::COLUMNS);

        return $row === null ? null : Staf::fromRow($row);
    }

    public function daftar(): array
    {
        // Urutan nama diserahkan ke database (collation utf8mb4_0900_ai_ci),
        // supaya sama persis dengan backend lain.
        return DB::table('staff')->orderBy('name')->orderBy('staff_id')->get(self::COLUMNS)
            ->map(fn (object $row) => Staf::fromRow($row))->all();
    }

    public function mekanikAktif(): array
    {
        return DB::table('staff')->where('role', 'mechanic')->where('is_active', true)
            ->orderBy('name')->orderBy('staff_id')->get(['staff_id', 'name'])
            ->map(fn (object $row): array => ['staffId' => $row->staff_id, 'name' => $row->name])->all();
    }

    public function simpanBaru(string $staffId, string $name, string $email, string $passwordHash, string $role, string $now): void
    {
        try {
            DB::table('staff')->insert([
                'staff_id' => $staffId,
                'name' => $name,
                'email' => $email,
                'password_hash' => $passwordHash,
                'role' => $role,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } catch (QueryException $e) {
            throw SqlError::isDuplicateKey($e, 'staff_email_key') ? ApiError::conflict('email_taken') : $e;
        }
    }

    public function emailDipakaiStafLain(string $email, string $staffId): bool
    {
        return DB::table('staff')->where('email', $email)->where('staff_id', '<>', $staffId)->exists();
    }

    public function kunciJumlahPemilikAktifLain(string $staffId): int
    {
        $owners = DB::table('staff')->where('role', 'owner')->where('is_active', true)
            ->lockForUpdate()->pluck('staff_id');

        return $owners->reject(fn (string $id) => $id === $staffId)->count();
    }

    public function ubah(string $staffId, array $changes, string $now): void
    {
        try {
            DB::table('staff')->where('staff_id', $staffId)->update($changes + ['updated_at' => $now]);
        } catch (QueryException $e) {
            throw SqlError::isDuplicateKey($e, 'staff_email_key') ? ApiError::conflict('email_taken') : $e;
        }
    }
}
