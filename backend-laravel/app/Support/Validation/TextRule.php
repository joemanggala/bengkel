<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Validation;

use App\Support\Text\Text;

/** Aturan satu field teks. */
final class TextRule
{
    /**
     * @param  bool  $optional  boleh tidak dikirim (bawaan ""), dan "" juga sah; null → invalid_type
     * @param  bool  $allowEmpty  wajib dikirim sebagai teks (tidak dikirim atau null → required), tetapi "" sah
     * @param  bool  $trim  dipangkas (spasi, tab, CR, LF) sebelum dinilai dan disimpan
     * @param  bool  $lowerAscii  huruf A-Z dikecilkan setelah dipangkas (email)
     * @param  int  $min  batas bawah dalam code point; 0 = tanpa batas
     * @param  int  $max  batas atas dalam code point; 0 = tanpa batas
     * @param  bool  $countBytes  batas dihitung dalam byte UTF-8 (sandi, karena bcrypt hanya membaca 72 byte)
     * @param  string|null  $pattern  regex PCRE lengkap dengan pembatas
     * @param  ControlChars  $controlChars  sikap terhadap karakter kontrol; dinilai pada teks yang sudah dipangkas
     */
    public function __construct(
        public readonly bool $optional = false,
        public readonly bool $allowEmpty = false,
        public readonly bool $trim = false,
        public readonly bool $lowerAscii = false,
        public readonly int $min = 0,
        public readonly int $max = 0,
        public readonly bool $countBytes = false,
        public readonly ?string $pattern = null,
        public readonly ControlChars $controlChars = ControlChars::Unchecked,
    ) {}

    /**
     * Menilai teks yang tipenya sudah pasti string, dengan prioritas kode
     * kontrak: kosong → panjang → format. Karakter kontrol termasuk format
     * (invalid_format), jadi baru dinilai setelah panjang lolos: 61 karakter
     * yang memuat NUL tetap dilaporkan too_long.
     *
     * @return array{0: string, 1: string} teks yang sudah dirapikan dan kode
     *                                     aturan yang dilanggar ("" bila sah)
     */
    public function check(string $value): array
    {
        if ($this->trim) {
            $value = Text::trim($value);
        }
        if ($this->lowerAscii) {
            $value = Text::lowerAscii($value);
        }
        if ($value === '') {
            return ['', $this->optional || $this->allowEmpty ? '' : FieldCode::REQUIRED];
        }
        $length = $this->countBytes ? strlen($value) : Text::length($value);
        if ($this->min > 0 && $length < $this->min) {
            return [$value, FieldCode::TOO_SHORT];
        }
        if ($this->max > 0 && $length > $this->max) {
            return [$value, FieldCode::TOO_LONG];
        }
        if ($this->controlChars->rejects($value)) {
            return [$value, FieldCode::INVALID_FORMAT];
        }
        if ($this->pattern !== null && preg_match($this->pattern, $value) !== 1) {
            return [$value, FieldCode::INVALID_FORMAT];
        }

        return [$value, ''];
    }
}
