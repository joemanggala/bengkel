<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Outlet\ProfilOutlet;
use App\Support\Time\Time;
use App\Support\Validation\PhoneNumber;

/**
 * Menyusun baris database menjadi JSON skema SpkRingkas, SpkDetail, dan
 * SpkPublik. Semua objek tertutup persis skema: setiap kunci ditulis
 * eksplisit di sini, jadi kolom yang tidak boleh keluar (cost_price, hash,
 * catatan internal di halaman publik) memang tidak pernah dibaca ke respons.
 *
 * Status bayar dan sisa tagihan tidak disimpan: selalu diturunkan dari total
 * dan paid_amount supaya tidak pernah bertentangan dengan uang yang tercatat.
 */
final class PenyajiSpk
{
    /**
     * Satu baris papan servis dan riwayat kendaraan.
     *
     * @return array<string, mixed>
     */
    public static function ringkas(object $r): array
    {
        $total = (int) $r->total;
        $dibayar = (int) $r->paid_amount;

        return [
            'number' => $r->number,
            'status' => $r->status,
            'paymentStatus' => StatusBayar::dari($total, $dibayar)->value,
            'customer' => self::pelanggan($r),
            'vehicle' => [
                'vehicleId' => $r->vehicle_id,
                'type' => $r->vehicle_type,
                'plate' => $r->plate_display,
                'brand' => $r->brand,
                'model' => $r->model,
            ],
            'mechanic' => self::mekanik($r),
            'complaint' => $r->complaint,
            'itemCount' => (int) $r->item_count,
            'total' => $total,
            'paidAmount' => $dibayar,
            'estimatedDoneAt' => Time::dbToJson($r->estimated_done_at),
            'createdAt' => Time::dbToJson($r->created_at),
            'updatedAt' => Time::dbToJson($r->updated_at),
        ];
    }

    /**
     * Rincian SPK untuk staf. Harga beli item tidak pernah ikut, termasuk
     * untuk pemilik (laba hanya ada di rekap).
     *
     * @param  list<object>  $items
     * @param  list<object>  $payments
     * @param  list<object>  $logs
     * @param  array<string, mixed>  $wa  RingkasanWa
     * @return array<string, mixed>
     */
    public static function detail(object $r, array $items, array $payments, array $logs, array $wa): array
    {
        $total = (int) $r->total;
        $dibayar = (int) $r->paid_amount;

        return [
            'number' => $r->number,
            'status' => $r->status,
            'paymentStatus' => StatusBayar::dari($total, $dibayar)->value,
            'customer' => self::pelanggan($r),
            'vehicle' => [
                'vehicleId' => $r->vehicle_id,
                'type' => $r->vehicle_type,
                'plate' => $r->plate_display,
                'brand' => $r->brand,
                'model' => $r->model,
                'year' => $r->year === null ? null : (int) $r->year,
                'color' => $r->color,
            ],
            'booking' => $r->booking_id === null ? null : ['bookingId' => $r->booking_id, 'number' => $r->booking_number],
            'mechanic' => self::mekanik($r),
            'complaint' => $r->complaint,
            'diagnosis' => $r->diagnosis,
            'odometer' => $r->odometer === null ? null : (int) $r->odometer,
            'estimatedDoneAt' => Time::dbToJson($r->estimated_done_at),
            'serviceSubtotal' => (int) $r->service_subtotal,
            'partSubtotal' => (int) $r->part_subtotal,
            'total' => $total,
            'paidAmount' => $dibayar,
            'remainingAmount' => $total - $dibayar,
            'cancelReason' => $r->cancel_reason,
            'trackingToken' => $r->tracking_token,
            'createdBy' => ['staffId' => $r->created_by_staff_id, 'name' => $r->creator_name],
            'createdAt' => Time::dbToJson($r->created_at),
            'updatedAt' => Time::dbToJson($r->updated_at),
            'items' => array_map(fn (object $i): array => [
                'itemId' => $i->work_order_item_id,
                'type' => $i->type,
                'serviceId' => $i->service_id,
                'partId' => $i->part_id,
                'name' => $i->item_name,
                'price' => (int) $i->price,
                'quantity' => (int) $i->quantity,
                'subtotal' => (int) $i->subtotal,
                'createdAt' => Time::dbToJson($i->created_at),
            ], $items),
            'payments' => array_map(fn (object $p): array => [
                'paymentId' => $p->payment_id,
                'amount' => (int) $p->amount,
                'method' => $p->method,
                'recordedBy' => ['staffId' => $p->staff_id, 'name' => $p->staff_name],
                'createdAt' => Time::dbToJson($p->created_at),
            ], $payments),
            'timeline' => array_map(fn (object $l): array => [
                'fromStatus' => $l->from_status,
                'toStatus' => $l->to_status,
                'by' => ['staffId' => $l->staff_id, 'name' => $l->staff_name],
                'note' => $l->note,
                'createdAt' => Time::dbToJson($l->created_at),
            ], $logs),
            'wa' => $wa,
        ];
    }

    /**
     * Halaman lacak sekaligus nota online. Sengaja tanpa ID, nama staf dan
     * mekanik, diagnosis, catatan linimasa, pembayaran per baris, status
     * WhatsApp, dan token; nomor HP disamarkan. Satu-satunya teks staf yang
     * tampil adalah alasan batal.
     *
     * @param  list<object>  $items
     * @param  list<object>  $logs
     * @return array<string, mixed>
     */
    public static function publik(object $r, array $items, array $logs, ProfilOutlet $outlet): array
    {
        $total = (int) $r->total;
        $dibayar = (int) $r->paid_amount;

        return [
            'outlet' => $outlet->toArray(),
            'number' => $r->number,
            'status' => $r->status,
            'paymentStatus' => StatusBayar::dari($total, $dibayar)->value,
            'customerName' => $r->customer_name,
            'customerPhone' => PhoneNumber::mask($r->customer_phone),
            'vehicle' => ['type' => $r->vehicle_type, 'plate' => $r->plate_display, 'brand' => $r->brand, 'model' => $r->model],
            'complaint' => $r->complaint,
            'estimatedDoneAt' => Time::dbToJson($r->estimated_done_at),
            'serviceSubtotal' => (int) $r->service_subtotal,
            'partSubtotal' => (int) $r->part_subtotal,
            'total' => $total,
            'paidAmount' => $dibayar,
            'remainingAmount' => $total - $dibayar,
            'cancelReason' => $r->cancel_reason,
            'createdAt' => Time::dbToJson($r->created_at),
            'items' => array_map(fn (object $i): array => [
                'type' => $i->type,
                'name' => $i->item_name,
                'price' => (int) $i->price,
                'quantity' => (int) $i->quantity,
                'subtotal' => (int) $i->subtotal,
            ], $items),
            'timeline' => array_map(fn (object $l): array => [
                'fromStatus' => $l->from_status,
                'toStatus' => $l->to_status,
                'createdAt' => Time::dbToJson($l->created_at),
            ], $logs),
        ];
    }

    /** @return array{customerId: string, name: string, phone: string} */
    private static function pelanggan(object $r): array
    {
        return ['customerId' => $r->customer_id, 'name' => $r->customer_name, 'phone' => $r->customer_phone];
    }

    /** Mekanik yang ditugaskan, termasuk yang sudah nonaktif atau berganti peran; null bila belum ada. */
    private static function mekanik(object $r): ?array
    {
        return $r->mechanic_staff_id === null ? null : ['staffId' => $r->mechanic_staff_id, 'name' => $r->mechanic_name];
    }
}
