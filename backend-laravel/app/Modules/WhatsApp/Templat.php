<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\WhatsApp;

use App\Modules\Outlet\ProfilOutlet;
use App\Modules\Servis\StatusSpk;
use App\Support\Format\IndonesianFormat;
use App\Support\Time\Time;
use App\Support\Time\Wib;

/**
 * Isi lima pesan WhatsApp, byte demi byte sesuai spec/whatsapp.md bagian 5.
 *
 * Pesan terdiri dari blok yang dipisah satu baris kosong. Baris opsional
 * (null) dihilangkan; blok yang semua barisnya hilang dihapus bersama baris
 * kosong di depannya, jadi tidak pernah ada dua baris kosong berurutan atau
 * baris kosong di akhir pesan. Teks yang tersimpan (nama, alamat, alasan,
 * kaki nota) ditulis apa adanya, termasuk pergantian baris di dalamnya.
 *
 * Kelas ini murni: semua nilai diterima dari pemanggil, yang membacanya saat
 * pesan dikirim (data pelanggan, outlet, item, dan token lacak saat itu).
 */
final class Templat
{
    /** 5.1 booking_confirmed. Tidak memuat nama, merek, atau keluhan ketikan pemesan (0a-11). */
    public static function bookingDikonfirmasi(ProfilOutlet $outlet, string $number, string $plate, string $visitDate, ?string $serviceName): string
    {
        return self::susun([
            [$outlet->name, 'Booking '.$number],
            ['Halo, booking servis kamu untuk '.$plate.' pada '.Wib::formatDate($visitDate).' sudah dikonfirmasi.'],
            [self::opsional('Jasa: ', $serviceName)],
            [self::opsional('Alamat: ', $outlet->address), self::opsional('Jam buka: ', $outlet->openingHours)],
        ]);
    }

    /** 5.2 booking_rejected. */
    public static function bookingDitolak(ProfilOutlet $outlet, string $number, string $plate, string $visitDate, string $rejectReason, string $publicWebUrl): string
    {
        return self::susun([
            [$outlet->name, 'Booking '.$number],
            ['Halo, mohon maaf, booking servis kamu untuk '.$plate.' pada '.Wib::formatDate($visitDate).' belum bisa kami terima.'],
            ['Alasan: '.$rejectReason],
            ['Silakan booking ulang di '.$publicWebUrl.'/booking'],
        ]);
    }

    /**
     * 5.3 work_order_created.
     *
     * @param  string|null  $estimatedDoneAt  nilai DATETIME(3) UTC dari database, atau null
     */
    public static function spkDibuat(ProfilOutlet $outlet, string $number, string $customerName, KendaraanPesan $kendaraan, ?string $estimatedDoneAt, string $tautanLacak): string
    {
        return self::susun([
            [$outlet->name, 'SPK '.$number],
            ['Halo '.$customerName.', kendaraan kamu sudah kami terima untuk diservis.'],
            [
                'Kendaraan: '.$kendaraan->teks(),
                $estimatedDoneAt === null ? null : 'Estimasi selesai: '.Wib::formatDateTime(Time::fromDb($estimatedDoneAt)),
            ],
            ['Pantau status servis dan nota di:', $tautanLacak],
        ]);
    }

    /** 5.4 work_order_done. */
    public static function siapDiambil(ProfilOutlet $outlet, string $number, string $customerName, string $plate, int $total, int $paidAmount, string $tautanLacak): string
    {
        return self::susun([
            [$outlet->name, 'SPK '.$number],
            ['Halo '.$customerName.', servis '.$plate.' sudah selesai dan kendaraan siap diambil.'],
            [
                'Total: '.IndonesianFormat::rupiah($total),
                'Dibayar: '.IndonesianFormat::rupiah($paidAmount),
                'Sisa: '.IndonesianFormat::rupiah($total - $paidAmount),
            ],
            ['Rincian dan nota:', $tautanLacak],
            [self::opsional('Jam buka: ', $outlet->openingHours)],
        ]);
    }

    /**
     * 5.5 receipt. Harga beli tidak pernah ada di nota.
     *
     * @param  string  $createdAt  waktu SPK dibuat, DATETIME(3) UTC dari database
     * @param  list<array{name: string, quantity: int, price: int, subtotal: int}>  $items  urut nomor baris
     */
    public static function nota(
        ProfilOutlet $outlet,
        string $number,
        string $customerName,
        KendaraanPesan $kendaraan,
        string $createdAt,
        StatusSpk $status,
        array $items,
        int $serviceSubtotal,
        int $partSubtotal,
        int $paidAmount,
        string $tautanLacak,
    ): string {
        $total = $serviceSubtotal + $partSubtotal;
        $baris = array_map(fn (array $i): string => sprintf('- %s: %d x %s = %s',
            $i['name'], $i['quantity'], IndonesianFormat::rupiah($i['price']), IndonesianFormat::rupiah($i['subtotal'])), $items);

        return self::susun([
            [$outlet->name, 'Nota SPK '.$number],
            ['Halo '.$customerName.', terima kasih sudah servis di '.$outlet->name.'.'],
            [
                'Kendaraan: '.$kendaraan->teks(),
                'Waktu: '.Wib::formatDateTime(Time::fromDb($createdAt)),
                'Status: '.$status->label(),
            ],
            $baris === [] ? ['Belum ada item.'] : $baris,
            [
                'Jasa: '.IndonesianFormat::rupiah($serviceSubtotal),
                'Sparepart: '.IndonesianFormat::rupiah($partSubtotal),
                'Total: '.IndonesianFormat::rupiah($total),
                'Dibayar: '.IndonesianFormat::rupiah($paidAmount),
                'Sisa: '.IndonesianFormat::rupiah($total - $paidAmount),
            ],
            ['Nota online:', $tautanLacak],
            [self::opsional('', $outlet->receiptFooter)],
        ]);
    }

    /** {tautanLacak}: PUBLIC_WEB_URL (sudah tanpa garis miring akhir) + /servis/{token}. */
    public static function tautanLacak(string $publicWebUrl, string $trackingToken): string
    {
        return $publicWebUrl.'/servis/'.$trackingToken;
    }

    /** Baris opsional: hilang bila nilainya kosong atau null. */
    private static function opsional(string $awalan, ?string $nilai): ?string
    {
        return $nilai === null || $nilai === '' ? null : $awalan.$nilai;
    }

    /** @param  list<list<string|null>>  $blok */
    private static function susun(array $blok): string
    {
        $teks = [];
        foreach ($blok as $baris) {
            $ada = array_values(array_filter($baris, fn (?string $b): bool => $b !== null));
            if ($ada !== []) {
                $teks[] = implode("\n", $ada);
            }
        }

        return implode("\n\n", $teks);
    }
}
