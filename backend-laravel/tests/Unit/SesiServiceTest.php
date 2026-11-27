<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Sesi\Peran;
use App\Modules\Sesi\SesiService;
use App\Support\Http\ApiError;
use App\Support\Security\SecretToken;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Fakes\FakeSesiRepository;
use Tests\Fakes\FixedClock;

/** Guard sesi Bearer staf: token hanya disimpan hash-nya, masa berlaku bergeser. */
final class SesiServiceTest extends TestCase
{
    private const STAFF_ID = '11111111-1111-4111-8111-111111111111';

    private FakeSesiRepository $repository;

    private FixedClock $clock;

    private SesiService $service;

    protected function setUp(): void
    {
        $this->repository = new FakeSesiRepository;
        $this->repository->staff[self::STAFF_ID] = ['role' => 'cashier', 'active' => true];
        $this->clock = new FixedClock('2026-10-31 07:00:00.000');
        $this->service = new SesiService($this->repository, $this->clock);
    }

    private function expectUnauthenticated(callable $call): void
    {
        try {
            $call();
            $this->fail('seharusnya 401');
        } catch (ApiError $e) {
            $this->assertSame(401, $e->status);
            $this->assertSame('unauthenticated', $e->errorCode);
        }
    }

    public function test_opened_staff_session_stores_only_the_hash_with_30_day_expiry(): void
    {
        $token = $this->service->buka(self::STAFF_ID);

        $this->assertTrue(SecretToken::valid($token));
        $rows = array_values($this->repository->rows);
        $this->assertCount(1, $rows);
        $this->assertSame(SecretToken::hash($token), $rows[0]['tokenHash']);
        $this->assertSame('2026-11-30 07:00:00.000', $rows[0]['expiresAt']);
        $this->assertSame('2026-10-31 07:00:00.000', $rows[0]['lastUsedAt']);

        $sesi = $this->service->periksaStaf('Bearer '.$token);
        $this->assertSame(self::STAFF_ID, $sesi->staffId);
        $this->assertSame(Peran::Kasir, $sesi->peran);
        $this->assertFalse($sesi->pemilik());
    }

    /** @return array<string, array{string}> */
    public static function badHeaders(): array
    {
        return [
            'tanpa header' => [''],
            'skema lain' => ['Basic '.str_repeat('a', 43)],
            'tanpa spasi' => ['Bearer'],
            'token kosong' => ['Bearer '],
            'dua spasi' => ['Bearer  '.str_repeat('a', 43)],
            'token terlalu pendek' => ['Bearer '.str_repeat('a', 42)],
            'token sah tetapi tidak dikenal' => ['Bearer '.str_repeat('a', 43)],
        ];
    }

    #[DataProvider('badHeaders')]
    public function test_every_bad_header_is_the_same_401(string $header): void
    {
        $this->service->buka(self::STAFF_ID);

        $this->expectUnauthenticated(fn () => $this->service->periksaStaf($header));
    }

    public function test_scheme_name_is_case_insensitive(): void
    {
        $token = $this->service->buka(self::STAFF_ID);

        $this->assertSame(self::STAFF_ID, $this->service->periksaStaf('bEaReR '.$token)->staffId);
    }

    public function test_inactive_staff_is_401(): void
    {
        $token = $this->service->buka(self::STAFF_ID);
        $this->repository->staff[self::STAFF_ID]['active'] = false;

        $this->expectUnauthenticated(fn () => $this->service->periksaStaf('Bearer '.$token));
    }

    public function test_expired_session_is_401(): void
    {
        $token = $this->service->buka(self::STAFF_ID);
        $this->clock->advanceSeconds(30 * 24 * 60 * 60);

        $this->expectUnauthenticated(fn () => $this->service->periksaStaf('Bearer '.$token));
    }

    public function test_session_slides_but_writes_at_most_once_per_five_minutes(): void
    {
        $token = $this->service->buka(self::STAFF_ID);
        $id = array_key_first($this->repository->rows);

        // Tepat 5 menit belum ditulis; "lebih dari 5 menit" baru ditulis.
        $this->clock->advanceSeconds(300);
        $this->service->periksaStaf('Bearer '.$token);
        $this->assertSame([], $this->repository->touched);

        $this->clock->advanceSeconds(1);
        $sesi = $this->service->periksaStaf('Bearer '.$token);
        $this->assertSame([$id], $this->repository->touched);
        $this->assertSame('2026-11-30 07:05:01.000', $sesi->expiresAt);
        $this->assertSame('2026-10-31 07:05:01.000', $sesi->lastUsedAt);
        $this->assertSame('2026-11-30 07:05:01.000', $this->repository->rows[$id]['expiresAt']);
    }

    public function test_sliding_keeps_an_active_session_alive_past_the_first_expiry(): void
    {
        $token = $this->service->buka(self::STAFF_ID);
        // Dipakai tepat sebelum habis, lalu lagi 29 hari kemudian.
        $this->clock->advanceSeconds(30 * 24 * 60 * 60 - 1);
        $this->service->periksaStaf('Bearer '.$token);
        $this->clock->advanceSeconds(29 * 24 * 60 * 60);

        $this->assertSame(self::STAFF_ID, $this->service->periksaStaf('Bearer '.$token)->staffId);
    }

    public function test_logout_removes_only_the_current_session(): void
    {
        $first = $this->service->buka(self::STAFF_ID);
        $second = $this->service->buka(self::STAFF_ID);

        $this->service->tutup($this->service->periksaStaf('Bearer '.$first));

        $this->expectUnauthenticated(fn () => $this->service->periksaStaf('Bearer '.$first));
        $this->assertSame(self::STAFF_ID, $this->service->periksaStaf('Bearer '.$second)->staffId);
    }

    public function test_opening_a_session_only_inserts_and_cleanup_is_separate(): void
    {
        $this->service->buka(self::STAFF_ID);
        $this->clock->advanceSeconds(30 * 24 * 60 * 60);
        $this->service->buka(self::STAFF_ID);

        // buka() hanya INSERT, supaya transaksi masuk tetap pendek.
        $this->assertCount(2, $this->repository->rows);

        $this->service->bersihkanKedaluwarsa(self::STAFF_ID);
        $this->assertCount(1, $this->repository->rows);
    }

    public function test_revoking_keeps_only_the_excepted_session(): void
    {
        $first = $this->service->buka(self::STAFF_ID);
        $second = $this->service->buka(self::STAFF_ID);
        $keep = $this->service->periksaStaf('Bearer '.$second)->sesiId;

        $this->service->cabutSemua(self::STAFF_ID, $keep);

        $this->expectUnauthenticated(fn () => $this->service->periksaStaf('Bearer '.$first));
        $this->assertSame([$keep], array_keys($this->repository->rows));
    }
}
