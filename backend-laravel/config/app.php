<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Nilai di sini sengaja tidak dibaca dari env APP_*: ketiga backend bengkel
// memakai nama env yang sama persis (lihat .env.example), dan env khas Laravel
// tidak termasuk di dalamnya. Pengaturan aplikasi dibaca App\Support\Config\Settings.
return [
    'name' => 'bengkel',
    'env' => 'production',
    // debug selalu false: galat tak terduga dibalas pesan umum, detailnya
    // hanya di log, sehingga pesan SQL atau path berkas tidak pernah bocor.
    'debug' => false,
    'url' => 'http://localhost',
    // Semua waktu aplikasi UTC. Waktu WIB hanya muncul di teks pesan WhatsApp,
    // filter tanggal, batas tanggal datang booking, dan rekap harian, dan
    // selalu dihitung eksplisit (+07:00, lihat App\Support\Time\Wib).
    'timezone' => 'UTC',
    'locale' => 'id',
    'fallback_locale' => 'en',
    'faker_locale' => 'id_ID',
    'cipher' => 'AES-256-CBC',
    // Tidak ada cookie, sesi Laravel, atau data terenkripsi, jadi APP_KEY
    // tidak dibutuhkan.
    'key' => null,
    'previous_keys' => [],
    'maintenance' => ['driver' => 'file'],
];
