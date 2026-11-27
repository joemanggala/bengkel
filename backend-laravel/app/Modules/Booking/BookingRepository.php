<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking;

use App\Modules\Booking\Contracts\BookingRepositoryInterface;
use App\Support\Database\Like;
use App\Support\Database\Transaksi;
use App\Support\Http\Page;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class BookingRepository implements BookingRepositoryInterface
{
    /** Nama baris counters untuk nomor booking (dibuat migration). */
    private const PENGHITUNG = 'booking_number';

    /** Kolom yang dibutuhkan saat baris dikunci untuk perpindahan status dan pesan WhatsApp. */
    private const KOLOM_KUNCI = ['booking_id', 'number', 'status', 'customer_phone', 'plate_display', 'visit_date', 'service_name'];

    public function transaction(callable $callback): mixed
    {
        return Transaksi::jalankan($callback);
    }

    public function jasa(string $serviceId): ?object
    {
        return DB::table('services')->where('service_id', $serviceId)->first(['name', 'is_public', 'is_active']);
    }

    public function kunciPenghitung(): int
    {
        $nilai = DB::table('counters')->where('name', self::PENGHITUNG)->lockForUpdate()->value('value');
        if ($nilai === null) {
            throw new RuntimeException('baris counters booking_number tidak ada; jalankan migration');
        }

        return (int) $nilai;
    }

    public function simpanPenghitung(int $nilai): void
    {
        DB::table('counters')->where('name', self::PENGHITUNG)->update(['value' => $nilai]);
    }

    public function jumlahMenunggu(string $phone): int
    {
        // Memakai indeks bookings_phone_status_idx (customer_phone, status).
        return DB::table('bookings')->where('customer_phone', $phone)
            ->where('status', StatusBooking::Menunggu->value)->count();
    }

    public function simpanBaru(array $kolom): void
    {
        DB::table('bookings')->insert($kolom);
    }

    public function ada(string $bookingId): bool
    {
        return DB::table('bookings')->where('booking_id', $bookingId)->exists();
    }

    public function kunci(string $bookingId): ?object
    {
        return DB::table('bookings')->where('booking_id', $bookingId)->lockForUpdate()->first(self::KOLOM_KUNCI);
    }

    public function kunciDenganHash(string $tokenHash): ?object
    {
        return DB::table('bookings')->where('booking_token_hash', $tokenHash)->lockForUpdate()->first(self::KOLOM_KUNCI);
    }

    public function ubah(string $bookingId, array $perubahan): void
    {
        DB::table('bookings')->where('booking_id', $bookingId)->update($perubahan);
    }

    public function baca(string $bookingId): ?object
    {
        return self::pilih(DB::table('bookings as b'))->where('b.booking_id', $bookingId)->first();
    }

    public function bacaDenganHash(string $tokenHash): ?object
    {
        return self::pilih(DB::table('bookings as b'))->where('b.booking_token_hash', $tokenHash)->first();
    }

    public function daftar(FilterBooking $filter, Page $page): array
    {
        $query = DB::table('bookings as b');
        if ($filter->status !== null) {
            $query->where('b.status', $filter->status->value);
        }
        if ($filter->visitDate !== null) {
            $query->where('b.visit_date', $filter->visitDate);
        }
        $search = $filter->search;
        if (! $search->isEmpty()) {
            // Baris cocok bila salah satu aturan cocok (parameter Search di
            // spec). Turunan yang null berarti term itu tidak mungkin cocok
            // dengan kolom tersebut, jadi kondisinya tidak ditulis sama sekali.
            $query->where(function (Builder $atau) use ($search): void {
                $atau->whereRaw('b.customer_name '.Like::CONTAINS, [$search->forName()]);
                if (($nomor = $search->forNumber()) !== null) {
                    $atau->orWhereRaw('b.number '.Like::CONTAINS, [$nomor]);
                }
                if (($phone = $search->forPhone()) !== null) {
                    $atau->orWhereRaw('b.customer_phone '.Like::CONTAINS, [$phone]);
                }
                if (($plat = $search->forPlate()) !== null) {
                    $atau->orWhereRaw('b.plate_key '.Like::CONTAINS, [$plat]);
                }
            });
        }
        // Total dihitung dari tabel bookings saja, sebelum JOIN untuk tampilan.
        $total = (clone $query)->count();
        $rows = self::pilih($query)->orderByDesc('b.created_at')->orderByDesc('b.booking_id')
            ->offset($page->offset())->limit($page->limit)->get()->all();

        return [$rows, $total];
    }

    /**
     * Kolom untuk BookingDetail. Nama staf penangan dan nomor SPK dibaca
     * lewat JOIN (bukan disalin ke bookings), jadi selalu nilai saat ini.
     */
    private static function pilih(Builder $query): Builder
    {
        return $query
            ->leftJoin('staff as st', 'st.staff_id', '=', 'b.handled_by_staff_id')
            ->leftJoin('work_orders as wo', 'wo.work_order_id', '=', 'b.work_order_id')
            ->select([
                'b.booking_id', 'b.number', 'b.status', 'b.customer_name', 'b.customer_phone', 'b.vehicle_type',
                'b.plate_display', 'b.plate_key', 'b.vehicle_brand', 'b.vehicle_model', 'b.service_id',
                'b.service_name', 'b.visit_date', 'b.complaint', 'b.reject_reason', 'b.handled_by_staff_id',
                'st.name as handled_by_name', 'wo.number as work_order_number', 'b.created_at', 'b.updated_at',
            ]);
    }
}
