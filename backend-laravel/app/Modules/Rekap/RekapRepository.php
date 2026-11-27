<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Rekap;

use App\Modules\Rekap\Contracts\RekapRepositoryInterface;
use App\Support\Time\Time;
use DateTimeImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Query rekap harian. SUM atas BIGINT menghasilkan DECIMAL di MySQL, jadi
 * setiap jumlah diubah ke SIGNED supaya terbaca sebagai integer.
 */
final class RekapRepository implements RekapRepositoryInterface
{
    public function dalamPotret(callable $callback): mixed
    {
        // SET TRANSACTION tanpa SESSION hanya berlaku untuk transaksi
        // berikutnya. REPEATABLE READ sudah bawaan InnoDB, tetapi ditulis
        // eksplisit supaya rekap tidak diam-diam berubah bila bawaan server
        // diganti; READ ONLY menegaskan rekap tidak menulis apa pun. Harus di
        // luar transaksi lain: MySQL menolak SET TRANSACTION di tengah
        // transaksi yang sedang berjalan.
        DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');

        return DB::transaction($callback);
    }

    public function jumlahSpkMasuk(DateTimeImmutable $mulai, DateTimeImmutable $akhir): int
    {
        return self::dalamRentang(DB::table('work_orders'), 'created_at', $mulai, $akhir)
            ->where('status', '<>', 'CANCELLED')->count();
    }

    public function jumlahLinimasa(DateTimeImmutable $mulai, DateTimeImmutable $akhir): array
    {
        $hasil = ['DONE' => 0, 'PICKED_UP' => 0, 'CANCELLED' => 0];
        $rows = self::dalamRentang(DB::table('work_order_status_logs'), 'created_at', $mulai, $akhir)
            ->whereIn('to_status', array_keys($hasil))
            ->groupBy('to_status')
            ->selectRaw('to_status, COUNT(*) AS jumlah')
            ->get();
        foreach ($rows as $row) {
            $hasil[$row->to_status] = (int) $row->jumlah;
        }

        return $hasil;
    }

    public function nilaiSelesai(DateTimeImmutable $mulai, DateTimeImmutable $akhir): array
    {
        // service_subtotal dan part_subtotal disimpan di work_orders dan
        // terkunci sejak DONE, jadi tidak perlu menjumlahkan item.
        $row = DB::table('work_orders as w')
            ->whereIn('w.work_order_id', self::selesai($mulai, $akhir))
            ->selectRaw('CAST(COALESCE(SUM(w.service_subtotal), 0) AS SIGNED) AS jasa,
                CAST(COALESCE(SUM(w.part_subtotal), 0) AS SIGNED) AS part')
            ->first();

        return ['serviceTotal' => (int) $row->jasa, 'partTotal' => (int) $row->part];
    }

    public function modalSelesai(DateTimeImmutable $mulai, DateTimeImmutable $akhir): array
    {
        // Harga beli yang dipakai adalah salinan di item (saat part
        // ditambahkan ke SPK), bukan harga beli katalog sekarang.
        $row = DB::table('work_order_items as i')
            ->where('i.type', 'PART')
            ->whereIn('i.work_order_id', self::selesai($mulai, $akhir))
            ->selectRaw('CAST(COALESCE(SUM(i.cost_price * i.quantity), 0) AS SIGNED) AS modal,
                COUNT(CASE WHEN i.cost_price = 0 THEN 1 END) AS tanpa_modal')
            ->first();

        return ['partCostTotal' => (int) $row->modal, 'partItemsWithoutCost' => (int) $row->tanpa_modal];
    }

    public function pembayaranPerMetode(DateTimeImmutable $mulai, DateTimeImmutable $akhir): array
    {
        $hasil = ['cash' => 0, 'transfer' => 0, 'qris' => 0];
        $rows = self::dalamRentang(DB::table('payments'), 'created_at', $mulai, $akhir)
            ->groupBy('method')
            ->selectRaw('method, CAST(SUM(amount) AS SIGNED) AS jumlah')
            ->get();
        foreach ($rows as $row) {
            $hasil[$row->method] = (int) $row->jumlah;
        }

        return $hasil;
    }

    public function jasaTerlaris(DateTimeImmutable $mulai, DateTimeImmutable $akhir, int $batas): array
    {
        // Dikelompokkan per serviceId dengan nama jasa SAAT INI (bukan
        // salinan di item), supaya jasa yang diganti namanya tetap satu baris.
        return DB::table('work_order_items as i')
            ->join('services as s', 's.service_id', '=', 'i.service_id')
            ->where('i.type', 'SERVICE')
            ->whereIn('i.work_order_id', self::selesai($mulai, $akhir))
            ->groupBy('i.service_id', 's.name')
            ->selectRaw('i.service_id, s.name,
                CAST(SUM(i.quantity) AS SIGNED) AS jumlah,
                CAST(SUM(i.subtotal) AS SIGNED) AS pendapatan')
            ->orderByDesc('jumlah')->orderByDesc('pendapatan')->orderBy('i.service_id')
            ->limit($batas)
            ->get()
            ->map(fn (object $row): array => [
                'serviceId' => $row->service_id,
                'name' => $row->name,
                'quantity' => (int) $row->jumlah,
                'revenue' => (int) $row->pendapatan,
            ])->all();
    }

    public function partTerlaris(DateTimeImmutable $mulai, DateTimeImmutable $akhir, int $batas): array
    {
        return DB::table('work_order_items as i')
            ->join('parts as p', 'p.part_id', '=', 'i.part_id')
            ->where('i.type', 'PART')
            ->whereIn('i.work_order_id', self::selesai($mulai, $akhir))
            ->groupBy('i.part_id', 'p.name')
            ->selectRaw('i.part_id, p.name,
                CAST(SUM(i.quantity) AS SIGNED) AS jumlah,
                CAST(SUM(i.subtotal) AS SIGNED) AS pendapatan,
                CAST(SUM(i.cost_price * i.quantity) AS SIGNED) AS modal')
            ->orderByDesc('jumlah')->orderByDesc('pendapatan')->orderBy('i.part_id')
            ->limit($batas)
            ->get()
            ->map(fn (object $row): array => [
                'partId' => $row->part_id,
                'name' => $row->name,
                'quantity' => (int) $row->jumlah,
                'revenue' => (int) $row->pendapatan,
                'cost' => (int) $row->modal,
            ])->all();
    }

    public function selesaiPerMekanik(DateTimeImmutable $mulai, DateTimeImmutable $akhir): array
    {
        // Mekanik tidak bisa diganti sesudah DONE, jadi mekanik di work_orders
        // adalah yang menyelesaikannya. Urutan diserahkan ke database (nama
        // dengan collation utf8mb4_0900_ai_ci) supaya sama dengan backend
        // lain; baris tanpa mekanik selalu terakhir.
        return DB::table('work_orders as w')
            ->leftJoin('staff as st', 'st.staff_id', '=', 'w.mechanic_staff_id')
            ->whereIn('w.work_order_id', self::selesai($mulai, $akhir))
            ->groupBy('w.mechanic_staff_id', 'st.name')
            ->selectRaw('w.mechanic_staff_id, st.name, COUNT(*) AS jumlah')
            ->orderByRaw('w.mechanic_staff_id IS NULL')
            ->orderByDesc('jumlah')->orderBy('st.name')->orderBy('w.mechanic_staff_id')
            ->get()
            ->map(fn (object $row): array => [
                'mechanic' => $row->mechanic_staff_id === null ? null : ['staffId' => $row->mechanic_staff_id, 'name' => $row->name],
                'doneCount' => (int) $row->jumlah,
            ])->all();
    }

    /**
     * Subquery ID SPK selesai hari itu. Status DONE tidak bisa mundur atau
     * dibatalkan, jadi tiap SPK paling banyak punya satu baris DONE; whereIn
     * tetap dipakai (bukan JOIN) supaya baris SPK tidak pernah terhitung dua
     * kali.
     */
    private static function selesai(DateTimeImmutable $mulai, DateTimeImmutable $akhir): Builder
    {
        return self::dalamRentang(DB::table('work_order_status_logs'), 'created_at', $mulai, $akhir)
            ->where('to_status', 'DONE')->select('work_order_id');
    }

    /** Rentang setengah terbuka [mulai, akhir), seperti definisi hari WIB di spec. */
    private static function dalamRentang(Builder $query, string $kolom, DateTimeImmutable $mulai, DateTimeImmutable $akhir): Builder
    {
        return $query->where($kolom, '>=', Time::toDb($mulai))->where($kolom, '<', Time::toDb($akhir));
    }
}
