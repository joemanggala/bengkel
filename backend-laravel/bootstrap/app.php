<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

use App\Console\Commands\MigrateCommand;
use App\Console\Commands\PeriksaCommand;
use App\Console\Commands\ServeCommand;
use App\Http\Middleware\AuthenticateStaff;
use App\Http\Middleware\EnforceRouteShape;
use App\Http\Middleware\ReadJsonBody;
use App\Http\Middleware\RequireRole;
use App\Support\Http\ErrorRenderer;
use App\Support\Http\LogGalat;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withCommands([ServeCommand::class, PeriksaCommand::class, MigrateCommand::class])
    ->withMiddleware(function (Middleware $middleware): void {
        // Tumpukan global bawaan Laravel diganti seluruhnya. TrimStrings dan
        // ConvertEmptyStringsToNull mengubah input (kontrak menentukan sendiri
        // field mana yang dipangkas), ValidatePostSize membalas 413 versi
        // Laravel, HandleCors menambah header CORS (kontrak tanpa CORS), dan
        // TrustProxies tidak dibutuhkan karena backend ini tidak mencatat
        // alamat IP peminta.
        $middleware->use([EnforceRouteShape::class]);

        // Urutan pemakaian alias di rute = urutan pemeriksaan di kontrak,
        // mis. ['json', 'staff', 'peran:owner'] berarti 413/400 → 401 → 403.
        // Rute staf tanpa badan tidak memakai 'json', karena kontrak menyuruh
        // badannya diabaikan sepenuhnya (JSON rusak pun tetap lolos).
        $middleware->alias([
            'json' => ReadJsonBody::class,
            'staff' => AuthenticateStaff::class,
            'peran' => RequireRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Pencatat bawaan Laravel menulis pesan galat utuh, dan pesan
        // QueryException memuat SQL beserta nilainya (nomor HP, hash token).
        // Galat tak terduga dicatat LogGalat saja (rute, jenis, errno, SQL
        // tanpa nilai); "false" menghentikan pencatat bawaan. ApiError punya
        // report() sendiri, jadi tidak sampai ke sini.
        $exceptions->report(function (Throwable $e): bool {
            LogGalat::catat($e);

            return false;
        });
        // Semua galat, termasuk rute tak dikenal dan kegagalan tak terduga,
        // dibalas dalam bentuk {"error": {"code", "message"}} apa pun header
        // Accept-nya. Galat kontrak (ApiError) merender dirinya sendiri.
        $exceptions->render(fn (Throwable $e) => ErrorRenderer::render($e));
    })
    ->create();
