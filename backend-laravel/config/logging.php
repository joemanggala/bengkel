<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

use Monolog\Handler\NullHandler;
use Monolog\Handler\StreamHandler;

// Log ditulis ke stderr proses server, sama seperti backend Go yang menulis ke
// terminal. Di produksi, pengelola proses (systemd, Docker) yang menampung dan
// memutar lognya.
return [
    'default' => 'stderr',

    'deprecations' => [
        'channel' => 'null',
        'trace' => false,
    ],

    'channels' => [
        'stderr' => [
            'driver' => 'monolog',
            'level' => 'info',
            'handler' => StreamHandler::class,
            'with' => ['stream' => 'php://stderr'],
            'processors' => [],
        ],
        'null' => [
            'driver' => 'monolog',
            'handler' => NullHandler::class,
        ],
    ],
];
