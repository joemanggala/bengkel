<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Stok;

use App\Modules\Sesi\SesiStaf;
use App\Modules\Sparepart\Requests\SparepartInput;
use App\Modules\Sparepart\SparepartService;
use App\Support\Http\ApiResponse;
use App\Support\Http\Page;
use App\Support\Http\QueryParams;
use App\Support\Validation\IntRule;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Kartu stok dan pencatatan stok manual, khusus pemilik. Semua rute di sini
 * menilai sparepart di path lebih dulu (404), baru badan atau query (422).
 * Balasan pencatatan selalu SparepartPemilik karena hanya pemilik yang bisa
 * sampai ke sini.
 */
final class StokController
{
    /** Batas jumlah stok per pencatatan (JumlahStok) dan hasil hitung. */
    private const MAX_QUANTITY = 100_000_000;

    /** Panjang maksimum catatan kartu stok (CatatanStok). */
    private const MAX_NOTE = 200;

    public function __construct(
        private readonly SparepartService $parts,
        private readonly StokService $service,
    ) {}

    /** GET /api/parts/{partId}/movements: 404 → 422 (page/limit) → 200. */
    public function kartu(Request $request, string $partId): JsonResponse
    {
        $this->parts->cari($partId);
        $page = Page::fromQuery(QueryParams::from($request));

        [$baris, $total] = $this->service->kartu($partId, $page);

        return ApiResponse::list(array_map(fn (PergerakanStok $m) => $m->toArray(), $baris), $page, $total);
    }

    /** POST /api/parts/{partId}/stock-in: catatan opsional, costPrice opsional. */
    public function masuk(Request $request, string $partId): JsonResponse
    {
        $this->parts->cari($partId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $quantity = self::quantity($body);
        $costPrice = $body->has('costPrice') ? SparepartInput::costPrice($body) : null;
        $note = $body->text('note', new TextRule(optional: true, trim: true, max: self::MAX_NOTE));
        $body->throwIfInvalid();

        $part = $this->service->masuk($partId, $quantity, $costPrice, $note, SesiStaf::dari($request)->staffId);

        return ApiResponse::data($part->toArray(true));
    }

    /** POST /api/parts/{partId}/stock-out: 404 → 422 → 409 insufficient_stock → 200. */
    public function keluar(Request $request, string $partId): JsonResponse
    {
        $this->parts->cari($partId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $quantity = self::quantity($body);
        $note = self::requiredNote($body);
        $body->throwIfInvalid();

        $part = $this->service->keluar($partId, $quantity, $note, SesiStaf::dari($request)->staffId);

        return ApiResponse::data($part->toArray(true));
    }

    /** POST /api/parts/{partId}/stock-count: stok menjadi countedStock (0 sah). */
    public function hitung(Request $request, string $partId): JsonResponse
    {
        $this->parts->cari($partId);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $counted = $body->int('countedStock', new IntRule(0, self::MAX_QUANTITY));
        $note = self::requiredNote($body);
        $body->throwIfInvalid();

        $part = $this->service->hitung($partId, $counted, $note, SesiStaf::dari($request)->staffId);

        return ApiResponse::data($part->toArray(true));
    }

    /** JumlahStok: wajib, 1..100.000.000. */
    private static function quantity(JsonObject $body): int
    {
        return $body->int('quantity', new IntRule(1, self::MAX_QUANTITY));
    }

    /** Catatan wajib stok keluar dan hitung ulang: tidak dikirim, null, atau kosong → required. */
    private static function requiredNote(JsonObject $body): string
    {
        return $body->text('note', new TextRule(trim: true, max: self::MAX_NOTE));
    }
}
