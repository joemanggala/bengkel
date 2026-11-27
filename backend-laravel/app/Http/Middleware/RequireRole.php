<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Modules\Sesi\Peran;
use App\Modules\Sesi\SesiStaf;
use App\Support\Http\ApiError;
use Closure;
use Illuminate\Http\Request;
use LogicException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pemeriksaan peran setelah middleware staff (matriks izin di spec, bagian
 * "Peran dan sesi"). Peran yang boleh ditulis di rute sebagai parameter:
 *
 *   ->middleware(['staff', 'peran:owner'])            khusus pemilik
 *   ->middleware(['staff', 'peran:owner,cashier'])    pemilik dan kasir
 *
 * Peran lain → 403 forbidden. Peran diperiksa sebelum controller membaca path
 * atau memvalidasi badan, jadi kasir dan mekanik tidak bisa mengintip apakah
 * suatu data ada lewat kode 404/422. Rute yang boleh dipanggil ketiga peran
 * tidak memakai middleware ini; batas mekanik di rute SPK (hanya SPK miliknya)
 * dinilai sesudah 404 oleh modul Servis.
 */
final class RequireRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if ($roles === []) {
            // Rute yang memakai "peran" tanpa daftar adalah salah tulis, bukan
            // izin untuk semua peran.
            throw new LogicException('middleware peran butuh minimal satu peran, mis. peran:owner');
        }
        $diizinkan = array_map(fn (string $role): Peran => Peran::from($role), $roles);
        if (! in_array(SesiStaf::dari($request)->peran, $diizinkan, true)) {
            throw ApiError::forbidden();
        }

        return $next($request);
    }
}
