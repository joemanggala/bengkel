<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Config\Settings;
use App\Support\WhatsApp\WhatsAppClient;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\RequestInterface;

/** Klien kirim berbentuk Fonnte: bentuk permintaan dan cara membaca "terkirim". */
final class WhatsAppClientTest extends TestCase
{
    private static function settings(): Settings
    {
        $env = [
            'PORT' => '8882',
            'DATABASE_URL' => 'mysql://u:p@127.0.0.1:3350/bengkel_uji_laravel',
            'WA_API_URL' => 'http://localhost:8892/send',
            'WA_TOKEN' => 'token-wa-uji',
            'PUBLIC_WEB_URL' => 'http://localhost:3800',
        ];

        return Settings::fromReader(fn (string $name): string => $env[$name] ?? '');
    }

    /**
     * @param  list<Response|\Throwable>  $responses
     * @param  list<array{request: RequestInterface}>  $history
     */
    private static function client(array $responses, array &$history = []): WhatsAppClient
    {
        $stack = HandlerStack::create(new MockHandler($responses));
        $stack->push(Middleware::history($history));

        return new WhatsAppClient(self::settings(), new Client(['handler' => $stack]));
    }

    public function test_request_is_multipart_with_exactly_target_and_message_and_raw_token(): void
    {
        $history = [];
        $result = self::client([new Response(200, [], '{"detail":"success! message in queue","status":true}')], $history)
            ->send('6281234567890', "Baris satu\nBaris dua");

        $this->assertTrue($result->sent);
        $this->assertNull($result->failureReason);
        $request = $history[0]['request'];
        $this->assertSame('POST', $request->getMethod());
        $this->assertSame('http://localhost:8892/send', (string) $request->getUri());
        // Fonnte membaca token apa adanya, tanpa "Bearer".
        $this->assertSame('token-wa-uji', $request->getHeaderLine('Authorization'));
        $this->assertStringStartsWith('multipart/form-data; boundary=', $request->getHeaderLine('Content-Type'));
        $body = (string) $request->getBody();
        $this->assertSame(2, substr_count($body, 'Content-Disposition: form-data;'));
        $this->assertStringContainsString("name=\"target\"\r\n\r\n6281234567890\r\n", $body);
        // Pergantian baris di pesan tetap LF; tidak ada berkas (filename) di bagian mana pun.
        $this->assertStringContainsString("name=\"message\"\r\n\r\nBaris satu\nBaris dua\r\n", $body);
        $this->assertStringNotContainsString('filename=', $body);
    }

    /** @return array<string, array{Response|\Throwable, string}> */
    public static function failures(): array
    {
        $request = new Request('POST', 'http://localhost:8892/send');

        return [
            'status false dengan alasan' => [new Response(200, [], '{"reason":"token invalid","status":false}'), 'token invalid'],
            'Status huruf besar tanpa status' => [new Response(200, [], '{"Status":false,"reason":"token invalid"}'), 'token invalid'],
            'status bukan boolean true' => [new Response(200, [], '{"status":"true"}'), 'penyedia tidak menerima pesan'],
            'HTTP 500 berbadan HTML' => [new Response(500, [], '<html>galat</html>'), 'HTTP 500'],
            'badan bukan JSON' => [new Response(200, [], 'ok'), 'balasan penyedia bukan objek JSON'],
            'waktu habis' => [new ConnectException('cURL error 28: Operation timed out after 10001 milliseconds', $request), 'waktu habis'],
            'koneksi ditolak' => [new ConnectException('cURL error 7: Failed to connect to localhost port 8892', $request), 'gagal terhubung ke penyedia (cURL 7)'],
        ];
    }

    #[DataProvider('failures')]
    public function test_only_2xx_json_object_with_status_true_counts_as_sent(Response|\Throwable $response, string $reason): void
    {
        $result = self::client([$response])->send('6281234567890', 'Halo');

        $this->assertFalse($result->sent);
        $this->assertSame($reason, $result->failureReason);
    }

    public function test_failure_reason_is_cut_to_255_characters(): void
    {
        $result = self::client([new Response(200, [], json_encode(['status' => false, 'reason' => str_repeat('é', 300)]))])
            ->send('6281234567890', 'Halo');

        $this->assertSame(255, mb_strlen((string) $result->failureReason));
    }
}
