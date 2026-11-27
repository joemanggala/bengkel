<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Jejak galat di log tidak memuat nilai argumen fungsi, karena argumen itu
// bisa berisi rahasia, misalnya sandi staf atau token sesi.
ini_set('zend.exception_ignore_args', '1');

require __DIR__.'/../vendor/autoload.php';

/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

// Symfony mengizinkan POST menyamar menjadi PUT/PATCH lewat header
// X-HTTP-Method-Override atau ?_method=. Kontrak hanya mengenal metode asli
// permintaan, jadi penyamaran itu dimatikan sebelum request dibaca.
Request::setAllowedHttpMethodOverride([]);

$app->handleRequest(Request::capture());
