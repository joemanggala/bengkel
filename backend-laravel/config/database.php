<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

use Illuminate\Support\Env;

return [
    'default' => 'mysql',

    'connections' => [
        'mysql' => [
            'driver' => 'mysql',
            // DATABASE_URL berbentuk mysql://user:sandi@host:port/database.
            // Laravel menguraikannya sendiri menjadi host, port, database,
            // username, dan password. Dibaca mentah lewat repositori env,
            // bukan env(), supaya sandi seperti "null" tidak diubah menjadi
            // nilai PHP, lalu dipangkas seperti semua env lain.
            'url' => trim((string) Env::getRepository()->get('DATABASE_URL'), " \t\r\n"),
            'host' => '127.0.0.1',
            'port' => '3306',
            'database' => '',
            'username' => '',
            'password' => '',
            'unix_socket' => '',
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_0900_ai_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            // Setiap koneksi memasang zona waktu sesi UTC, sama dengan nilai
            // bawaan kolom UTC_TIMESTAMP(3). Waktu yang ditulis aplikasi juga
            // UTC (lihat App\Support\Time\Clock); fungsi waktu MySQL tidak
            // dipakai untuk membandingkan apa pun.
            'timezone' => '+00:00',
            'options' => [
                // Prepared statement asli: INT dan BIGINT terbaca sebagai int
                // PHP, bukan string, sehingga langsung menjadi angka JSON.
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ],
        ],
    ],

    // Skema hanya berasal dari db/migrations di akar repo; backend ini tidak
    // punya migration Laravel. Nama tabel di bawah tidak pernah dibuat.
    'migrations' => [
        'table' => 'migrations',
        'update_date_on_publish' => false,
    ],
];
