<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Http;

use App\Support\Validation\FieldCode;
use App\Support\Validation\FieldErrors;

/**
 * Halaman yang diminta lewat ?page= dan ?limit=. Nilai yang salah ditolak 422,
 * tidak pernah dijepit diam-diam ke batas terdekat, supaya klien yang keliru
 * langsung tahu, bukan mendapat halaman yang berbeda dari yang dimintanya.
 */
final class Page
{
    public const MAX_PAGE = 1_000_000;

    public const MAX_LIMIT = 50;

    public const DEFAULT_LIMIT = 20;

    public function __construct(
        public readonly int $page,
        public readonly int $limit,
    ) {}

    /**
     * Galat dicatat ke $errors supaya bisa dilaporkan bersama galat parameter
     * lain (mis. status) dalam satu balasan 422.
     */
    public static function parse(QueryParams $query, FieldErrors $errors, int $defaultLimit = self::DEFAULT_LIMIT): self
    {
        return new self(
            self::positiveInt($query, 'page', 1, self::MAX_PAGE, $errors),
            self::positiveInt($query, 'limit', $defaultLimit, self::MAX_LIMIT, $errors),
        );
    }

    /** Membaca page/limit dan langsung melempar 422 bila ada yang salah. */
    public static function fromQuery(QueryParams $query, int $defaultLimit = self::DEFAULT_LIMIT): self
    {
        $errors = new FieldErrors;
        $page = self::parse($query, $errors, $defaultLimit);
        $errors->throwIfAny();

        return $page;
    }

    public function offset(): int
    {
        return ($this->page - 1) * $this->limit;
    }

    /** @return array{page: int, limit: int, total: int} */
    public function meta(int $total): array
    {
        return ['page' => $this->page, 'limit' => $this->limit, 'total' => $total];
    }

    /**
     * Tidak dikirim → bawaan; kosong atau bukan digit ASCII ("-1", "1.5",
     * "+1", "abc") → invalid_format; digit di luar 1..max → out_of_range.
     */
    private static function positiveInt(QueryParams $query, string $name, int $fallback, int $max, FieldErrors $errors): int
    {
        if (! $query->has($name)) {
            return $fallback;
        }
        $text = $query->get($name);
        if ($text === '' || ! ctype_digit($text)) {
            $errors->add($name, FieldCode::INVALID_FORMAT);

            return $fallback;
        }
        // Buang nol di depan supaya angka sepanjang apa pun bisa dibandingkan
        // tanpa meluap: lebih dari 7 digit pasti di atas 1.000.000.
        $digits = ltrim($text, '0');
        if ($digits === '' || strlen($digits) > 7 || (int) $digits > $max) {
            $errors->add($name, FieldCode::OUT_OF_RANGE);

            return $fallback;
        }

        return (int) $digits;
    }
}
