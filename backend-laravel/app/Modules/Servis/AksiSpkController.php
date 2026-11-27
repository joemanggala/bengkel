<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Servis\Requests\SpkInput;
use App\Modules\Sesi\SesiStaf;
use App\Modules\WhatsApp\JenisPesan;
use App\Support\Http\ApiResponse;
use App\Support\Validation\JsonObject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Aksi kasir pada SPK (pemilik dan kasir; mekanik sudah ditolak middleware
 * peran): item, pembayaran, kirim ulang WhatsApp, dan tautan lacak baru.
 */
final class AksiSpkController
{
    /** Jenis pesan yang boleh dikirim ulang kasir (JenisPesanWaSpk). */
    private const JENIS_KIRIM_ULANG = ['work_order_created', 'work_order_done', 'receipt'];

    public function __construct(
        private readonly ServisService $servis,
        private readonly AksiSpkService $aksi,
    ) {}

    /**
     * POST /api/work-orders/{number}/items: 404 → 422 badan dan rujukan →
     * (di service) 409 locked → 422 too_many_items → 422/409 sparepart → 201.
     * Bila `type` tidak sah, field lain tidak diperiksa.
     */
    public function tambah(Request $request, string $number): JsonResponse
    {
        $spk = $this->servis->cari($number);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $type = $body->choice('type', ['SERVICE', 'PART']);
        if ($body->failed('type')) {
            $body->throwIfInvalid();
        }
        // Rujukan jenis lain (partId untuk SERVICE, serviceId dan price untuk PART) diabaikan seluruhnya.
        $refId = $body->uuid($type === 'SERVICE' ? 'serviceId' : 'partId');
        $quantity = SpkInput::quantity($body);
        $price = $type === 'SERVICE' ? SpkInput::price($body) : null;
        $this->aksi->rujukanItem($body, $type, $refId);
        $body->throwIfInvalid();

        return ApiResponse::data($this->aksi->tambahItem(SesiStaf::dari($request), $spk, $type, $refId, $quantity, $price), 201);
    }

    /** DELETE /api/work-orders/{number}/items/{itemId}: tanpa badan; 404 SPK → 404 item → 409 → 200. */
    public function hapus(Request $request, string $number, string $itemId): JsonResponse
    {
        $spk = $this->servis->cari($number);

        return ApiResponse::data($this->aksi->hapusItem(SesiStaf::dari($request), $spk, $itemId));
    }

    /** POST /api/work-orders/{number}/payments: 404 → 422 → 409 → 422 sisa tagihan → 201. */
    public function bayar(Request $request, string $number): JsonResponse
    {
        $spk = $this->servis->cari($number);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $amount = SpkInput::amount($body);
        $method = SpkInput::method($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->aksi->bayar(SesiStaf::dari($request), $spk, $amount, $method), 201);
    }

    /** POST /api/work-orders/{number}/wa: 404 → 422 (type, phone sekaligus) → 409 → kirim (gagal → 503). */
    public function wa(Request $request, string $number): JsonResponse
    {
        $spk = $this->servis->cari($number);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $type = $body->choice('type', self::JENIS_KIRIM_ULANG);
        $phone = $body->optionalPhone('phone');
        $body->throwIfInvalid();

        return ApiResponse::data($this->aksi->kirimUlangWa($spk, JenisPesan::from($type), $phone));
    }

    /** POST /api/work-orders/{number}/tracking-link: tanpa badan; 404 → 200 dengan token baru. */
    public function tautanLacak(string $number): JsonResponse
    {
        return ApiResponse::data($this->aksi->buatUlangTautan($this->servis->cari($number)));
    }
}
