<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Backend bengkel tidak menyimpan berkas apa pun. Disk lokal bawaan Laravel
// diberi "serve" => true, yang otomatis mendaftarkan rute GET/PUT
// /storage/{path}; rute itu tidak ada di kontrak, jadi dimatikan supaya
// /storage/... dijawab 404 seperti rute tak dikenal lainnya.
return [
    'default' => 'local',

    'disks' => [
        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => false,
            'throw' => false,
        ],
    ],
];
