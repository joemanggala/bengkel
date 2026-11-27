<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Outlet\Contracts\OutletRepositoryInterface;
use App\Modules\Servis\Contracts\ServisRepositoryInterface;
use App\Modules\WhatsApp\JenisPesan;
use App\Modules\WhatsApp\KendaraanPesan;
use App\Modules\WhatsApp\Templat;
use App\Support\Config\Settings;
use LogicException;

/**
 * Menyusun pesan WhatsApp SPK (dibuat, siap diambil, nota) dari data SAAT
 * pesan dikirim: nama pelanggan, kendaraan, profil outlet, item, pembayaran,
 * dan token lacak terbaru (spec/whatsapp.md bagian 3). Pengiriman otomatis
 * dan kirim ulang kasir memakai susunan yang sama, jadi isinya selalu sama
 * huruf demi huruf.
 */
final class PesanSpk
{
    public function __construct(
        private readonly ServisRepositoryInterface $repository,
        private readonly OutletRepositoryInterface $outlet,
        private readonly Settings $settings,
    ) {}

    /**
     * @param  string|null  $phone  nomor tujuan khusus (kirim ulang); null = nomor pelanggan saat ini
     * @return array{0: string, 1: string} nomor tujuan dan isi pesan
     */
    public function susun(JenisPesan $jenis, string $workOrderId, ?string $phone = null): array
    {
        $r = $this->repository->baris($workOrderId) ?? throw new LogicException('SPK '.$workOrderId.' hilang');
        $outlet = $this->outlet->ambil();
        $tautan = Templat::tautanLacak($this->settings->publicWebUrl, $r->tracking_token);
        $kendaraan = new KendaraanPesan($r->plate_display, $r->brand, $r->model);

        $isi = match ($jenis) {
            JenisPesan::SpkDibuat => Templat::spkDibuat($outlet, $r->number, $r->customer_name, $kendaraan, $r->estimated_done_at, $tautan),
            JenisPesan::SiapDiambil => Templat::siapDiambil($outlet, $r->number, $r->customer_name, $r->plate_display,
                (int) $r->total, (int) $r->paid_amount, $tautan),
            JenisPesan::Nota => Templat::nota(
                $outlet,
                $r->number,
                $r->customer_name,
                $kendaraan,
                $r->created_at,
                StatusSpk::from($r->status),
                array_map(fn (object $i): array => [
                    'name' => $i->item_name,
                    'quantity' => (int) $i->quantity,
                    'price' => (int) $i->price,
                    'subtotal' => (int) $i->subtotal,
                ], $this->repository->item($workOrderId)),
                (int) $r->service_subtotal,
                (int) $r->part_subtotal,
                (int) $r->paid_amount,
                $tautan,
            ),
            default => throw new LogicException('jenis pesan '.$jenis->value.' bukan pesan SPK'),
        };

        return [$phone ?? $r->customer_phone, $isi];
    }
}
