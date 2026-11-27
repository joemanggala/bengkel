<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking\Contracts;

use App\Modules\Booking\FilterBooking;
use App\Support\Http\Page;

/**
 * Akses tabel bookings (dan bacaan jasa untuk form booking). Langkah yang
 * harus terjadi bersama dijalankan service di dalam transaction(), memakai
 * metode berawalan kunci* yang mengunci baris sampai transaksi selesai.
 *
 * Baris yang dikembalikan baca(), bacaDenganHash(), dan daftar() memuat
 * kolom yang dibutuhkan BookingDetail untuk menyusun Booking dan
 * BookingPublik (termasuk nama staf penangan dan nomor SPK hasil konversi).
 */
interface BookingRepositoryInterface
{
    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function transaction(callable $callback): mixed;

    /** Jasa untuk rujukan serviceId: {name, is_public, is_active}, atau null bila tidak ada. */
    public function jasa(string $serviceId): ?object;

    /**
     * Mengunci baris counters booking_number (SELECT … FOR UPDATE) dan
     * mengembalikan nilainya. Kunci ini juga mutex batas booking menunggu
     * per nomor HP.
     */
    public function kunciPenghitung(): int;

    public function simpanPenghitung(int $nilai): void;

    /** Jumlah booking PENDING untuk nomor HP seragam ini. */
    public function jumlahMenunggu(string $phone): int;

    /** @param  array<string, mixed>  $kolom  baris bookings lengkap */
    public function simpanBaru(array $kolom): void;

    public function ada(string $bookingId): bool;

    /**
     * Baris booking dikunci (SELECT … FOR UPDATE): booking_id, number,
     * status, customer_phone, plate_display, visit_date, service_name.
     */
    public function kunci(string $bookingId): ?object;

    /** Seperti kunci(), dicari lewat hex SHA-256 token booking. */
    public function kunciDenganHash(string $tokenHash): ?object;

    /** @param  array<string, mixed>  $perubahan */
    public function ubah(string $bookingId, array $perubahan): void;

    public function baca(string $bookingId): ?object;

    public function bacaDenganHash(string $tokenHash): ?object;

    /**
     * Satu halaman booking yang cocok dengan filter, urut created_at terbaru
     * dulu lalu booking_id turun, beserta jumlah semua yang cocok.
     *
     * @return array{0: list<object>, 1: int}
     */
    public function daftar(FilterBooking $filter, Page $page): array;
}
