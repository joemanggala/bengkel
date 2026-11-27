<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Http;

use Illuminate\Http\JsonResponse;
use LogicException;
use RuntimeException;
use Throwable;

/**
 * Galat yang aman dikirim ke klien dalam bentuk kontrak
 * {"error": {"code", "message", "fields"?}}.
 *
 * Service cukup melempar ApiError (mis. ApiError::conflict('has_payments'));
 * Laravel memanggil render() untuk menyusun balasannya. Dengan begitu kode
 * status dan pesan baku hanya ditulis di satu tempat, dan service tidak perlu
 * tahu apa pun soal HTTP. Galat asli (mis. galat database) disimpan sebagai
 * $previous hanya untuk log; isinya tidak pernah dikirim ke klien.
 */
class ApiError extends RuntimeException
{
    /**
     * Pesan baku per kode, huruf demi huruf sama dengan x-pesan-baku di spec
     * (KodeGalat), supaya web menampilkan teks yang sama apa pun backend-nya.
     * not_found dan insufficient_stock sengaja tidak ada: pesan yang pertama
     * boleh spesifik ("SPK tidak ditemukan"), yang kedua memuat nama
     * sparepart (lihat PesanStokKurang).
     */
    private const MESSAGES = [
        'bad_request' => 'Badan permintaan tidak bisa dibaca',
        'unauthenticated' => 'Autentikasi tidak sah atau sudah berakhir',
        'invalid_credentials' => 'Email atau kata sandi salah',
        'forbidden' => 'Kamu tidak punya akses ke sumber ini',
        'setup_disabled' => 'Pemasangan awal tidak aktif di server ini',
        'setup_token_invalid' => 'Token pemasangan salah',
        'already_set_up' => 'Aplikasi sudah dipasang, silakan masuk dengan akun pemilik',
        'email_taken' => 'Email sudah terdaftar',
        'last_owner' => 'Harus tetap ada setidaknya satu pemilik yang aktif',
        'phone_taken' => 'Nomor HP sudah dipakai pelanggan lain',
        'plate_taken' => 'Plat nomor sudah terdaftar',
        'plate_owned_by_other_customer' => 'Plat nomor ini terdaftar atas pelanggan lain, periksa lagi data booking',
        'service_name_taken' => 'Nama jasa sudah dipakai',
        'sku_taken' => 'SKU sudah dipakai',
        'status_transition_invalid' => 'Perubahan status SPK ini tidak diizinkan',
        'not_paid_off' => 'Lunasi tagihan dulu sebelum kendaraan diserahkan',
        'has_payments' => 'SPK yang sudah dibayar tidak bisa dibatalkan',
        'work_order_locked' => 'SPK yang sudah selesai, diambil, atau dibatalkan tidak bisa diubah',
        'work_order_empty' => 'Tambahkan item jasa atau sparepart dulu sebelum menandai selesai',
        'total_below_paid' => 'Total SPK tidak boleh lebih kecil dari yang sudah dibayar',
        'work_order_cancelled' => 'SPK ini sudah dibatalkan',
        'already_picked_up' => 'Kendaraan sudah diambil',
        'work_order_not_done' => 'SPK ini belum selesai',
        'booking_transition_invalid' => 'Perubahan status booking ini tidak diizinkan',
        'too_many_pending_bookings' => 'Nomor ini masih punya 3 booking yang menunggu konfirmasi',
        'payload_too_large' => 'Badan permintaan terlalu besar',
        'validation_failed' => 'Data yang dikirim belum valid',
        'too_many_requests' => 'Terlalu sering, silakan tunggu sebentar lalu coba lagi',
        'internal_error' => 'Terjadi kesalahan di server, silakan coba lagi',
        'wa_unavailable' => 'WhatsApp tidak bisa dikirim saat ini, coba lagi nanti',
    ];

    /**
     * @param  array<string, string>  $fields  nama field → kode aturan, hanya untuk validation_failed
     * @param  array<string, string>  $headers  header tambahan (bila suatu saat dibutuhkan)
     */
    protected function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $fields = [],
        public readonly array $headers = [],
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    /** Galat dengan pesan baku untuk kode itu. */
    public static function of(int $status, string $code, ?Throwable $cause = null): self
    {
        return new self($status, $code, self::standardMessage($code), previous: $cause);
    }

    public static function badRequest(): self
    {
        return self::of(400, 'bad_request');
    }

    public static function unauthenticated(): self
    {
        return self::of(401, 'unauthenticated');
    }

    public static function invalidCredentials(): self
    {
        return self::of(401, 'invalid_credentials');
    }

    public static function forbidden(): self
    {
        return self::of(403, 'forbidden');
    }

    /** not_found tidak punya pesan baku, jadi pesannya boleh spesifik. */
    public static function notFound(string $message): self
    {
        return new self(404, 'not_found', $message);
    }

    /** Semua kode 409, mis. email_taken atau has_payments. */
    public static function conflict(string $code): self
    {
        return self::of(409, $code);
    }

    /**
     * 409 insufficient_stock. Satu-satunya galat 409 yang pesannya tidak baku:
     * ia memuat nama sparepart yang kurang, disusun PesanStokKurang.
     */
    public static function insufficientStock(string $message): self
    {
        return new self(409, 'insufficient_stock', $message);
    }

    public static function payloadTooLarge(): self
    {
        return self::of(413, 'payload_too_large');
    }

    /** @param  array<string, string>  $fields */
    public static function validation(array $fields): self
    {
        return new self(422, 'validation_failed', self::standardMessage('validation_failed'), $fields);
    }

    /** 429 untuk membatasi percobaan masuk; membawa Retry-After (detik). */
    public static function tooManyRequests(int $retryAfterSeconds): self
    {
        return new self(429, 'too_many_requests', self::standardMessage('too_many_requests'),
            headers: ['Retry-After' => (string) $retryAfterSeconds]);
    }

    public static function internal(?Throwable $cause = null): self
    {
        return self::of(500, 'internal_error', $cause);
    }

    public static function waUnavailable(): self
    {
        return self::of(503, 'wa_unavailable');
    }

    /**
     * Kode tanpa pesan baku adalah kesalahan pemrograman (salah ketik kode
     * atau pesannya belum ditambahkan), bukan galat yang boleh lolos diam-diam
     * dengan pesan kosong.
     */
    protected static function standardMessage(string $code): string
    {
        return self::MESSAGES[$code] ?? throw new LogicException('pesan baku untuk kode '.$code.' belum ada');
    }

    /** Dipanggil Laravel saat galat ini sampai ke penangan galat. */
    public function render(): JsonResponse
    {
        $error = ['code' => $this->errorCode, 'message' => $this->getMessage()];
        if ($this->fields !== []) {
            $error['fields'] = $this->fields;
        }

        return ApiResponse::json(['error' => $error], $this->status, $this->headers);
    }

    /**
     * 500 dicatat lewat LogGalat (tanpa SQL bernilai atau isi badan); 4xx dan
     * 503 adalah jawaban yang memang disiapkan (kegagalan WhatsApp sudah
     * tercatat sendiri di wa_messages), jadi tidak perlu memenuhi log.
     */
    public function report(): void
    {
        if ($this->status === 500) {
            LogGalat::catat($this->getPrevious() ?? $this);
        }
    }
}
