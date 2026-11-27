<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Sesi\Contracts\SesiRepositoryInterface;
use App\Modules\Sesi\SesiService;
use App\Modules\Sesi\SesiStaf;
use App\Support\Http\ApiResponse;
use App\Support\Time\Clock;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Tests\Fakes\FakeSesiRepository;
use Tests\Fakes\FixedClock;

/**
 * Seluruh pipa HTTP Laravel tanpa database: middleware global, alias
 * middleware, dan penangan galat. Rute di bawah hanya ada di tes ini, untuk
 * membuktikan urutan pemeriksaan kontrak 413/400 → 401 → 403 → 422, matriks
 * peran (pemilik, kasir, mekanik), dan rute staf tanpa badan yang mengabaikan
 * badannya sepenuhnya.
 */
final class PipelineTest extends TestCase
{
    private const OWNER_ID = '11111111-1111-4111-8111-111111111111';

    private const CASHIER_ID = '33333333-3333-4333-8333-333333333333';

    private const MECHANIC_ID = '55555555-5555-4555-8555-555555555555';

    private FakeSesiRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = new FakeSesiRepository;
        $this->repository->staff[self::OWNER_ID] = ['role' => 'owner', 'active' => true];
        $this->repository->staff[self::CASHIER_ID] = ['role' => 'cashier', 'active' => true];
        $this->repository->staff[self::MECHANIC_ID] = ['role' => 'mechanic', 'active' => true];
        $this->app->instance(SesiRepositoryInterface::class, $this->repository);
        $this->app->instance(Clock::class, new FixedClock);

        Route::post('api/__uji/pemilik', function (Request $request) {
            $body = $request->attributes->get(JsonObject::ATTRIBUTE);
            $name = $body->text('name', new TextRule(trim: true, max: 100));
            $body->throwIfInvalid();

            return ApiResponse::data(['name' => $name, 'staffId' => SesiStaf::dari($request)->staffId], 201);
        })->middleware(['json', 'staff', 'peran:owner']);
        Route::post('api/__uji/kasir', fn (Request $request) => ApiResponse::data(['role' => SesiStaf::dari($request)->peran->value]))
            ->middleware(['json', 'staff', 'peran:owner,cashier']);
        Route::post('api/__uji/tanpa-badan', fn (Request $request) => ApiResponse::data(['role' => SesiStaf::dari($request)->peran->value]))
            ->middleware('staff');
        Route::post('api/__uji/publik', function (Request $request) {
            $body = $request->attributes->get(JsonObject::ATTRIBUTE);
            $note = $body->text('note', new TextRule(trim: true, max: 10));
            $body->throwIfInvalid();

            return ApiResponse::data(['note' => $note], 201);
        })->middleware('json');
    }

    private function token(string $staffId): string
    {
        return $this->app->make(SesiService::class)->buka($staffId);
    }

    /** @param  array<string, string>  $headers */
    private function postRaw(string $uri, string $body, array $headers = []): TestResponse
    {
        $server = ['CONTENT_TYPE' => 'application/json'];
        foreach ($headers as $name => $value) {
            $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
        }

        return $this->call('POST', $uri, [], [], [], $server, $body);
    }

    private function assertError(TestResponse $response, int $status, string $code): void
    {
        $response->assertStatus($status);
        $this->assertSame($code, $response->json('error.code'));
        $this->assertIsString($response->json('error.message'));
    }

    public function test_health(): void
    {
        $this->get('/api/health')->assertStatus(200)->assertExactJson(['status' => 'ok']);
    }

    public function test_unknown_route_wrong_method_head_and_options_are_404(): void
    {
        $this->assertError($this->get('/api/tidak-ada'), 404, 'not_found');
        $this->assertError($this->post('/api/health'), 404, 'not_found');
        $this->assertError($this->call('OPTIONS', '/api/health'), 404, 'not_found');
        $this->call('HEAD', '/api/health')->assertStatus(404);
    }

    public function test_untidy_paths_are_404(): void
    {
        // Pembantu $this->get() merapikan URL lebih dulu (garis miring di
        // akhir dibuang), jadi permintaan dikirim langsung ke kernel HTTP
        // supaya path mentahnya sampai ke aplikasi apa adanya.
        $kernel = $this->app->make(Kernel::class);
        foreach (['/api/health/', '/api//health', '/api/./health', '/api/x/../health'] as $path) {
            $response = TestResponse::fromBaseResponse($kernel->handle(Request::create('http://localhost'.$path)));
            $this->assertError($response, 404, 'not_found');
        }
    }

    public function test_path_through_script_name_is_404(): void
    {
        // Seperti di balik PHP-FPM: /index.php/api/health membuat Symfony
        // menganggap /index.php sebagai base URL dan /api/health sebagai path.
        $kernel = $this->app->make(Kernel::class);
        $request = Request::create('http://localhost/index.php/api/health', 'GET', [], [], [], [
            'SCRIPT_FILENAME' => base_path('public/index.php'),
            'SCRIPT_NAME' => '/index.php',
            'PHP_SELF' => '/index.php/api/health',
        ]);

        $this->assertSame('/index.php', $request->getBaseUrl());
        $this->assertError(TestResponse::fromBaseResponse($kernel->handle($request)), 404, 'not_found');
    }

    public function test_body_is_checked_before_token(): void
    {
        $this->assertError($this->postRaw('/api/__uji/pemilik', '{"name":'), 400, 'bad_request');
        $this->assertError($this->postRaw('/api/__uji/pemilik', '[]'), 400, 'bad_request');
        $this->assertError(
            $this->postRaw('/api/__uji/pemilik', '{"name":"'.str_repeat('a', 1024 * 1024).'"}'),
            413, 'payload_too_large',
        );
        $this->assertError($this->postRaw('/api/__uji/pemilik', '{}'), 401, 'unauthenticated');
    }

    public function test_cashier_is_403_before_validation_and_owner_reaches_controller(): void
    {
        $cashier = $this->token(self::CASHIER_ID);
        $owner = $this->token(self::OWNER_ID);

        $this->assertError($this->postRaw('/api/__uji/pemilik', '{}', ['Authorization' => 'Bearer '.$cashier]), 403, 'forbidden');

        $invalid = $this->postRaw('/api/__uji/pemilik', '{"name":123}', ['Authorization' => 'Bearer '.$owner]);
        $this->assertError($invalid, 422, 'validation_failed');
        $this->assertSame(['name' => 'invalid_type'], $invalid->json('error.fields'));

        $this->postRaw('/api/__uji/pemilik', '{"name":"  Ani  "}', ['Authorization' => 'Bearer '.$owner])
            ->assertStatus(201)
            ->assertExactJson(['data' => ['name' => 'Ani', 'staffId' => self::OWNER_ID]]);
    }

    public function test_public_route_ignores_the_authorization_header_completely(): void
    {
        // Rute publik (security: []) tidak memeriksa token, termasuk token yang rusak.
        foreach (['Bearer rusak', 'Basic abc', 'Bearer '.str_repeat('a', 43)] as $header) {
            $this->postRaw('/api/__uji/publik', '{"note":"  halo  "}', ['Authorization' => $header])
                ->assertStatus(201)
                ->assertExactJson(['data' => ['note' => 'halo']]);
        }
        // Urutan rute publik: 413 → 400 → 422; tidak ada 401 dan 403.
        $this->assertError($this->postRaw('/api/__uji/publik', '{"note":'), 400, 'bad_request');
        $this->assertError($this->postRaw('/api/__uji/publik', '{"note":"01234567890"}'), 422, 'validation_failed');
    }

    public function test_unknown_route_is_404_before_the_body_is_read(): void
    {
        // Rute dicocokkan lebih dulu dari 413 dan 400.
        $this->assertError($this->postRaw('/api/tidak-ada', '{"x":'.str_repeat('a', 1024 * 1024)), 404, 'not_found');
        $this->assertError($this->postRaw('/api/tidak-ada', '['), 404, 'not_found');
    }

    public function test_owner_and_cashier_route_refuses_the_mechanic(): void
    {
        foreach ([self::OWNER_ID => 'owner', self::CASHIER_ID => 'cashier'] as $id => $role) {
            $this->postRaw('/api/__uji/kasir', '{}', ['Authorization' => 'Bearer '.$this->token($id)])
                ->assertStatus(200)
                ->assertExactJson(['data' => ['role' => $role]]);
        }
        $mechanic = $this->token(self::MECHANIC_ID);
        $this->assertError($this->postRaw('/api/__uji/kasir', '{}', ['Authorization' => 'Bearer '.$mechanic]), 403, 'forbidden');
        $this->assertError($this->postRaw('/api/__uji/pemilik', '{}', ['Authorization' => 'Bearer '.$mechanic]), 403, 'forbidden');
    }

    public function test_staff_route_without_body_ignores_broken_and_huge_bodies(): void
    {
        // Rute staf tanpa badan: badan diabaikan sepenuhnya, termasuk JSON
        // rusak dan badan di atas 1 MiB (tidak ada 400 dan 413).
        $mechanic = $this->token(self::MECHANIC_ID);
        foreach (['{', '[]', str_repeat('a', 1024 * 1024 + 1)] as $body) {
            $this->postRaw('/api/__uji/tanpa-badan', $body, ['Authorization' => 'Bearer '.$mechanic])
                ->assertStatus(200)
                ->assertExactJson(['data' => ['role' => 'mechanic']]);
        }
        $this->assertError($this->postRaw('/api/__uji/tanpa-badan', '{'), 401, 'unauthenticated');
    }

    public function test_inactive_staff_and_bad_authorization_headers_are_401(): void
    {
        $token = $this->token(self::CASHIER_ID);
        foreach (['Bearer  '.$token, "Bearer\t".$token, 'Basic '.$token, 'Bearer', $token, 'Bearer '.$token.'x'] as $header) {
            $this->assertError($this->postRaw('/api/__uji/tanpa-badan', '', ['Authorization' => $header]), 401, 'unauthenticated');
        }
        // Nama skema tidak peka huruf besar/kecil, dan spasi di tepi nilai header diabaikan.
        $this->postRaw('/api/__uji/tanpa-badan', '', ['Authorization' => '  bEaReR '.$token.' '])->assertStatus(200);

        $this->repository->staff[self::CASHIER_ID]['active'] = false;
        $this->assertError($this->postRaw('/api/__uji/tanpa-badan', '', ['Authorization' => 'Bearer '.$token]), 401, 'unauthenticated');
    }

    public function test_role_change_applies_on_the_next_request(): void
    {
        // Peran dibaca dari database setiap permintaan, bukan disimpan di sesi.
        $token = $this->token(self::CASHIER_ID);
        $this->repository->staff[self::CASHIER_ID]['role'] = 'mechanic';

        $this->assertError($this->postRaw('/api/__uji/kasir', '{}', ['Authorization' => 'Bearer '.$token]), 403, 'forbidden');
    }
}
