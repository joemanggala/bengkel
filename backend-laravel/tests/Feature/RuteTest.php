<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as Router;

/**
 * Daftar semua rute yang terdaftar beserta middleware-nya. Urutan alias
 * middleware di rute adalah urutan pemeriksaan kontrak (json → staff →
 * peran), jadi salah susun di sini berarti urutan 413/400 → 401 → 403
 * berubah. Jumlahnya 52, sama dengan jumlah operasi di spec.
 */
final class RuteTest extends TestCase
{
    /** @return array<string, list<string>> "METODE uri" → middleware */
    private function semuaRute(): array
    {
        $rute = [];
        foreach (Router::getRoutes()->getRoutes() as $route) {
            /** @var Route $route */
            foreach ($route->methods() as $method) {
                if ($method !== 'HEAD') {
                    $rute[$method.' '.$route->uri()] = $route->gatherMiddleware();
                }
            }
        }
        ksort($rute);

        return $rute;
    }

    public function test_all_52_contract_routes_and_their_middleware_order(): void
    {
        // Urutan alias di tiap rute = urutan pemeriksaan kontrak. Rute publik
        // tidak punya 'staff' sehingga header Authorization tidak pernah
        // dibaca; rute tanpa badan tidak punya 'json' sehingga badannya
        // diabaikan sepenuhnya. Rute yang boleh dipanggil ketiga peran tidak
        // punya 'peran' (batas mekanik di rute SPK dinilai modul Servis).
        // Tidak ada rute bawaan Laravel (/storage/{path}, /up) yang ikut.
        $this->assertSame([
            'DELETE api/work-orders/{number}/items/{itemId}' => ['staff', 'peran:owner,cashier'],
            'GET api/bookings' => ['staff', 'peran:owner,cashier'],
            'GET api/bookings/{bookingId}' => ['staff', 'peran:owner,cashier'],
            'GET api/customers' => ['staff', 'peran:owner,cashier'],
            'GET api/customers/{customerId}' => ['staff', 'peran:owner,cashier'],
            'GET api/health' => [],
            'GET api/mechanics' => ['staff', 'peran:owner,cashier'],
            'GET api/outlet' => [],
            'GET api/parts' => ['staff'],
            'GET api/parts/{partId}/movements' => ['staff', 'peran:owner'],
            'GET api/public/bookings/{bookingToken}' => [],
            'GET api/public/services' => [],
            'GET api/public/work-orders/{trackingToken}' => [],
            'GET api/reports/daily' => ['staff', 'peran:owner'],
            'GET api/services' => ['staff'],
            'GET api/setup' => [],
            'GET api/staff' => ['staff', 'peran:owner'],
            'GET api/staff/me' => ['staff'],
            'GET api/vehicles' => ['staff', 'peran:owner,cashier'],
            'GET api/vehicles/{vehicleId}/work-orders' => ['staff', 'peran:owner,cashier'],
            'GET api/work-orders' => ['staff'],
            'GET api/work-orders/{number}' => ['staff'],
            'PATCH api/customers/{customerId}' => ['json', 'staff', 'peran:owner,cashier'],
            'PATCH api/parts/{partId}' => ['json', 'staff', 'peran:owner'],
            'PATCH api/services/{serviceId}' => ['json', 'staff', 'peran:owner'],
            'PATCH api/staff/{staffId}' => ['json', 'staff', 'peran:owner'],
            'PATCH api/vehicles/{vehicleId}' => ['json', 'staff', 'peran:owner,cashier'],
            'PATCH api/work-orders/{number}' => ['json', 'staff'],
            'POST api/bookings/{bookingId}/confirm' => ['staff', 'peran:owner,cashier'],
            'POST api/bookings/{bookingId}/convert' => ['json', 'staff', 'peran:owner,cashier'],
            'POST api/bookings/{bookingId}/reject' => ['json', 'staff', 'peran:owner,cashier'],
            'POST api/customers' => ['json', 'staff', 'peran:owner,cashier'],
            'POST api/customers/{customerId}/vehicles' => ['json', 'staff', 'peran:owner,cashier'],
            'POST api/parts' => ['json', 'staff', 'peran:owner'],
            'POST api/parts/{partId}/stock-count' => ['json', 'staff', 'peran:owner'],
            'POST api/parts/{partId}/stock-in' => ['json', 'staff', 'peran:owner'],
            'POST api/parts/{partId}/stock-out' => ['json', 'staff', 'peran:owner'],
            'POST api/public/bookings' => ['json'],
            'POST api/public/bookings/{bookingToken}/cancel' => [],
            'POST api/services' => ['json', 'staff', 'peran:owner'],
            'POST api/setup' => ['json'],
            'POST api/staff' => ['json', 'staff', 'peran:owner'],
            'POST api/staff/login' => ['json'],
            'POST api/staff/logout' => ['staff'],
            'POST api/work-orders' => ['json', 'staff', 'peran:owner,cashier'],
            'POST api/work-orders/{number}/cancel' => ['json', 'staff', 'peran:owner,cashier'],
            'POST api/work-orders/{number}/items' => ['json', 'staff', 'peran:owner,cashier'],
            'POST api/work-orders/{number}/payments' => ['json', 'staff', 'peran:owner,cashier'],
            'POST api/work-orders/{number}/status' => ['json', 'staff'],
            'POST api/work-orders/{number}/tracking-link' => ['staff', 'peran:owner,cashier'],
            'POST api/work-orders/{number}/wa' => ['json', 'staff', 'peran:owner,cashier'],
            'PUT api/outlet' => ['json', 'staff', 'peran:owner'],
        ], $this->semuaRute());
    }
}
