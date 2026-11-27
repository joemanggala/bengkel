<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Servis\AturanSpk;
use App\Modules\Servis\StatusSpk;
use App\Modules\Sesi\Peran;
use App\Support\Http\ApiError;
use Closure;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Aturan 403/409 SPK beserta urutan pemeriksaannya: bila beberapa syarat
 * dilanggar sekaligus, kode yang menang harus sama dengan deskripsi operasi
 * di spec.
 */
final class AturanSpkTest extends TestCase
{
    /** Kode galat yang dilempar $aksi, atau "" bila lolos. */
    private static function kode(Closure $aksi): string
    {
        try {
            $aksi();

            return '';
        } catch (ApiError $e) {
            return $e->status.' '.$e->errorCode;
        }
    }

    /** @return array<string, array{StatusSpk, StatusSpk, Peran, int, int, string}> */
    public static function statusChanges(): array
    {
        $antre = StatusSpk::Antre;
        $kerja = StatusSpk::Dikerjakan;
        $tunggu = StatusSpk::MenungguPart;
        $selesai = StatusSpk::Selesai;
        $ambil = StatusSpk::Diambil;
        $batal = StatusSpk::Dibatalkan;
        $kasir = Peran::Kasir;
        $mekanik = Peran::Mekanik;

        return [
            'kasir mulai mengerjakan' => [$antre, $kerja, $kasir, 0, 0, ''],
            'mekanik mulai mengerjakan tanpa item' => [$antre, $kerja, $mekanik, 0, 0, ''],
            'mekanik menunggu part' => [$kerja, $tunggu, $mekanik, 1, 0, ''],
            'mekanik lanjut dari menunggu part' => [$tunggu, $kerja, $mekanik, 1, 0, ''],
            'mekanik menandai selesai walau belum lunas' => [$kerja, $selesai, $mekanik, 1, 50_000, ''],
            'pemilik menyerahkan yang lunas' => [$selesai, $ambil, Peran::Pemilik, 2, 0, ''],
            'total 0 boleh langsung diambil' => [$selesai, $ambil, $kasir, 1, 0, ''],
            'selesai tanpa item' => [$kerja, $selesai, $kasir, 0, 0, '409 work_order_empty'],
            'diambil belum lunas' => [$selesai, $ambil, $kasir, 1, 1, '409 not_paid_off'],
            'mekanik menyerahkan kendaraan' => [$selesai, $ambil, $mekanik, 1, 0, '403 forbidden'],
            'mekanik ke diambil dinilai sebelum transisi' => [$antre, $ambil, $mekanik, 0, 100, '403 forbidden'],
            'ke status yang sama' => [$kerja, $kerja, $kasir, 1, 0, '409 status_transition_invalid'],
            'melompat dari antre ke selesai' => [$antre, $selesai, $kasir, 1, 0, '409 status_transition_invalid'],
            'menunggu part langsung selesai' => [$tunggu, $selesai, $kasir, 1, 0, '409 status_transition_invalid'],
            'mundur dari selesai' => [$selesai, $kerja, $kasir, 1, 0, '409 status_transition_invalid'],
            'dari diambil' => [$ambil, $kerja, $kasir, 1, 0, '409 status_transition_invalid'],
            'dari dibatalkan' => [$batal, $kerja, $mekanik, 1, 0, '409 status_transition_invalid'],
            'transisi dinilai sebelum item kosong' => [$antre, $selesai, $kasir, 0, 0, '409 status_transition_invalid'],
            'transisi dinilai sebelum belum lunas' => [$kerja, $ambil, $kasir, 1, 100, '409 status_transition_invalid'],
        ];
    }

    #[DataProvider('statusChanges')]
    public function test_status_change_order_is_403_then_transition_then_preconditions(
        StatusSpk $from, StatusSpk $to, Peran $role, int $items, int $remaining, string $expected,
    ): void {
        $this->assertSame($expected, self::kode(fn () => AturanSpk::ubahStatus($from, $to, $role, $items, $remaining)));
    }

    public function test_cancel_needs_open_status_then_no_payments(): void
    {
        foreach ([StatusSpk::Antre, StatusSpk::Dikerjakan, StatusSpk::MenungguPart] as $status) {
            $this->assertSame('', self::kode(fn () => AturanSpk::batal($status, 0)), $status->value);
            $this->assertSame('409 has_payments', self::kode(fn () => AturanSpk::batal($status, 1)), $status->value);
        }
        foreach ([StatusSpk::Selesai, StatusSpk::Diambil, StatusSpk::Dibatalkan] as $status) {
            // Status dinilai lebih dulu, walau SPK juga sudah dibayar.
            $this->assertSame('409 status_transition_invalid', self::kode(fn () => AturanSpk::batal($status, 0)), $status->value);
            $this->assertSame('409 status_transition_invalid', self::kode(fn () => AturanSpk::batal($status, 10_000)), $status->value);
        }
    }

    public function test_items_and_patch_are_locked_from_done(): void
    {
        foreach (StatusSpk::cases() as $status) {
            $expected = $status->terbuka() ? '' : '409 work_order_locked';
            $this->assertSame($expected, self::kode(fn () => AturanSpk::ubahData($status)), $status->value);
        }
    }

    public function test_removing_an_item_never_drops_total_below_paid(): void
    {
        $this->assertSame('', self::kode(fn () => AturanSpk::hapusItem(165_000, 75_000, 90_000)));
        $this->assertSame('', self::kode(fn () => AturanSpk::hapusItem(165_000, 165_000, 0)));
        $this->assertSame('409 total_below_paid', self::kode(fn () => AturanSpk::hapusItem(165_000, 75_000, 90_001)));
        $this->assertSame('409 total_below_paid', self::kode(fn () => AturanSpk::hapusItem(35_000, 35_000, 1)));
    }

    public function test_payment_is_refused_for_cancelled_and_picked_up(): void
    {
        foreach ([StatusSpk::Antre, StatusSpk::Dikerjakan, StatusSpk::MenungguPart, StatusSpk::Selesai] as $status) {
            $this->assertSame('', self::kode(fn () => AturanSpk::bayar($status)), $status->value);
        }
        $this->assertSame('409 work_order_cancelled', self::kode(fn () => AturanSpk::bayar(StatusSpk::Dibatalkan)));
        $this->assertSame('409 already_picked_up', self::kode(fn () => AturanSpk::bayar(StatusSpk::Diambil)));
    }

    public function test_whatsapp_resend_rules(): void
    {
        foreach (StatusSpk::cases() as $status) {
            $batal = $status === StatusSpk::Dibatalkan;
            $sudahSelesai = $status === StatusSpk::Selesai || $status === StatusSpk::Diambil;
            foreach (['work_order_created', 'receipt'] as $jenis) {
                $this->assertSame($batal ? '409 work_order_cancelled' : '',
                    self::kode(fn () => AturanSpk::kirimUlangWa($status, $jenis)), $status->value.' '.$jenis);
            }
            $this->assertSame($batal ? '409 work_order_cancelled' : ($sudahSelesai ? '' : '409 work_order_not_done'),
                self::kode(fn () => AturanSpk::kirimUlangWa($status, 'work_order_done')), $status->value.' work_order_done');
        }
    }
}
