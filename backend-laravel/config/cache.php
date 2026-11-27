<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Bawaan Laravel memakai tabel "cache" di database, padahal skema bengkel
// hanya berasal dari db/migrations. Backend ini tidak menyimpan cache apa pun,
// jadi cukup memori per permintaan.
return [
    'default' => 'array',
    'stores' => [
        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],
    ],
    'prefix' => 'bengkel',
];
