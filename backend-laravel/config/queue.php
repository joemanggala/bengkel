<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Tidak ada antrean: pesan WhatsApp dikirim sinkron di dalam permintaan,
// karena balasan HTTP memuat hasil kirimnya (terkirim atau gagal). "sync" juga
// mencegah Laravel mencari tabel "jobs" bawaannya.
return [
    'default' => 'sync',
    'connections' => [
        'sync' => ['driver' => 'sync'],
    ],
    'failed' => [
        'driver' => 'null',
    ],
];
