<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Monolog\Handler\TestHandler;
use PDOException;

/**
 * Galat 500 dicatat tanpa data: tanpa nilai binding SQL, tanpa pesan driver,
 * dan tanpa badan permintaan. Log ditangkap TestHandler Monolog.
 */
final class LogGalatTest extends TestCase
{
    private const PHONE = '6281234567890';

    private const HASH = '5c58b6c47bf374b10cbdb833d5335ddf928d3662799a1e9fb8b64e07a0f885f7';

    private TestHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->handler = new TestHandler;
        config(['logging.channels.uji' => ['driver' => 'monolog', 'handler' => TestHandler::class]]);
        config(['logging.default' => 'uji']);
        Log::channel('uji')->setHandlers([$this->handler]);

        Route::post('api/__uji/token/{trackingToken}', function () {
            throw new \RuntimeException('gagal sesudah token terbaca');
        })->middleware('json');

        Route::post('api/__uji/galat-query', function () {
            $pdo = new PDOException('SQLSTATE[40001]: 1213 Deadlock found ... values ('.self::PHONE.', '.self::HASH.')');
            $pdo->errorInfo = ['40001', 1213, 'Deadlock found when trying to get lock'];

            throw new QueryException('mysql', 'insert into `bookings` (`customer_phone`, `booking_token_hash`) values (?, ?)', [self::PHONE, self::HASH], $pdo);
        })->middleware('json');
    }

    public function test_unexpected_query_error_is_500_and_logged_without_values(): void
    {
        $response = $this->call('POST', '/api/__uji/galat-query', [], [], [], ['CONTENT_TYPE' => 'application/json'],
            '{"phone":"'.self::PHONE.'"}');

        $response->assertStatus(500);
        $this->assertSame('internal_error', $response->json('error.code'));

        $records = $this->handler->getRecords();
        $this->assertCount(1, $records);
        $record = $records[0];
        $this->assertSame('permintaan gagal', $record->message);
        $this->assertSame('POST api/__uji/galat-query', $record->context['rute']);
        $this->assertSame(QueryException::class, $record->context['galat']);
        $this->assertSame(1213, $record->context['kode']);
        $this->assertSame('insert into `bookings` (`customer_phone`, `booking_token_hash`) values (?, ?)', $record->context['sql']);

        $logged = json_encode([$record->message, $record->context], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $this->assertStringNotContainsString(self::PHONE, (string) $logged);
        $this->assertStringNotContainsString(self::HASH, (string) $logged);
        $this->assertStringNotContainsString('Deadlock found', (string) $logged);
    }

    // Token di path (token booking, token lacak SPK) adalah kunci ke data pelanggan:
    // log hanya boleh memuat pola rutenya.
    public function test_route_pattern_not_real_path_is_logged_so_tokens_never_reach_the_log(): void
    {
        $token = 'Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MEFCQ0RFRkdISUo';

        $response = $this->call('POST', '/api/__uji/token/'.$token, [], [], [], ['CONTENT_TYPE' => 'application/json'], '{}');

        $response->assertStatus(500);
        $records = $this->handler->getRecords();
        $this->assertCount(1, $records);
        $this->assertSame('POST api/__uji/token/{trackingToken}', $records[0]->context['rute']);
        $logged = json_encode([$records[0]->message, $records[0]->context], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $this->assertStringNotContainsString($token, (string) $logged);
    }
}
