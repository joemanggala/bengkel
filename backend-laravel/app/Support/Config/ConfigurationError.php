<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Config;

use RuntimeException;

/** Env kosong atau tidak sah; pesannya hanya menyebut nama env, tidak pernah isinya. */
final class ConfigurationError extends RuntimeException {}
