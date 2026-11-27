<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Router untuk server HTTP bawaan PHP (php -S), dipakai `php artisan bengkel:serve`.
//
// Berbeda dengan router bawaan `php artisan serve`, berkas ini tidak pernah
// melayani berkas statis: setiap permintaan, apa pun path-nya, diteruskan ke
// Laravel, sehingga semua balasan (termasuk 404) berbentuk galat kontrak.
require __DIR__.'/public/index.php';
