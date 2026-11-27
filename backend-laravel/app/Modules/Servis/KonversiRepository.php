<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Booking\StatusBooking;
use App\Modules\Servis\Contracts\KonversiRepositoryInterface;
use App\Support\Database\SqlError;
use App\Support\Database\Transaksi;
use Illuminate\Support\Facades\DB;
use Throwable;

final class KonversiRepository implements KonversiRepositoryInterface
{
    /**
     * Seperti Transaksi::jalankan, ditambah galat kunci ganda nomor HP
     * pelanggan atau kunci plat. Percobaan berikutnya menemukan baris yang
     * dibuat permintaan lain itu, lalu memakainya (atau menolak 409 bila
     * platnya ternyata milik pelanggan lain). Batas ulangnya sama dengan
     * deadlock: paling banyak tiga kali sesudah percobaan pertama.
     */
    public function transaksiUlang(callable $callback): mixed
    {
        for ($percobaan = 0; ; $percobaan++) {
            try {
                return DB::transaction($callback);
            } catch (Throwable $e) {
                $bentrok = SqlError::isConcurrencyConflict($e)
                    || SqlError::isDuplicateKey($e, 'customers_phone_key')
                    || SqlError::isDuplicateKey($e, 'vehicles_plate_key_key');
                if ($percobaan >= Transaksi::MAX_RETRIES || ! $bentrok) {
                    throw $e;
                }
                usleep(random_int(10_000, 50_000));
            }
        }
    }

    public function adaBooking(string $bookingId): bool
    {
        return DB::table('bookings')->where('booking_id', $bookingId)->exists();
    }

    public function kunciBooking(string $bookingId): ?object
    {
        return DB::table('bookings')->where('booking_id', $bookingId)->lockForUpdate()->first([
            'status', 'customer_name', 'customer_phone', 'vehicle_type', 'plate_display', 'plate_key',
            'vehicle_brand', 'vehicle_model', 'service_id', 'complaint',
        ]);
    }

    /**
     * FOR UPDATE pada indeks unik nomor HP juga mengunci "celah" bila nomor
     * itu belum ada, sehingga dua konversi serentak untuk nomor baru yang
     * sama saling menunggu; bila keduanya tetap sempat INSERT, indeks unik
     * menolak yang kedua (1062) dan transaksinya diulang.
     */
    public function kunciPelanggan(string $phone): ?string
    {
        $id = DB::table('customers')->where('phone', $phone)->lockForUpdate()->value('customer_id');

        return $id === null ? null : (string) $id;
    }

    public function simpanPelanggan(string $customerId, string $name, string $phone, string $now): void
    {
        DB::table('customers')->insert([
            'customer_id' => $customerId,
            'name' => $name,
            'phone' => $phone,
            'address' => '',
            'notes' => '',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function kunciKendaraan(string $plateKey): ?object
    {
        return DB::table('vehicles')->where('plate_key', $plateKey)->lockForUpdate()->first(['vehicle_id', 'customer_id']);
    }

    /** Jenis, plat, merek, dan tipe dari booking; tahun null dan warna kosong. */
    public function simpanKendaraan(string $vehicleId, string $customerId, object $booking, string $now): void
    {
        DB::table('vehicles')->insert([
            'vehicle_id' => $vehicleId,
            'customer_id' => $customerId,
            'type' => $booking->vehicle_type,
            'plate_display' => $booking->plate_display,
            'plate_key' => $booking->plate_key,
            'brand' => $booking->vehicle_brand,
            'model' => $booking->vehicle_model,
            'year' => null,
            'color' => '',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function tandaiJadiSpk(string $bookingId, string $workOrderId, string $staffId, string $now): void
    {
        DB::table('bookings')->where('booking_id', $bookingId)->update([
            'status' => StatusBooking::JadiSpk->value,
            'work_order_id' => $workOrderId,
            'handled_by_staff_id' => $staffId,
            'updated_at' => $now,
        ]);
    }
}
