<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Validation;

use App\Support\Http\ApiError;

/**
 * Kumpulan galat per field (nama field → kode aturan). Semua field yang gagal
 * dilaporkan sekaligus dalam satu balasan 422, supaya pengguna bisa
 * membetulkan seluruh isian formulir dalam satu kali kirim.
 */
final class FieldErrors
{
    /** @var array<string, string> */
    private array $errors = [];

    /** Hanya galat pertama untuk satu field yang dicatat; "" diabaikan. */
    public function add(string $field, string $code): void
    {
        if ($code !== '' && ! array_key_exists($field, $this->errors)) {
            $this->errors[$field] = $code;
        }
    }

    public function has(string $field): bool
    {
        return array_key_exists($field, $this->errors);
    }

    public function isEmpty(): bool
    {
        return $this->errors === [];
    }

    /** @return array<string, string> */
    public function all(): array
    {
        return $this->errors;
    }

    /** Melempar 422 validation_failed bila ada field yang gagal. */
    public function throwIfAny(): void
    {
        if ($this->errors !== []) {
            throw ApiError::validation($this->errors);
        }
    }
}
