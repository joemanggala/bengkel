<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Servis\StatusBayar;
use App\Modules\Servis\StatusSpk;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Status SPK: lima perpindahan sah lewat rute status, status terbuka, lingkup, dan status bayar. */
final class StatusSpkTest extends TestCase
{
    /**
     * Tabel "Status SPK" di spec, selain pembuatan dan pembatalan.
     *
     * @return array<string, array{StatusSpk, StatusSpk}>
     */
    public static function allowedTransitions(): array
    {
        return [
            'Antre → Dikerjakan' => [StatusSpk::Antre, StatusSpk::Dikerjakan],
            'Dikerjakan → Menunggu part' => [StatusSpk::Dikerjakan, StatusSpk::MenungguPart],
            'Menunggu part → Dikerjakan' => [StatusSpk::MenungguPart, StatusSpk::Dikerjakan],
            'Dikerjakan → Selesai' => [StatusSpk::Dikerjakan, StatusSpk::Selesai],
            'Selesai → Diambil' => [StatusSpk::Selesai, StatusSpk::Diambil],
        ];
    }

    #[DataProvider('allowedTransitions')]
    public function test_allowed_transition(StatusSpk $from, StatusSpk $to): void
    {
        $this->assertTrue($from->bolehKe($to));
    }

    public function test_every_other_pair_is_refused(): void
    {
        $allowed = [];
        foreach (self::allowedTransitions() as [$from, $to]) {
            $allowed[] = $from->value.'>'.$to->value;
        }

        $checked = 0;
        foreach (StatusSpk::cases() as $from) {
            foreach (StatusSpk::cases() as $to) {
                if (in_array($from->value.'>'.$to->value, $allowed, true)) {
                    continue;
                }
                // Ke status yang sama, melompat (Antre → Selesai, Menunggu part →
                // Selesai), mundur, dari status akhir, dan ke Dibatalkan.
                $this->assertFalse($from->bolehKe($to), $from->value.' → '.$to->value);
                $checked++;
            }
        }
        $this->assertSame(36 - 5, $checked);
    }

    public function test_waiting_parts_cannot_go_straight_to_done(): void
    {
        // Keputusan 0a-4: kembali ke Dikerjakan dulu.
        $this->assertFalse(StatusSpk::MenungguPart->bolehKe(StatusSpk::Selesai));
    }

    public function test_open_statuses_allow_items_patch_and_cancel(): void
    {
        $open = array_values(array_filter(StatusSpk::cases(), fn (StatusSpk $s): bool => $s->terbuka()));
        $cancellable = array_values(array_filter(StatusSpk::cases(), fn (StatusSpk $s): bool => $s->bolehDibatalkan()));

        $this->assertSame([StatusSpk::Antre, StatusSpk::Dikerjakan, StatusSpk::MenungguPart], $open);
        $this->assertSame($open, $cancellable);
    }

    public function test_status_route_targets_and_mechanic_targets(): void
    {
        $this->assertSame(['IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP'], StatusSpk::tujuanRuteStatus());

        $mechanic = array_values(array_filter(StatusSpk::cases(), fn (StatusSpk $s): bool => $s->bolehDitujuMekanik()));
        $this->assertSame([StatusSpk::Dikerjakan, StatusSpk::MenungguPart, StatusSpk::Selesai], $mechanic);
    }

    public function test_scope_filter(): void
    {
        $this->assertSame([StatusSpk::Antre, StatusSpk::Dikerjakan, StatusSpk::MenungguPart, StatusSpk::Selesai], StatusSpk::untukLingkup('active'));
        $this->assertSame([StatusSpk::Diambil, StatusSpk::Dibatalkan], StatusSpk::untukLingkup('history'));
        $this->assertNull(StatusSpk::untukLingkup(''));
        $this->assertNull(StatusSpk::untukLingkup('ACTIVE'));
    }

    public function test_labels_follow_x_label(): void
    {
        $labels = array_map(fn (StatusSpk $s): string => $s->label(), StatusSpk::cases());

        $this->assertSame(['Antre', 'Dikerjakan', 'Menunggu part', 'Selesai', 'Diambil', 'Dibatalkan'], $labels);
        $this->assertSame(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP', 'CANCELLED'],
            array_map(fn (StatusSpk $s): string => $s->value, StatusSpk::cases()));
    }

    /** @return array<string, array{int, int, StatusBayar}> */
    public static function paymentStatuses(): array
    {
        return [
            'belum bayar' => [165_000, 0, StatusBayar::Belum],
            'uang muka' => [165_000, 50_000, StatusBayar::Sebagian],
            'kurang satu rupiah' => [165_000, 164_999, StatusBayar::Sebagian],
            'lunas' => [165_000, 165_000, StatusBayar::Lunas],
            'total 0 dianggap lunas (0a-14)' => [0, 0, StatusBayar::Lunas],
        ];
    }

    #[DataProvider('paymentStatuses')]
    public function test_payment_status_is_derived(int $total, int $paid, StatusBayar $expected): void
    {
        $this->assertSame($expected, StatusBayar::dari($total, $paid));
    }

    public function test_payment_status_values_and_labels(): void
    {
        $this->assertSame(['unpaid', 'partial', 'paid'], array_map(fn (StatusBayar $s): string => $s->value, StatusBayar::cases()));
        $this->assertSame(['Belum bayar', 'Bayar sebagian', 'Lunas'], array_map(fn (StatusBayar $s): string => $s->label(), StatusBayar::cases()));
    }
}
