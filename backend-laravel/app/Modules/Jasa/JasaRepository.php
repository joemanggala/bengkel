<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Jasa;

use App\Modules\Jasa\Contracts\JasaRepositoryInterface;
use App\Support\Database\Like;
use App\Support\Database\SearchTerm;
use App\Support\Database\SqlError;
use App\Support\Database\Transaksi;
use App\Support\Http\ApiError;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Throwable;

final class JasaRepository implements JasaRepositoryInterface
{
    /** Indeks unik nama jasa (collation utf8mb4_0900_ai_ci). */
    private const NAME_KEY = 'services_name_key';

    public function transaction(callable $callback): mixed
    {
        return Transaksi::jalankan($callback);
    }

    public function daftar(?bool $isActive, SearchTerm $search): array
    {
        $query = DB::table('services');
        if ($isActive !== null) {
            $query->where('is_active', $isActive);
        }
        if (! $search->isEmpty()) {
            // Nama dicocokkan dengan collation kolom, jadi huruf besar/kecil
            // dan aksen tidak membedakan; deskripsi sengaja tidak ikut.
            $query->whereRaw('name '.Like::CONTAINS, [$search->forName()]);
        }

        return $this->urut($query);
    }

    public function daftarPublik(): array
    {
        return $this->urut(DB::table('services')->where('is_active', true)->where('is_public', true));
    }

    public function ambil(string $serviceId): ?Jasa
    {
        $row = DB::table('services')->where('service_id', $serviceId)->first(Jasa::COLUMNS);

        return $row === null ? null : Jasa::fromRow($row);
    }

    public function kunci(string $serviceId): ?Jasa
    {
        $row = DB::table('services')->where('service_id', $serviceId)->lockForUpdate()->first(Jasa::COLUMNS);

        return $row === null ? null : Jasa::fromRow($row);
    }

    public function simpanBaru(string $serviceId, array $values, string $now): void
    {
        try {
            DB::table('services')->insert(['service_id' => $serviceId] + $values + ['created_at' => $now, 'updated_at' => $now]);
        } catch (QueryException $e) {
            throw $this->namaKembar($e);
        }
    }

    public function ubah(string $serviceId, array $changes, string $now): void
    {
        try {
            DB::table('services')->where('service_id', $serviceId)->update($changes + ['updated_at' => $now]);
        } catch (QueryException $e) {
            throw $this->namaKembar($e);
        }
    }

    /**
     * Urutan bawaan daftar jasa. Pembanding nama diserahkan ke database
     * (collation kolom) supaya sama persis dengan backend lain.
     *
     * @return list<Jasa>
     */
    private function urut(Builder $query): array
    {
        return $query->orderBy('sort_order')->orderBy('name')->orderBy('service_id')->get(Jasa::COLUMNS)
            ->map(fn (object $row) => Jasa::fromRow($row))->all();
    }

    /**
     * Keunikan nama dijaga indeks unik, bukan SELECT lalu INSERT, supaya dua
     * jasa bernama sama yang disimpan bersamaan tetap menghasilkan satu 409.
     */
    private function namaKembar(QueryException $e): Throwable
    {
        return SqlError::isDuplicateKey($e, self::NAME_KEY) ? ApiError::conflict('service_name_taken') : $e;
    }
}
