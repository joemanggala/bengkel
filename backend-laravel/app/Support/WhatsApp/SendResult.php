<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\WhatsApp;

/** Hasil satu percobaan kirim pesan WhatsApp. */
final class SendResult
{
    /** Panjang kolom wa_messages.failure_reason. */
    public const MAX_REASON = 255;

    private function __construct(
        public readonly bool $sent,
        public readonly ?string $failureReason,
    ) {}

    public static function sent(): self
    {
        return new self(true, null);
    }

    /**
     * Alasan singkat untuk dibaca manusia, dengan urutan dari spec:
     * WA_TOKEN disamarkan "***" (ada penyedia yang memuat ulang header
     * Authorization di pesan galatnya), lalu dipotong 255 karakter (code
     * point, bukan byte, supaya huruf UTF-8 tidak terpotong di tengah), lalu
     * alasan kosong diganti teks lain karena kolomnya wajib terisi.
     */
    public static function failed(string $reason, string $token = ''): self
    {
        $reason = mb_scrub($reason, 'UTF-8');
        if ($token !== '') {
            $reason = str_replace($token, '***', $reason);
        }
        $reason = mb_substr($reason, 0, self::MAX_REASON, 'UTF-8');
        if (trim($reason) === '') {
            $reason = 'gagal tanpa keterangan';
        }

        return new self(false, $reason);
    }
}
