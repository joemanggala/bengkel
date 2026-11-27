<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Servis\Requests\SpkInput;
use App\Modules\Sesi\SesiStaf;
use App\Support\Database\SearchTerm;
use App\Support\Http\ApiResponse;
use App\Support\Http\Page;
use App\Support\Http\QueryParams;
use App\Support\Security\Uuid;
use App\Support\Time\Time;
use App\Support\Time\Wib;
use App\Support\Validation\FieldCode;
use App\Support\Validation\FieldErrors;
use App\Support\Validation\JsonObject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Papan servis, rincian, SPK baru, perubahan data, status, dan pembatalan,
 * ditambah riwayat servis per kendaraan. Controller hanya membaca path,
 * query, dan badan dengan urutan pemeriksaan kontrak (404 → 403 mekanik →
 * 422), lalu menyerahkan aturan bisnis ke ServisService.
 */
final class SpkController
{
    public function __construct(private readonly ServisService $servis) {}

    /**
     * GET /api/work-orders (semua peran staf): 401 → 422 (query) → 200. Semua
     * parameter yang salah dilaporkan sekaligus.
     */
    public function index(Request $request): JsonResponse
    {
        $sesi = SesiStaf::dari($request);
        $query = QueryParams::from($request);
        $errors = new FieldErrors;

        $status = null;
        if ($query->has('status')) {
            $status = StatusSpk::tryFrom($query->get('status'))?->value;
            if ($status === null) {
                $errors->add('status', FieldCode::INVALID_FORMAT);
            }
        }
        $lingkup = null;
        if ($query->has('scope')) {
            $lingkup = StatusSpk::untukLingkup($query->get('scope'));
            if ($lingkup === null) {
                $errors->add('scope', FieldCode::INVALID_FORMAT);
            }
        }
        $mechanicId = null;
        if ($query->has('mechanicId')) {
            $mechanicId = $query->get('mechanicId');
            if (! Uuid::valid($mechanicId)) {
                $errors->add('mechanicId', FieldCode::INVALID_FORMAT);
            }
        }
        $rentang = null;
        if ($query->has('date')) {
            $hari = Wib::hari($query->get('date'));
            if ($hari === null) {
                $errors->add('date', FieldCode::INVALID_FORMAT);
            } else {
                $rentang = [Time::toDb($hari[0]), Time::toDb($hari[1])];
            }
        }
        $terlama = false;
        if ($query->has('sort')) {
            $sort = $query->get('sort');
            if ($sort !== 'newest' && $sort !== 'oldest') {
                $errors->add('sort', FieldCode::INVALID_FORMAT);
            }
            $terlama = $sort === 'oldest';
        }
        $page = Page::parse($query, $errors);
        $errors->throwIfAny();

        $filter = new FilterDaftar(
            status: $status,
            lingkup: $lingkup === null ? null : array_map(fn (StatusSpk $s): string => $s->value, $lingkup),
            // Mekanik selalu hanya melihat SPK miliknya; ?mechanicId= diabaikan untuknya.
            mechanicId: BatasMekanik::saringanDaftar($sesi, $mechanicId),
            rentang: $rentang,
            search: SearchTerm::of($query->search()),
            terlama: $terlama,
        );
        [$rows, $total] = $this->servis->daftar($filter, $page);

        return ApiResponse::list($rows, $page, $total);
    }

    /** GET /api/vehicles/{vehicleId}/work-orders (pemilik, kasir): 404 → 422 → 200, termasuk SPK batal. */
    public function riwayat(Request $request, string $vehicleId): JsonResponse
    {
        $this->servis->pastikanKendaraan($vehicleId);
        $page = Page::fromQuery(QueryParams::from($request));
        [$rows, $total] = $this->servis->daftar(new FilterDaftar(vehicleId: $vehicleId), $page);

        return ApiResponse::list($rows, $page, $total);
    }

    /** GET /api/work-orders/{number}: 404 → 403 (mekanik, bukan SPK miliknya) → 200. */
    public function show(Request $request, string $number): JsonResponse
    {
        $spk = $this->servis->bukaUntuk(SesiStaf::dari($request), $number);

        return ApiResponse::data($this->servis->detail($spk->id));
    }

    /**
     * POST /api/work-orders (pemilik, kasir): semua field dinilai sekaligus,
     * termasuk rujukan kendaraan dan mekanik → 201. Field lain diabaikan.
     */
    public function store(Request $request): JsonResponse
    {
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $vehicleId = $body->uuid('vehicleId');
        $complaint = SpkInput::complaint($body);
        $odometer = SpkInput::odometer($body);
        $estimatedDoneAt = SpkInput::estimatedDoneAt($body);
        $mechanicId = SpkInput::mechanicId($body);
        $customerId = $this->servis->rujukanKendaraan($body, $vehicleId);
        $this->servis->rujukanMekanik($body, $mechanicId);
        $body->throwIfInvalid();

        $spk = new SpkBaru($vehicleId, (string) $customerId, $complaint, $odometer, $estimatedDoneAt, $mechanicId);

        return ApiResponse::data($this->servis->buat(SesiStaf::dari($request), $spk), 201);
    }

    /**
     * PATCH /api/work-orders/{number}: 404 → 403 (mekanik: bukan SPK miliknya,
     * atau mengirim kunci selain diagnosis) → 422 → 409 → 200. Hanya field
     * yang dikirim yang dinilai dan diubah.
     */
    public function update(Request $request, string $number): JsonResponse
    {
        $sesi = SesiStaf::dari($request);
        $spk = $this->servis->bukaUntuk($sesi, $number);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        BatasMekanik::bolehUbah($sesi, $body);

        $kolom = [];
        if ($body->has('mechanicId')) {
            $mechanicId = SpkInput::mechanicId($body);
            $this->servis->rujukanMekanik($body, $mechanicId, $spk->mechanicId);
            $kolom['mechanic_staff_id'] = $mechanicId;
        }
        if ($body->has('complaint')) {
            $kolom['complaint'] = SpkInput::complaint($body);
        }
        if ($body->has('diagnosis')) {
            $kolom['diagnosis'] = SpkInput::diagnosis($body);
        }
        if ($body->has('odometer')) {
            $kolom['odometer'] = SpkInput::odometer($body);
        }
        if ($body->has('estimatedDoneAt')) {
            $kolom['estimated_done_at'] = SpkInput::estimatedDoneAt($body);
        }
        $body->throwIfInvalid();

        return ApiResponse::data($this->servis->ubah($sesi, $spk, new PerubahanSpk($kolom)));
    }

    /**
     * POST /api/work-orders/{number}/status: 404 → 403 (bukan SPK miliknya)
     * → 422 → 403 (mekanik ke PICKED_UP) → 409 → 200.
     */
    public function status(Request $request, string $number): JsonResponse
    {
        $sesi = SesiStaf::dari($request);
        $spk = $this->servis->bukaUntuk($sesi, $number);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $ke = SpkInput::statusTujuan($body);
        $note = SpkInput::note($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->servis->ubahStatus($sesi, $spk, $ke, $note));
    }

    /** POST /api/work-orders/{number}/cancel (pemilik, kasir): 404 → 422 → 409 → 200. */
    public function cancel(Request $request, string $number): JsonResponse
    {
        $spk = $this->servis->cari($number);
        $body = $request->attributes->get(JsonObject::ATTRIBUTE);
        $reason = SpkInput::reason($body);
        $body->throwIfInvalid();

        return ApiResponse::data($this->servis->batal(SesiStaf::dari($request), $spk, $reason));
    }
}
