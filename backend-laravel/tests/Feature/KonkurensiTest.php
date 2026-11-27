<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Feature;

use App\Support\Database\Transaksi;
use App\Support\Http\ApiError;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\DB;
use PDOException;
use Throwable;

/**
 * Pengulangan transaksi saat deadlock (errno 1213) dan batas tunggu kunci (errno 1205), dengan facade DB
 * yang diganti objek tiruan (tanpa MySQL). Perilaku serentak sungguhan diuji
 * tes kontrak tes/serentak.test.ts lewat PHP-FPM atau jembatan CGI.
 */
final class KonkurensiTest extends TestCase
{
    private static function mysqlError(int $errno): QueryException
    {
        $pdo = new PDOException('SQLSTATE[40001]: '.$errno);
        $pdo->errorInfo = ['40001', $errno, 'galat uji'];

        return new QueryException('mysql', 'update counters set value = value + 1', [], $pdo);
    }

    /**
     * Pengganti DB: transaction() melempar galat dari $errors berurutan,
     * lalu menjalankan callback bila daftar galatnya habis.
     *
     * @param  list<Throwable>  $errors
     */
    private static function fakeDb(array $errors, int $level = 0): object
    {
        return new class($errors, $level)
        {
            public int $attempts = 0;

            /** @param  list<Throwable>  $errors */
            public function __construct(private array $errors, private readonly int $level) {}

            public function transactionLevel(): int
            {
                return $this->level;
            }

            public function transaction(Closure $callback): mixed
            {
                $this->attempts++;
                if ($this->errors !== []) {
                    throw array_shift($this->errors);
                }

                return $callback();
            }
        };
    }

    public function test_deadlock_and_lock_wait_timeout_are_retried_until_success(): void
    {
        DB::swap($db = self::fakeDb([self::mysqlError(1213), self::mysqlError(1205)]));

        $this->assertSame('tersimpan', Transaksi::jalankan(fn () => 'tersimpan'));
        $this->assertSame(3, $db->attempts);
    }

    public function test_gives_up_after_three_retries(): void
    {
        DB::swap($db = self::fakeDb(array_fill(0, 10, self::mysqlError(1213))));

        try {
            Transaksi::jalankan(fn () => null);
            $this->fail('seharusnya menyerah');
        } catch (QueryException) {
            $this->assertSame(1 + Transaksi::MAX_RETRIES, $db->attempts);
        }
    }

    public function test_other_errors_are_not_retried(): void
    {
        DB::swap($db = self::fakeDb([ApiError::conflict('email_taken')]));

        try {
            Transaksi::jalankan(fn () => null);
            $this->fail('seharusnya 409');
        } catch (ApiError) {
            $this->assertSame(1, $db->attempts);
        }
    }

    public function test_nested_transaction_leaves_retrying_to_the_outermost(): void
    {
        DB::swap($db = self::fakeDb([self::mysqlError(1213)], level: 1));

        try {
            Transaksi::jalankan(fn () => null);
            $this->fail('seharusnya diteruskan ke transaksi luar');
        } catch (QueryException) {
            $this->assertSame(1, $db->attempts);
        }
    }
}
