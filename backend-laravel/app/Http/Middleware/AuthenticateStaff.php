<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Modules\Sesi\SesiService;
use App\Modules\Sesi\SesiStaf;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guard rute staf (pemilik, kasir, dan mekanik di web): meneruskan permintaan
 * hanya bila token Bearer-nya sesi staf yang sah (selain itu 401), lalu
 * menitipkan sesinya di atribut request (SesiStaf::dari). Rute publik tidak
 * memakai middleware ini, jadi header Authorization di sana diabaikan
 * sepenuhnya.
 */
final class AuthenticateStaff
{
    public function __construct(private readonly SesiService $sesi) {}

    public function handle(Request $request, Closure $next): Response
    {
        $sesi = $this->sesi->periksaStaf((string) $request->headers->get('Authorization', ''));
        $request->attributes->set(SesiStaf::ATRIBUT, $sesi);

        return $next($request);
    }
}
