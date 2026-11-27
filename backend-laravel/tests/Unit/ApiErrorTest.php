<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Database\SqlError;
use App\Support\Http\ApiError;
use App\Support\Http\ErrorRenderer;
use Illuminate\Database\QueryException;
use LogicException;
use PDOException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/** Bentuk galat kontrak {"error": {"code", "message", "fields"?}}. */
final class ApiErrorTest extends TestCase
{
    public function test_error_without_fields_has_no_fields_key(): void
    {
        $response = ApiError::unauthenticated()->render();

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame('application/json', $response->headers->get('Content-Type'));
        $this->assertSame(
            '{"error":{"code":"unauthenticated","message":"Autentikasi tidak sah atau sudah berakhir"}}',
            $response->getContent(),
        );
    }

    /**
     * Pesan baku dari KodeGalat.x-pesan-baku di spec, huruf demi huruf, supaya
     * web menampilkan teks yang sama apa pun backend-nya.
     *
     * @return array<string, array{int, string, string}> status, kode, pesan
     */
    public static function standardMessages(): array
    {
        return [
            'bad_request' => [400, 'bad_request', 'Badan permintaan tidak bisa dibaca'],
            'unauthenticated' => [401, 'unauthenticated', 'Autentikasi tidak sah atau sudah berakhir'],
            'invalid_credentials' => [401, 'invalid_credentials', 'Email atau kata sandi salah'],
            'forbidden' => [403, 'forbidden', 'Kamu tidak punya akses ke sumber ini'],
            'setup_disabled' => [403, 'setup_disabled', 'Pemasangan awal tidak aktif di server ini'],
            'setup_token_invalid' => [403, 'setup_token_invalid', 'Token pemasangan salah'],
            'already_set_up' => [409, 'already_set_up', 'Aplikasi sudah dipasang, silakan masuk dengan akun pemilik'],
            'email_taken' => [409, 'email_taken', 'Email sudah terdaftar'],
            'last_owner' => [409, 'last_owner', 'Harus tetap ada setidaknya satu pemilik yang aktif'],
            'phone_taken' => [409, 'phone_taken', 'Nomor HP sudah dipakai pelanggan lain'],
            'plate_taken' => [409, 'plate_taken', 'Plat nomor sudah terdaftar'],
            'plate_owned_by_other_customer' => [409, 'plate_owned_by_other_customer', 'Plat nomor ini terdaftar atas pelanggan lain, periksa lagi data booking'],
            'service_name_taken' => [409, 'service_name_taken', 'Nama jasa sudah dipakai'],
            'sku_taken' => [409, 'sku_taken', 'SKU sudah dipakai'],
            'status_transition_invalid' => [409, 'status_transition_invalid', 'Perubahan status SPK ini tidak diizinkan'],
            'not_paid_off' => [409, 'not_paid_off', 'Lunasi tagihan dulu sebelum kendaraan diserahkan'],
            'has_payments' => [409, 'has_payments', 'SPK yang sudah dibayar tidak bisa dibatalkan'],
            'work_order_locked' => [409, 'work_order_locked', 'SPK yang sudah selesai, diambil, atau dibatalkan tidak bisa diubah'],
            'work_order_empty' => [409, 'work_order_empty', 'Tambahkan item jasa atau sparepart dulu sebelum menandai selesai'],
            'total_below_paid' => [409, 'total_below_paid', 'Total SPK tidak boleh lebih kecil dari yang sudah dibayar'],
            'work_order_cancelled' => [409, 'work_order_cancelled', 'SPK ini sudah dibatalkan'],
            'already_picked_up' => [409, 'already_picked_up', 'Kendaraan sudah diambil'],
            'work_order_not_done' => [409, 'work_order_not_done', 'SPK ini belum selesai'],
            'booking_transition_invalid' => [409, 'booking_transition_invalid', 'Perubahan status booking ini tidak diizinkan'],
            'too_many_pending_bookings' => [409, 'too_many_pending_bookings', 'Nomor ini masih punya 3 booking yang menunggu konfirmasi'],
            'payload_too_large' => [413, 'payload_too_large', 'Badan permintaan terlalu besar'],
            'validation_failed' => [422, 'validation_failed', 'Data yang dikirim belum valid'],
            'internal_error' => [500, 'internal_error', 'Terjadi kesalahan di server, silakan coba lagi'],
            'wa_unavailable' => [503, 'wa_unavailable', 'WhatsApp tidak bisa dikirim saat ini, coba lagi nanti'],
        ];
    }

    #[DataProvider('standardMessages')]
    public function test_standard_message_matches_the_spec_letter_for_letter(int $status, string $code, string $message): void
    {
        $error = ApiError::of($status, $code);

        $this->assertSame($message, $error->getMessage());
        $this->assertSame($status, $error->status);
        $this->assertSame(
            json_encode(['error' => ['code' => $code, 'message' => $message]], JSON_UNESCAPED_UNICODE),
            $error->render()->getContent(),
        );
    }

    public function test_validation_error_lists_fields(): void
    {
        $response = ApiError::validation(['phone' => 'too_short', 'items.0.quantity' => 'out_of_range'])->render();

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame(
            '{"error":{"code":"validation_failed","message":"Data yang dikirim belum valid","fields":{"phone":"too_short","items.0.quantity":"out_of_range"}}}',
            $response->getContent(),
        );
    }

    public function test_not_found_message_may_be_specific(): void
    {
        $this->assertSame(
            '{"error":{"code":"not_found","message":"SPK tidak ditemukan"}}',
            ApiError::notFound('SPK tidak ditemukan')->render()->getContent(),
        );
    }

    public function test_unknown_route_and_wrong_method_are_both_404(): void
    {
        foreach ([new NotFoundHttpException, new MethodNotAllowedHttpException(['GET'])] as $e) {
            $response = ErrorRenderer::render($e);
            $this->assertSame(404, $response->getStatusCode());
            $this->assertSame('{"error":{"code":"not_found","message":"Rute tidak ditemukan"}}', $response->getContent());
        }
    }

    public function test_unexpected_failure_is_500_without_leaking_its_message(): void
    {
        $response = ErrorRenderer::render(new RuntimeException('SQLSTATE rahasia di /srv/bengkel'));

        $this->assertSame(500, $response->getStatusCode());
        $this->assertSame(
            '{"error":{"code":"internal_error","message":"Terjadi kesalahan di server, silakan coba lagi"}}',
            $response->getContent(),
        );
    }

    public function test_code_without_standard_message_is_a_programming_error(): void
    {
        $this->expectException(LogicException::class);
        ApiError::conflict('kode_salah_ketik');
    }

    public function test_duplicate_key_is_read_from_mysql_error(): void
    {
        $pdo = new PDOException("SQLSTATE[23000]: Integrity constraint violation: 1062 Duplicate entry 'kopi' for key 'categories.categories_name_key'");
        $pdo->errorInfo = ['23000', 1062, "Duplicate entry 'kopi' for key 'categories.categories_name_key'"];
        $query = new QueryException('mysql', 'insert into categories ...', [], $pdo);

        $this->assertTrue(SqlError::isDuplicateKey($query, 'categories_name_key'));
        $this->assertFalse(SqlError::isDuplicateKey($query, 'dining_tables_name_key'));
        $this->assertFalse(SqlError::isDuplicateKey(new RuntimeException('lain'), 'categories_name_key'));
    }
}
