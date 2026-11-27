<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Outlet\ProfilOutlet;
use App\Modules\Servis\PenyajiSpk;
use PHPUnit\Framework\TestCase;

/**
 * Bentuk JSON SPK dari baris database: status bayar dan sisa diturunkan dari
 * total dan terbayar, harga beli tidak pernah ikut, dan halaman publik tanpa
 * data staf, diagnosis, token, maupun nomor HP utuh.
 */
final class ServisPenyajiSpkTest extends TestCase
{
    private static function baris(array $ubah = []): object
    {
        return (object) [...[
            'work_order_id' => '11111111-1111-4111-8111-111111111111',
            'number' => 'S-0007',
            'status' => 'IN_PROGRESS',
            'complaint' => 'Rem bunyi.',
            'diagnosis' => 'Diagnosis rahasia.',
            'odometer' => 18250,
            'estimated_done_at' => '2026-11-28 08:00:00.000',
            'service_subtotal' => 35000,
            'part_subtotal' => 55000,
            'total' => 90000,
            'paid_amount' => 20000,
            'cancel_reason' => null,
            'tracking_token' => str_repeat('a', 43),
            'created_at' => '2026-11-27 01:02:03.004',
            'updated_at' => '2026-11-27 02:00:00.000',
            'customer_id' => '22222222-2222-4222-8222-222222222222',
            'customer_name' => 'Budi',
            'customer_phone' => '6281234567890',
            'vehicle_id' => '33333333-3333-4333-8333-333333333333',
            'vehicle_type' => 'MOTOR',
            'plate_display' => 'B 1234 XYZ',
            'brand' => 'Honda',
            'model' => 'Vario 125',
            'year' => null,
            'color' => '',
            'mechanic_staff_id' => '44444444-4444-4444-8444-444444444444',
            'mechanic_name' => 'Andi Mekanik',
            'created_by_staff_id' => '55555555-5555-4555-8555-555555555555',
            'creator_name' => 'Rina Kasir',
            'booking_id' => null,
            'booking_number' => null,
            'item_count' => 2,
        ], ...$ubah];
    }

    private static function item(): object
    {
        return (object) [
            'work_order_item_id' => '66666666-6666-4666-8666-666666666666', 'type' => 'PART', 'service_id' => null,
            'part_id' => '77777777-7777-4777-8777-777777777777', 'item_name' => 'Oli', 'price' => 55000, 'quantity' => 1,
            'subtotal' => 55000, 'created_at' => '2026-11-27 01:05:00.000', 'cost_price' => 40000,
        ];
    }

    public function test_detail_derives_payment_status_and_never_exposes_cost_price(): void
    {
        $wa = ['workOrderCreated' => null, 'workOrderDone' => null, 'receipt' => null];
        $detail = PenyajiSpk::detail(self::baris(), [self::item()], [], [], $wa);

        $this->assertSame('partial', $detail['paymentStatus']);
        $this->assertSame(70000, $detail['remainingAmount']);
        $this->assertSame('2026-11-28T08:00:00.000Z', $detail['estimatedDoneAt']);
        $this->assertNull($detail['booking']);
        $this->assertSame(['staffId' => '44444444-4444-4444-8444-444444444444', 'name' => 'Andi Mekanik'], $detail['mechanic']);
        $this->assertStringNotContainsString('cost', json_encode($detail, JSON_THROW_ON_ERROR));
    }

    public function test_zero_total_is_paid(): void
    {
        $ringkas = PenyajiSpk::ringkas(self::baris(['total' => 0, 'paid_amount' => 0, 'mechanic_staff_id' => null]));

        $this->assertSame('paid', $ringkas['paymentStatus']);
        $this->assertNull($ringkas['mechanic']);
        $this->assertSame(2, $ringkas['itemCount']);
    }

    public function test_public_view_hides_staff_data_and_masks_phone(): void
    {
        $outlet = new ProfilOutlet('Nama Bengkel', '', '', null, '', '', '');
        $publik = PenyajiSpk::publik(self::baris(), [self::item()], [], $outlet);
        $teks = json_encode($publik, JSON_THROW_ON_ERROR);

        $this->assertSame('6281****7890', $publik['customerPhone']);
        foreach (['Diagnosis rahasia.', 'Andi Mekanik', 'Rina Kasir', str_repeat('a', 43), '6281234567890', 'cost', 'Id"'] as $rahasia) {
            $this->assertStringNotContainsString($rahasia, $teks);
        }
        $this->assertSame([['type' => 'PART', 'name' => 'Oli', 'price' => 55000, 'quantity' => 1, 'subtotal' => 55000]], $publik['items']);
    }
}
