<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Sesi API memakai token Bearer di tabel staff_sessions
// (modul Sesi), bukan sesi Laravel. Driver "array" memastikan Laravel tidak
// pernah mencari tabel "sessions" bawaannya.
return [
    'driver' => 'array',
    'lifetime' => 120,
    'expire_on_close' => false,
    'encrypt' => false,
    'cookie' => 'bengkel_session',
    'path' => '/',
    'domain' => null,
    'secure' => null,
    'http_only' => true,
    'same_site' => 'lax',
];
