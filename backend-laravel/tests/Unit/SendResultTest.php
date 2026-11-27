<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Database\SqlError;
use App\Support\WhatsApp\SendResult;
use Illuminate\Database\QueryException;
use PDOException;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/** Alasan gagal kirim yang aman disimpan, dan galat MySQL yang boleh diulang. */
final class SendResultTest extends TestCase
{
    private const TOKEN = 'token-wa-uji-bengkel-bukan-kunci-asli';

    public function test_token_is_masked_before_cutting(): void
    {
        $result = SendResult::failed('token tidak dikenali: '.self::TOKEN.' (ulang: '.self::TOKEN.')', self::TOKEN);

        $this->assertFalse($result->sent);
        $this->assertSame('token tidak dikenali: *** (ulang: ***)', $result->failureReason);
    }

    public function test_reason_is_cut_to_255_code_points_not_bytes(): void
    {
        $result = SendResult::failed('gagal kirim: '.str_repeat('é', 600), self::TOKEN);

        $this->assertSame(255, mb_strlen((string) $result->failureReason, 'UTF-8'));
        $this->assertTrue(mb_check_encoding((string) $result->failureReason, 'UTF-8'));
    }

    public function test_token_cut_in_half_by_the_limit_never_survives(): void
    {
        // Disamarkan dulu baru dipotong: potongan token di ujung tidak mungkin tersisa.
        $result = SendResult::failed(str_repeat('a', 240).self::TOKEN, self::TOKEN);

        $this->assertStringNotContainsString(substr(self::TOKEN, 0, 15), (string) $result->failureReason);
    }

    public function test_empty_reason_is_replaced(): void
    {
        $this->assertSame('gagal tanpa keterangan', SendResult::failed('   ', self::TOKEN)->failureReason);
        $this->assertSame('gagal tanpa keterangan', SendResult::failed('', self::TOKEN)->failureReason);
        $this->assertSame('***', SendResult::failed(self::TOKEN, self::TOKEN)->failureReason);
    }

    public function test_deadlock_and_lock_wait_timeout_are_retryable(): void
    {
        $this->assertTrue(SqlError::isConcurrencyConflict(self::queryError(1213, 'Deadlock found when trying to get lock')));
        $this->assertTrue(SqlError::isConcurrencyConflict(self::queryError(1205, 'Lock wait timeout exceeded')));
        $this->assertFalse(SqlError::isConcurrencyConflict(self::queryError(1062, "Duplicate entry 'x' for key 'staff.staff_email_key'")));
        $this->assertFalse(SqlError::isConcurrencyConflict(new RuntimeException('lain')));
        $this->assertSame(1213, SqlError::errno(self::queryError(1213, 'Deadlock')));
    }

    private static function queryError(int $errno, string $message): QueryException
    {
        $pdo = new PDOException('SQLSTATE[HY000]: '.$errno.' '.$message);
        $pdo->errorInfo = ['HY000', $errno, $message];

        return new QueryException('mysql', 'insert into staff ...', [], $pdo);
    }
}
