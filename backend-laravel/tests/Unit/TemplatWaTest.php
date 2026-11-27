<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Outlet\ProfilOutlet;
use App\Modules\Servis\StatusSpk;
use App\Modules\WhatsApp\JenisPesan;
use App\Modules\WhatsApp\KendaraanPesan;
use App\Modules\WhatsApp\Templat;
use PHPUnit\Framework\TestCase;

/** Isi pesan WhatsApp byte demi byte: ketujuh contoh di spec/whatsapp.md bagian 5. */
final class TemplatWaTest extends TestCase
{
    private const TOKEN = 'Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk';

    private static function outletLengkap(): ProfilOutlet
    {
        return new ProfilOutlet('Bengkel Maju Jaya', '', 'Jl. Merdeka No. 10, Bandung', null, 'Senin–Sabtu 08.00–17.00', '', 'Garansi servis 7 hari.');
    }

    private static function outletAwal(): ProfilOutlet
    {
        return new ProfilOutlet('Nama Bengkel', '', '', null, '', '', '');
    }

    public function test_booking_confirmed_with_service_and_full_outlet(): void
    {
        $this->assertSame(
            "Bengkel Maju Jaya\nBooking B-0007\n\n"
            ."Halo, booking servis kamu untuk B 1234 XYZ pada 28-11-2026 sudah dikonfirmasi.\n\n"
            ."Jasa: Ganti Oli\n\n"
            ."Alamat: Jl. Merdeka No. 10, Bandung\nJam buka: Senin–Sabtu 08.00–17.00",
            Templat::bookingDikonfirmasi(self::outletLengkap(), 'B-0007', 'B 1234 XYZ', '2026-11-28', 'Ganti Oli'),
        );
    }

    public function test_booking_confirmed_without_service_and_empty_outlet_drops_whole_blocks(): void
    {
        $this->assertSame(
            "Nama Bengkel\nBooking B-0008\n\nHalo, booking servis kamu untuk D 1 pada 01-12-2026 sudah dikonfirmasi.",
            Templat::bookingDikonfirmasi(self::outletAwal(), 'B-0008', 'D 1', '2026-12-01', null),
        );
    }

    public function test_booking_rejected(): void
    {
        $this->assertSame(
            "Bengkel Maju Jaya\nBooking B-0007\n\n"
            ."Halo, mohon maaf, booking servis kamu untuk B 1234 XYZ pada 28-11-2026 belum bisa kami terima.\n\n"
            ."Alasan: Bengkel tutup tanggal itu, silakan pilih tanggal lain.\n\n"
            .'Silakan booking ulang di https://bengkelku.id/booking',
            Templat::bookingDitolak(self::outletLengkap(), 'B-0007', 'B 1234 XYZ', '2026-11-28',
                'Bengkel tutup tanggal itu, silakan pilih tanggal lain.', 'https://bengkelku.id'),
        );
    }

    public function test_work_order_created_with_estimate(): void
    {
        $this->assertSame(
            "Bengkel Maju Jaya\nSPK S-0012\n\n"
            ."Halo Budi Santoso, kendaraan kamu sudah kami terima untuk diservis.\n\n"
            ."Kendaraan: B 1234 XYZ (Honda Vario 125)\nEstimasi selesai: 28-11-2026 15:00 WIB\n\n"
            ."Pantau status servis dan nota di:\nhttps://bengkelku.id/servis/".self::TOKEN,
            Templat::spkDibuat(self::outletLengkap(), 'S-0012', 'Budi Santoso', new KendaraanPesan('B 1234 XYZ', 'Honda', 'Vario 125'),
                '2026-11-28 08:00:00.000', Templat::tautanLacak('https://bengkelku.id', self::TOKEN)),
        );
    }

    public function test_work_order_created_without_estimate_and_model(): void
    {
        $this->assertSame(
            "Nama Bengkel\nSPK S-0001\n\nHalo Ani, kendaraan kamu sudah kami terima untuk diservis.\n\n"
            ."Kendaraan: D 1 (Toyota)\n\nPantau status servis dan nota di:\nhttp://localhost:3800/servis/".self::TOKEN,
            Templat::spkDibuat(self::outletAwal(), 'S-0001', 'Ani', new KendaraanPesan('D 1', 'Toyota', ''), null,
                Templat::tautanLacak('http://localhost:3800', self::TOKEN)),
        );
    }

    public function test_work_order_done(): void
    {
        $this->assertSame(
            "Bengkel Maju Jaya\nSPK S-0012\n\n"
            ."Halo Budi Santoso, servis B 1234 XYZ sudah selesai dan kendaraan siap diambil.\n\n"
            ."Total: Rp165.000\nDibayar: Rp50.000\nSisa: Rp115.000\n\n"
            ."Rincian dan nota:\nhttps://bengkelku.id/servis/".self::TOKEN."\n\n"
            .'Jam buka: Senin–Sabtu 08.00–17.00',
            Templat::siapDiambil(self::outletLengkap(), 'S-0012', 'Budi Santoso', 'B 1234 XYZ', 165_000, 50_000,
                Templat::tautanLacak('https://bengkelku.id', self::TOKEN)),
        );
    }

    public function test_receipt_with_items(): void
    {
        $items = [
            ['name' => 'Ganti Oli', 'quantity' => 1, 'price' => 35_000, 'subtotal' => 35_000],
            ['name' => 'Oli Mesin 10W-40 0,8 L', 'quantity' => 1, 'price' => 55_000, 'subtotal' => 55_000],
            ['name' => 'Kampas Rem Depan Vario', 'quantity' => 1, 'price' => 75_000, 'subtotal' => 75_000],
        ];

        $this->assertSame(
            "Bengkel Maju Jaya\nNota SPK S-0012\n\n"
            ."Halo Budi Santoso, terima kasih sudah servis di Bengkel Maju Jaya.\n\n"
            ."Kendaraan: B 1234 XYZ (Honda Vario 125)\nWaktu: 28-11-2026 08:15 WIB\nStatus: Selesai\n\n"
            ."- Ganti Oli: 1 x Rp35.000 = Rp35.000\n"
            ."- Oli Mesin 10W-40 0,8 L: 1 x Rp55.000 = Rp55.000\n"
            ."- Kampas Rem Depan Vario: 1 x Rp75.000 = Rp75.000\n\n"
            ."Jasa: Rp35.000\nSparepart: Rp130.000\nTotal: Rp165.000\nDibayar: Rp50.000\nSisa: Rp115.000\n\n"
            ."Nota online:\nhttps://bengkelku.id/servis/".self::TOKEN."\n\n"
            .'Garansi servis 7 hari.',
            Templat::nota(self::outletLengkap(), 'S-0012', 'Budi Santoso', new KendaraanPesan('B 1234 XYZ', 'Honda', 'Vario 125'),
                '2026-11-28 01:15:00.000', StatusSpk::Selesai, $items, 35_000, 130_000, 50_000,
                Templat::tautanLacak('https://bengkelku.id', self::TOKEN)),
        );
    }

    public function test_receipt_without_items_and_footer(): void
    {
        $this->assertSame(
            "Nama Bengkel\nNota SPK S-0013\n\n"
            ."Halo Ani, terima kasih sudah servis di Nama Bengkel.\n\n"
            ."Kendaraan: D 1 (Yamaha)\nWaktu: 28-11-2026 09:00 WIB\nStatus: Antre\n\n"
            ."Belum ada item.\n\n"
            ."Jasa: Rp0\nSparepart: Rp0\nTotal: Rp0\nDibayar: Rp0\nSisa: Rp0\n\n"
            ."Nota online:\nhttp://localhost:3800/servis/".self::TOKEN,
            Templat::nota(self::outletAwal(), 'S-0013', 'Ani', new KendaraanPesan('D 1', 'Yamaha', ''),
                '2026-11-28 02:00:00.000', StatusSpk::Antre, [], 0, 0, 0,
                Templat::tautanLacak('http://localhost:3800', self::TOKEN)),
        );
    }

    public function test_multiline_values_are_written_as_is(): void
    {
        $outlet = new ProfilOutlet('Nama Bengkel', '', "Jl. A\nBandung", null, '', '', "Baris 1\nBaris 2");

        $this->assertStringContainsString("Alamat: Jl. A\nBandung", Templat::bookingDikonfirmasi($outlet, 'B-0001', 'D 1', '2026-12-01', null));
        $this->assertStringEndsWith("\n\nBaris 1\nBaris 2", Templat::nota($outlet, 'S-0001', 'Ani', new KendaraanPesan('D 1', 'Yamaha', ''),
            '2026-11-28 02:00:00.000', StatusSpk::Antre, [], 0, 0, 0, 'http://x/servis/t'));
    }

    public function test_message_types_and_summary_keys(): void
    {
        $this->assertSame(['bookingConfirmed', 'bookingRejected', 'workOrderCreated', 'workOrderDone', 'receipt'],
            array_map(fn (JenisPesan $j): string => $j->kunciRingkasan(), JenisPesan::cases()));
        $this->assertSame([true, true, false, false, false], array_map(fn (JenisPesan $j): bool => $j->untukBooking(), JenisPesan::cases()));
    }
}
