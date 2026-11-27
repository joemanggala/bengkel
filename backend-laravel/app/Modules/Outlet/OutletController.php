<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Outlet;

use App\Modules\Outlet\Contracts\OutletRepositoryInterface;
use App\Support\Http\ApiResponse;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Profil outlet. Cukup controller + repository: tidak ada aturan bisnis
 * selain validasi, jadi lapisan service hanya akan meneruskan panggilan.
 */
final class OutletController
{
    /**
     * Tautan peta: http:// atau https:// huruf kecil, lalu hanya karakter
     * ASCII terlihat U+0021-U+007E, supaya "javascript:…" dan teks berspasi
     * tidak pernah sampai ke tombol peta di website. Ditulis dengan rentang
     * kode, bukan \s, supaya hasilnya sama di PHP, JavaScript, dan Go.
     */
    private const MAPS_URL = '/^https?:\/\/[\x21-\x7E]+$/D';

    public function __construct(
        private readonly OutletRepositoryInterface $outlet,
        private readonly Clock $clock,
    ) {}

    /** GET /api/outlet: publik, header Authorization diabaikan. */
    public function show(): JsonResponse
    {
        return ApiResponse::data($this->outlet->ambil()->toArray());
    }

    /**
     * PUT /api/outlet: mengganti seluruh profil, jadi semua field wajib
     * dikirim (null → required). Teks selain nama boleh kosong dan dipangkas
     * hanya di ujungnya, sehingga pergantian baris di tengah tetap tersimpan.
     */
    public function update(Request $request): JsonResponse
    {
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $profil = new ProfilOutlet(
            $body->text('name', new TextRule(trim: true, min: 2, max: 100)),
            $body->text('tagline', new TextRule(allowEmpty: true, trim: true, max: 200)),
            $body->text('address', new TextRule(allowEmpty: true, trim: true, max: 500)),
            $body->nullablePhone('phone'),
            $body->text('openingHours', new TextRule(allowEmpty: true, trim: true, max: 200)),
            $body->text('mapsUrl', new TextRule(allowEmpty: true, trim: true, max: 500, pattern: self::MAPS_URL)),
            $body->text('receiptFooter', new TextRule(allowEmpty: true, trim: true, max: 500)),
        );
        $body->throwIfInvalid();
        $this->outlet->simpan($profil, Time::toDb($this->clock->now()));

        return ApiResponse::data($this->outlet->ambil()->toArray());
    }
}
