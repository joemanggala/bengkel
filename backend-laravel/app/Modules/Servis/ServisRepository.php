<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Servis\Contracts\ServisRepositoryInterface;
use App\Modules\Stok\JenisPergerakan;
use App\Support\Database\Like;
use App\Support\Database\Transaksi;
use App\Support\Http\Page;
use App\Support\Security\Uuid;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * SQL modul SPK. Tidak tahu soal aturan bisnis: urutan kunci dan pemeriksaan
 * ditentukan service, repository hanya menjalankan query yang diminta.
 *
 * Data pelanggan, kendaraan, dan staf dibaca langsung dari tabelnya (bukan
 * salinan), karena rincian SPK dan pesan WhatsApp selalu memakai data saat
 * ini; yang disalin ke SPK hanya item (nama, harga, harga beli).
 */
final class ServisRepository implements ServisRepositoryInterface
{
    /** Kunci penghitung nomor SPK di tabel counters. */
    private const KUNCI_NOMOR = 'work_order_number';

    /** Kolom satu baris daftar SPK (SpkRingkas). */
    private const KOLOM_RINGKAS = [
        'w.work_order_id', 'w.number', 'w.status', 'w.complaint', 'w.total', 'w.paid_amount',
        'w.estimated_done_at', 'w.created_at', 'w.updated_at',
        'c.customer_id', 'c.name as customer_name', 'c.phone as customer_phone',
        'v.vehicle_id', 'v.type as vehicle_type', 'v.plate_display', 'v.brand', 'v.model',
        'w.mechanic_staff_id', 'm.name as mechanic_name',
    ];

    public function transaction(callable $callback): mixed
    {
        return Transaksi::jalankan($callback);
    }

    // --- Baca -------------------------------------------------------------------

    public function cariNomor(string $number): ?DasarSpk
    {
        $row = DB::table('work_orders')->where('number', $number)->first(['work_order_id', 'number', 'mechanic_staff_id', 'status']);

        return $row === null ? null : new DasarSpk($row->work_order_id, $row->number, $row->mechanic_staff_id, StatusSpk::from($row->status));
    }

    public function cariToken(string $trackingToken): ?string
    {
        $id = DB::table('work_orders')->where('tracking_token', $trackingToken)->value('work_order_id');

        return $id === null ? null : (string) $id;
    }

    public function baris(string $workOrderId): ?object
    {
        return DB::table('work_orders as w')
            ->join('customers as c', 'c.customer_id', '=', 'w.customer_id')
            ->join('vehicles as v', 'v.vehicle_id', '=', 'w.vehicle_id')
            ->join('staff as p', 'p.staff_id', '=', 'w.created_by_staff_id')
            ->leftJoin('staff as m', 'm.staff_id', '=', 'w.mechanic_staff_id')
            // Asal booking dibaca dari bookings.work_order_id (unik), bukan disimpan di SPK (0a-13).
            ->leftJoin('bookings as bk', 'bk.work_order_id', '=', 'w.work_order_id')
            ->where('w.work_order_id', $workOrderId)
            ->first([
                'w.work_order_id', 'w.number', 'w.status', 'w.complaint', 'w.diagnosis', 'w.odometer',
                'w.estimated_done_at', 'w.service_subtotal', 'w.part_subtotal', 'w.total', 'w.paid_amount',
                'w.cancel_reason', 'w.tracking_token', 'w.created_at', 'w.updated_at',
                'c.customer_id', 'c.name as customer_name', 'c.phone as customer_phone',
                'v.vehicle_id', 'v.type as vehicle_type', 'v.plate_display', 'v.brand', 'v.model', 'v.year', 'v.color',
                'w.mechanic_staff_id', 'm.name as mechanic_name',
                'w.created_by_staff_id', 'p.name as creator_name',
                'bk.booking_id', 'bk.number as booking_number',
            ]);
    }

    public function item(string $workOrderId): array
    {
        return DB::table('work_order_items')->where('work_order_id', $workOrderId)->orderBy('line_no')
            ->get(['work_order_item_id', 'type', 'service_id', 'part_id', 'item_name', 'price', 'quantity', 'subtotal', 'created_at'])
            ->all();
    }

    public function pembayaran(string $workOrderId): array
    {
        return DB::table('payments as py')->join('staff as s', 's.staff_id', '=', 'py.staff_id')
            ->where('py.work_order_id', $workOrderId)
            ->orderBy('py.created_at')->orderBy('py.payment_id')
            ->get(['py.payment_id', 'py.amount', 'py.method', 'py.created_at', 'py.staff_id', 's.name as staff_name'])
            ->all();
    }

    /**
     * Tidak ada kolom urutan penulisan, jadi baris pembuka (from_status NULL)
     * didahulukan bila waktunya kebetulan sama dengan perpindahan pertama.
     */
    public function linimasa(string $workOrderId): array
    {
        return DB::table('work_order_status_logs as l')->join('staff as s', 's.staff_id', '=', 'l.staff_id')
            ->where('l.work_order_id', $workOrderId)
            ->orderBy('l.created_at')->orderByRaw('l.from_status IS NOT NULL')
            ->get(['l.from_status', 'l.to_status', 'l.note', 'l.created_at', 'l.staff_id', 's.name as staff_name'])
            ->all();
    }

    /**
     * COUNT(*) memakai query yang sama dengan halaman, supaya meta.total selalu
     * cocok dengan filter. Jumlah item dibaca lewat subquery per baris (paling
     * banyak 50 baris per halaman), bukan JOIN + GROUP BY, supaya COUNT tetap
     * sederhana.
     */
    public function daftar(FilterDaftar $filter, Page $page): array
    {
        $query = DB::table('work_orders as w')
            ->join('customers as c', 'c.customer_id', '=', 'w.customer_id')
            ->join('vehicles as v', 'v.vehicle_id', '=', 'w.vehicle_id')
            ->leftJoin('staff as m', 'm.staff_id', '=', 'w.mechanic_staff_id');
        $this->saring($query, $filter);

        $total = (clone $query)->count();
        $arah = $filter->terlama ? 'asc' : 'desc';
        $rows = $query->orderBy('w.created_at', $arah)->orderBy('w.work_order_id', $arah)
            ->offset($page->offset())->limit($page->limit)
            ->select(self::KOLOM_RINGKAS)
            ->selectRaw('(SELECT COUNT(*) FROM work_order_items i WHERE i.work_order_id = w.work_order_id) AS item_count')
            ->get()->all();

        return [$rows, $total];
    }

    private function saring(Builder $query, FilterDaftar $filter): void
    {
        if ($filter->vehicleId !== null) {
            $query->where('w.vehicle_id', $filter->vehicleId);
        }
        if ($filter->status !== null) {
            $query->where('w.status', $filter->status);
        }
        if ($filter->lingkup !== null) {
            $query->whereIn('w.status', $filter->lingkup);
        }
        if ($filter->mechanicId !== null) {
            $query->where('w.mechanic_staff_id', $filter->mechanicId);
        }
        if ($filter->rentang !== null) {
            $query->where('w.created_at', '>=', $filter->rentang[0])->where('w.created_at', '<', $filter->rentang[1]);
        }
        $term = $filter->search;
        if ($term !== null && ! $term->isEmpty()) {
            // Sebuah baris cocok bila salah satu aturan cocok; turunan yang
            // null berarti term itu tidak pernah cocok dengan kolom tersebut.
            $query->where(function (Builder $w) use ($term): void {
                $w->whereRaw('c.name '.Like::CONTAINS, [$term->forName()]);
                $nomor = $term->forNumber();
                if ($nomor !== null) {
                    $w->orWhereRaw('w.number '.Like::CONTAINS, [$nomor]);
                }
                $plat = $term->forPlate();
                if ($plat !== null) {
                    $w->orWhereRaw('v.plate_key '.Like::CONTAINS, [$plat]);
                }
                $hp = $term->forPhone();
                if ($hp !== null) {
                    $w->orWhereRaw('c.phone '.Like::CONTAINS, [$hp]);
                }
            });
        }
    }

    public function pemilikKendaraan(string $vehicleId): ?string
    {
        $id = DB::table('vehicles')->where('vehicle_id', $vehicleId)->value('customer_id');

        return $id === null ? null : (string) $id;
    }

    public function staf(string $staffId): ?object
    {
        return DB::table('staff')->where('staff_id', $staffId)->first(['role', 'is_active']);
    }

    public function jasa(string $serviceId): ?object
    {
        return DB::table('services')->where('service_id', $serviceId)->first(['name', 'price', 'is_active']);
    }

    public function part(string $partId, bool $kunci = false): ?object
    {
        $query = DB::table('parts')->where('part_id', $partId);
        if ($kunci) {
            $query->lockForUpdate();
        }

        return $query->first(['name', 'unit', 'price', 'cost_price', 'stock', 'is_active']);
    }

    public function itemSpk(string $workOrderId, string $itemId): ?object
    {
        return DB::table('work_order_items')->where('work_order_item_id', $itemId)->where('work_order_id', $workOrderId)
            ->first(['type', 'part_id', 'quantity', 'subtotal']);
    }

    // --- Tulis --------------------------------------------------------------------

    /**
     * Baris penghitung dikunci (SELECT … FOR UPDATE) lalu dinaikkan di
     * transaksi yang sama dengan INSERT SPK: SPK yang dibuat bersamaan
     * menunggu giliran dan mendapat nomor berurutan, dan bila pembuatan SPK
     * gagal nomornya ikut kembali, jadi tidak pernah ada celah.
     */
    public function nomorBaru(): int
    {
        $nilai = DB::table('counters')->where('name', self::KUNCI_NOMOR)->lockForUpdate()->value('value');
        if ($nilai === null) {
            throw new RuntimeException('baris counters work_order_number tidak ada; jalankan migration');
        }
        $baru = (int) $nilai + 1;
        DB::table('counters')->where('name', self::KUNCI_NOMOR)->update(['value' => $baru]);

        return $baru;
    }

    public function simpanSpk(string $id, string $number, string $trackingToken, SpkBaru $spk, string $staffId, string $now): void
    {
        DB::table('work_orders')->insert([
            'work_order_id' => $id,
            'number' => $number,
            'customer_id' => $spk->customerId,
            'vehicle_id' => $spk->vehicleId,
            'mechanic_staff_id' => $spk->mechanicId,
            'status' => StatusSpk::Antre->value,
            'complaint' => $spk->complaint,
            'diagnosis' => '',
            'odometer' => $spk->odometer,
            'estimated_done_at' => $spk->estimatedDoneAt,
            'service_subtotal' => 0,
            'part_subtotal' => 0,
            'total' => 0,
            'paid_amount' => 0,
            'cancel_reason' => null,
            'tracking_token' => $trackingToken,
            'created_by_staff_id' => $staffId,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function catatLinimasa(string $workOrderId, ?string $dari, string $ke, string $staffId, string $note, string $now): void
    {
        DB::table('work_order_status_logs')->insert([
            'work_order_status_log_id' => Uuid::new(),
            'work_order_id' => $workOrderId,
            'from_status' => $dari,
            'to_status' => $ke,
            'staff_id' => $staffId,
            'note' => $note,
            'created_at' => $now,
        ]);
    }

    /**
     * Yang dikunci hanya baris SPK itu, jadi SPK lain tidak ikut tertahan. Dua
     * permintaan untuk SPK yang sama berjalan satu per satu, dan yang kedua
     * melihat keadaan sesudah yang pertama.
     */
    public function kunci(string $workOrderId): ?SpkTerkunci
    {
        $row = DB::table('work_orders')->where('work_order_id', $workOrderId)->lockForUpdate()
            ->first(['status', 'mechanic_staff_id', 'service_subtotal', 'part_subtotal', 'paid_amount']);

        return $row === null ? null : new SpkTerkunci($workOrderId, StatusSpk::from($row->status), $row->mechanic_staff_id,
            (int) $row->service_subtotal, (int) $row->part_subtotal, (int) $row->paid_amount);
    }

    public function ubah(string $workOrderId, array $kolom, string $now): void
    {
        DB::table('work_orders')->where('work_order_id', $workOrderId)->update([...$kolom, 'updated_at' => $now]);
    }

    public function jumlahItem(string $workOrderId): int
    {
        return DB::table('work_order_items')->where('work_order_id', $workOrderId)->count();
    }

    /**
     * Nomor baris = nomor terbesar yang ada + 1, sehingga item baru selalu di
     * akhir dan nomor item lain tidak pernah bergeser. Dibaca di bawah kunci
     * baris SPK, jadi dua item yang ditambahkan bersamaan tidak bentrok.
     */
    public function simpanItem(string $workOrderId, string $itemId, array $item, string $staffId, string $now): void
    {
        $terakhir = (int) DB::table('work_order_items')->where('work_order_id', $workOrderId)->max('line_no');
        DB::table('work_order_items')->insert([
            'work_order_item_id' => $itemId,
            'work_order_id' => $workOrderId,
            'line_no' => $terakhir + 1,
            'type' => $item['type'],
            'service_id' => $item['service_id'],
            'part_id' => $item['part_id'],
            'item_name' => $item['item_name'],
            'price' => $item['price'],
            'cost_price' => $item['cost_price'],
            'quantity' => $item['quantity'],
            'subtotal' => $item['price'] * $item['quantity'],
            'created_by_staff_id' => $staffId,
            'created_at' => $now,
        ]);
    }

    public function hapusItem(string $itemId): void
    {
        DB::table('work_order_items')->where('work_order_item_id', $itemId)->delete();
    }

    public function hitungUlangTotal(string $workOrderId, string $now): void
    {
        $row = DB::table('work_order_items')->where('work_order_id', $workOrderId)
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'SERVICE' THEN subtotal ELSE 0 END), 0) AS jasa")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'PART' THEN subtotal ELSE 0 END), 0) AS part")
            ->first();
        // SUM() bertipe DECIMAL, yang terbaca sebagai teks.
        $jasa = (int) ($row->jasa ?? 0);
        $part = (int) ($row->part ?? 0);
        DB::table('work_orders')->where('work_order_id', $workOrderId)->update([
            'service_subtotal' => $jasa,
            'part_subtotal' => $part,
            'total' => $jasa + $part,
            'updated_at' => $now,
        ]);
    }

    /**
     * Stok dibaca ulang sesudah UPDATE di transaksi yang sama (baris sudah
     * dikunci pemanggil), sehingga stock_after selalu stok yang sebenarnya.
     */
    public function geserStok(string $partId, int $jumlah, string $workOrderId, string $staffId, string $now): void
    {
        DB::table('parts')->where('part_id', $partId)->update(['stock' => DB::raw('stock + '.$jumlah), 'updated_at' => $now]);
        $sesudah = (int) DB::table('parts')->where('part_id', $partId)->value('stock');
        DB::table('stock_movements')->insert([
            'stock_movement_id' => Uuid::new(),
            'part_id' => $partId,
            'type' => ($jumlah < 0 ? JenisPergerakan::Terpakai : JenisPergerakan::Kembali)->value,
            'quantity' => $jumlah,
            'stock_after' => $sesudah,
            'note' => '',
            'work_order_id' => $workOrderId,
            'staff_id' => $staffId,
            'created_at' => $now,
        ]);
    }

    public function partTertahan(string $workOrderId): array
    {
        $rows = DB::table('work_order_items')->where('work_order_id', $workOrderId)->where('type', 'PART')
            ->groupBy('part_id')->orderBy('part_id')
            ->selectRaw('part_id, SUM(quantity) AS jumlah')->get();

        $hasil = [];
        foreach ($rows as $row) {
            $hasil[(string) $row->part_id] = (int) $row->jumlah;
        }

        return $hasil;
    }

    public function simpanPembayaran(string $workOrderId, int $amount, string $method, string $staffId, string $now): void
    {
        DB::table('payments')->insert([
            'payment_id' => Uuid::new(),
            'work_order_id' => $workOrderId,
            'amount' => $amount,
            'method' => $method,
            'staff_id' => $staffId,
            'created_at' => $now,
        ]);
        DB::table('work_orders')->where('work_order_id', $workOrderId)
            ->update(['paid_amount' => DB::raw('paid_amount + '.$amount), 'updated_at' => $now]);
    }
}
