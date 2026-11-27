<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Pelanggan;

use App\Modules\Pelanggan\Contracts\PelangganRepositoryInterface;
use App\Support\Database\Like;
use App\Support\Database\SearchTerm;
use App\Support\Database\SqlError;
use App\Support\Database\Transaksi;
use App\Support\Http\ApiError;
use App\Support\Http\Page;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

final class PelangganRepository implements PelangganRepositoryInterface
{
    /** Indeks unik yang menjaga "satu nomor HP satu pelanggan" (db/migrations). */
    private const PHONE_KEY = 'customers_phone_key';

    /** Indeks unik yang menjaga "satu kunci plat satu kendaraan". */
    private const PLATE_KEY = 'vehicles_plate_key_key';

    public function transaction(callable $callback): mixed
    {
        return Transaksi::jalankan($callback);
    }

    public function ambil(string $customerId): ?Pelanggan
    {
        $row = DB::table('customers')->where('customer_id', $customerId)->first(Pelanggan::COLUMNS);
        if ($row === null) {
            return null;
        }

        return Pelanggan::fromRow($row, $this->kendaraanMilik([$customerId])[$customerId] ?? []);
    }

    public function ada(string $customerId): bool
    {
        return DB::table('customers')->where('customer_id', $customerId)->exists();
    }

    public function kunci(string $customerId): bool
    {
        return DB::table('customers')->where('customer_id', $customerId)->lockForUpdate()->value('customer_id') !== null;
    }

    public function daftar(SearchTerm $search, Page $page): array
    {
        $query = DB::table('customers as c');
        if (! $search->isEmpty()) {
            $this->saringCari($query, $search);
        }

        $total = (clone $query)->count();
        if ($total === 0 || $page->offset() >= $total) {
            return [[], $total];
        }
        // Urutan nama diserahkan ke database (collation utf8mb4_0900_ai_ci),
        // supaya sama persis dengan backend lain; id memisahkan nama kembar.
        $rows = $query->orderBy('c.name')->orderBy('c.customer_id')
            ->offset($page->offset())->limit($page->limit)
            ->get(array_map(fn (string $kolom): string => 'c.'.$kolom, Pelanggan::COLUMNS));

        // Kendaraan seluruh halaman dibaca dengan satu query, bukan satu
        // query per pelanggan.
        $kendaraan = $this->kendaraanMilik($rows->pluck('customer_id')->all());

        return [$rows->map(fn (object $row) => Pelanggan::fromRow($row, $kendaraan[$row->customer_id] ?? []))->all(), $total];
    }

    /**
     * Baris cocok bila salah satu aturan cocok (parameter Search): nama,
     * nomor HP seragam, atau kunci plat salah satu kendaraannya. Aturan yang
     * tidak mungkin cocok untuk term ini (turunannya null) dilewati. Plat
     * memakai EXISTS, jadi pelanggan dengan dua kendaraan cocok tetap
     * muncul sekali.
     */
    private function saringCari(Builder $query, SearchTerm $search): void
    {
        $phone = $search->forPhone();
        $plate = $search->forPlate();
        $query->where(function (Builder $q) use ($search, $phone, $plate): void {
            $q->whereRaw('c.name '.Like::CONTAINS, [$search->forName()]);
            if ($phone !== null) {
                $q->orWhereRaw('c.phone '.Like::CONTAINS, [$phone]);
            }
            if ($plate !== null) {
                $q->orWhereExists(fn (Builder $sub) => $sub->selectRaw('1')->from('vehicles as v')
                    ->whereColumn('v.customer_id', 'c.customer_id')
                    ->whereRaw('v.plate_key '.Like::CONTAINS, [$plate]));
            }
        });
    }

    /**
     * Kendaraan milik pelanggan-pelanggan ini, dikelompokkan per
     * customer_id, masing-masing urut created_at naik lalu vehicle_id naik.
     *
     * @param  list<string>  $customerIds
     * @return array<string, list<Kendaraan>>
     */
    private function kendaraanMilik(array $customerIds): array
    {
        $hasil = [];
        $rows = DB::table('vehicles')->whereIn('customer_id', $customerIds)
            ->orderBy('created_at')->orderBy('vehicle_id')->get(Kendaraan::COLUMNS);
        foreach ($rows as $row) {
            $hasil[$row->customer_id][] = Kendaraan::fromRow($row);
        }

        return $hasil;
    }

    public function simpanBaru(string $customerId, array $kolom, string $now): void
    {
        try {
            DB::table('customers')->insert([
                'customer_id' => $customerId,
                ...$kolom,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } catch (QueryException $e) {
            throw SqlError::isDuplicateKey($e, self::PHONE_KEY) ? ApiError::conflict('phone_taken') : $e;
        }
    }

    public function ubah(string $customerId, array $changes, string $now): void
    {
        // Nomor yang sama dengan milik baris ini sendiri tidak melanggar
        // indeks unik, jadi hanya nomor pelanggan lain yang menjadi 409.
        try {
            DB::table('customers')->where('customer_id', $customerId)->update($changes + ['updated_at' => $now]);
        } catch (QueryException $e) {
            throw SqlError::isDuplicateKey($e, self::PHONE_KEY) ? ApiError::conflict('phone_taken') : $e;
        }
    }

    public function ambilKendaraan(string $vehicleId): ?Kendaraan
    {
        $row = DB::table('vehicles')->where('vehicle_id', $vehicleId)->first(Kendaraan::COLUMNS);

        return $row === null ? null : Kendaraan::fromRow($row);
    }

    public function kunciKendaraan(string $vehicleId): bool
    {
        return DB::table('vehicles')->where('vehicle_id', $vehicleId)->lockForUpdate()->value('vehicle_id') !== null;
    }

    public function simpanKendaraanBaru(string $vehicleId, string $customerId, array $kolom, string $now): void
    {
        try {
            DB::table('vehicles')->insert([
                'vehicle_id' => $vehicleId,
                'customer_id' => $customerId,
                ...$kolom,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } catch (QueryException $e) {
            throw SqlError::isDuplicateKey($e, self::PLATE_KEY) ? ApiError::conflict('plate_taken') : $e;
        }
    }

    public function ubahKendaraan(string $vehicleId, array $changes, string $now): void
    {
        try {
            DB::table('vehicles')->where('vehicle_id', $vehicleId)->update($changes + ['updated_at' => $now]);
        } catch (QueryException $e) {
            throw SqlError::isDuplicateKey($e, self::PLATE_KEY) ? ApiError::conflict('plate_taken') : $e;
        }
    }

    public function cariPlat(string $bagianKunci, Page $page): array
    {
        // Bagian kunci hanya berisi A-Z dan 0-9 (Plate::query), jadi escape
        // LIKE sebenarnya tidak mengubah apa pun; tetap dipakai supaya pola
        // pencarian di modul ini seragam.
        $query = DB::table('vehicles as v')->join('customers as c', 'c.customer_id', '=', 'v.customer_id')
            ->whereRaw('v.plate_key '.Like::CONTAINS, [Like::escape($bagianKunci)]);

        $total = (clone $query)->count();
        if ($total === 0 || $page->offset() >= $total) {
            return [[], $total];
        }
        // Kunci yang sama persis dulu (kasir mengetik plat utuh), lalu kunci
        // naik; kolom plate_key ascii_bin sehingga urutannya biner.
        $kolom = array_map(fn (string $k): string => 'v.'.$k, Kendaraan::COLUMNS);
        $rows = $query->orderByRaw('v.plate_key = ? DESC', [$bagianKunci])
            ->orderBy('v.plate_key')->orderBy('v.vehicle_id')
            ->offset($page->offset())->limit($page->limit)
            ->get([...$kolom, 'c.name as customer_name', 'c.phone as customer_phone']);

        return [$rows->map(fn (object $row): array => [
            'vehicle' => Kendaraan::fromRow($row),
            'customer' => ['customerId' => $row->customer_id, 'name' => $row->customer_name, 'phone' => $row->customer_phone],
        ])->all(), $total];
    }
}
