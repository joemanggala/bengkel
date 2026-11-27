<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Http\LogAkses;
use PHPUnit\Framework\TestCase;

/** Log akses server bawaan PHP tidak boleh memuat query string maupun token publik. */
final class LogAksesTest extends TestCase
{
    private const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE';

    public function test_query_string_is_removed(): void
    {
        $this->assertSame(
            "[Fri Nov 27 03:30:01 2026] 127.0.0.1:50321 [200]: GET /api/customers\n",
            LogAkses::bersihkan("[Fri Nov 27 03:30:01 2026] 127.0.0.1:50321 [200]: GET /api/customers?search=6281234567890&page=1\n"),
        );
    }

    public function test_public_tokens_in_the_path_are_masked(): void
    {
        $this->assertSame(43, strlen(self::TOKEN));
        $this->assertSame(
            '[x] 127.0.0.1:1 [200]: GET /api/public/bookings/{token}',
            LogAkses::bersihkan('[x] 127.0.0.1:1 [200]: GET /api/public/bookings/'.self::TOKEN),
        );
        $this->assertSame(
            '[x] 127.0.0.1:1 [200]: GET /api/public/work-orders/{token}',
            LogAkses::bersihkan('[x] 127.0.0.1:1 [200]: GET /api/public/work-orders/'.self::TOKEN),
        );
        $this->assertSame(
            '[x] 127.0.0.1:1 [200]: POST /api/public/bookings/{token}/cancel',
            LogAkses::bersihkan('[x] 127.0.0.1:1 [200]: POST /api/public/bookings/'.self::TOKEN.'/cancel'),
        );
    }

    public function test_other_lines_pass_through_unchanged(): void
    {
        foreach (['[x] 127.0.0.1:1 [404]: GET /api/tidak-ada', 'PHP Warning:  sesuatu di baris 3', '', "[x] Development Server (http://127.0.0.1:8882) started\n"] as $baris) {
            $this->assertSame($baris, LogAkses::bersihkan($baris));
        }
    }

    public function test_work_orders_by_number_keep_their_path(): void
    {
        $this->assertSame(
            '[x] 127.0.0.1:1 [200]: POST /api/work-orders/S-0007/status',
            LogAkses::bersihkan('[x] 127.0.0.1:1 [200]: POST /api/work-orders/S-0007/status'),
        );
    }
}
