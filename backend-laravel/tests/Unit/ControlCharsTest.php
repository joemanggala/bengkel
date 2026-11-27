<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Validation\ControlChars;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Pemeriksa karakter kontrol di teks bebas dari pelanggan (bagian "Teks" di
 * spec). Dinilai per code point: tes ini memeriksa seluruh BMP satu per satu
 * terhadap daftar di spek yang ditulis ulang tanpa regex, supaya kelas
 * karakter PCRE yang salah ketik (satu batas bergeser) langsung ketahuan.
 */
final class ControlCharsTest extends TestCase
{
    /** Daftar spek ditulis ulang apa adanya, tanpa regex: pembanding independen. */
    private static function ditolakMenurutSpek(int $cp, bool $bolehTabLfCr): bool
    {
        if ($bolehTabLfCr && ($cp === 0x09 || $cp === 0x0A || $cp === 0x0D)) {
            return false;
        }

        return ($cp >= 0x00 && $cp <= 0x1F)
            || $cp === 0x7F
            || ($cp >= 0x80 && $cp <= 0x9F)
            || $cp === 0x2028
            || $cp === 0x2029
            || ($cp >= 0x202A && $cp <= 0x202E)
            || ($cp >= 0x2066 && $cp <= 0x2069);
    }

    /** @return array<string, array{ControlChars, bool}> */
    public static function mode(): array
    {
        return [
            'satu baris' => [ControlChars::SingleLine, false],
            'beberapa baris' => [ControlChars::MultiLine, true],
        ];
    }

    #[DataProvider('mode')]
    public function test_every_code_point_in_the_bmp_is_judged_exactly_as_the_spec_lists(ControlChars $mode, bool $bolehTabLfCr): void
    {
        $salah = [];
        for ($cp = 0; $cp <= 0xFFFF; $cp++) {
            if ($cp >= 0xD800 && $cp <= 0xDFFF) {
                continue; // surrogat bukan code point yang sah dalam UTF-8
            }
            // Dibungkus huruf, supaya yang dinilai adalah karakter di tengah teks.
            $teks = 'a'.mb_chr($cp, 'UTF-8').'b';
            if ($mode->rejects($teks) !== self::ditolakMenurutSpek($cp, $bolehTabLfCr)) {
                $salah[] = sprintf('U+%04X', $cp);
            }
        }

        $this->assertSame([], $salah, 'code point yang dinilai menyimpang dari spek');
    }

    public function test_unchecked_accepts_everything(): void
    {
        foreach (["a\0b", "a\nb", "a\u{202E}b", "a\u{2028}b", "a\u{7F}b"] as $teks) {
            $this->assertFalse(ControlChars::Unchecked->rejects($teks));
        }
    }

    /** @return array<string, array{string}> */
    public static function tampakAnehTetapSah(): array
    {
        return [
            'NBSP' => ["a\u{00A0}b"],
            'spasi sempit NBSP' => ["a\u{202F}b"],
            'LRM' => ["a\u{200E}b"],
            'RLM' => ["a\u{200F}b"],
            'ZWJ' => ["\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}"],
            'ZWNJ' => ["a\u{200C}b"],
            'U+2027 di bawah pemisah baris' => ["a\u{2027}b"],
            'U+202F di atas pengatur arah' => ["a\u{202F}b"],
            'U+2065 dan U+206A di sekitar isolat arah' => ["a\u{2065}\u{206A}b"],
            'U+00A1 tepat di atas kontrol C1' => ["a\u{00A1}b"],
            'aksara Arab' => ["\u{0645}\u{062D}\u{0645}\u{062F}"],
            'aksara Han' => ["\u{674E}\u{5C0F}\u{9F8D}"],
            'emoji di luar BMP' => ["Budi \u{1F642}"],
            'teks kosong' => [''],
        ];
    }

    #[DataProvider('tampakAnehTetapSah')]
    public function test_odd_looking_but_harmless_characters_pass_in_both_modes(string $teks): void
    {
        $this->assertFalse(ControlChars::SingleLine->rejects($teks));
        $this->assertFalse(ControlChars::MultiLine->rejects($teks));
    }

    public function test_tab_cr_and_lf_split_the_two_modes(): void
    {
        foreach (["a\tb", "a\nb", "a\rb", "a\r\nb", "\tbaris\n\tbaris"] as $teks) {
            $this->assertTrue(ControlChars::SingleLine->rejects($teks), json_encode($teks));
            $this->assertFalse(ControlChars::MultiLine->rejects($teks), json_encode($teks));
        }
    }

    public function test_a_control_character_is_found_wherever_it_is(): void
    {
        foreach ([ControlChars::SingleLine, ControlChars::MultiLine] as $mode) {
            foreach (["\0abc", "abc\0", "a\0bc", "\x1B[31mmerah", "\0"] as $teks) {
                $this->assertTrue($mode->rejects($teks), json_encode($teks));
            }
        }
    }

    public function test_a_trailing_newline_is_not_treated_like_the_end_of_the_text(): void
    {
        // Tanpa jangkar "$" tidak ada celah "sebelum baris baru di akhir":
        // satu LF di ujung pun tetap ditolak bila mode-nya satu baris.
        $this->assertTrue(ControlChars::SingleLine->rejects("Budi\n"));
        $this->assertFalse(ControlChars::MultiLine->rejects("Budi\n"));
    }

    public function test_invalid_utf8_is_refused_rather_than_let_through(): void
    {
        $this->assertTrue(ControlChars::SingleLine->rejects("a\xFFb"));
        $this->assertTrue(ControlChars::MultiLine->rejects("a\xC3"));
    }

    public function test_text_rule_reports_invalid_format_after_the_length_check(): void
    {
        $aturan = new TextRule(optional: true, trim: true, max: 5, controlChars: ControlChars::SingleLine);

        $this->assertSame(['Budi', ''], $aturan->check("  Budi \n"), 'tepi yang dipangkas bukan karakter kontrol');
        $this->assertSame(["Bu\ndi", 'invalid_format'], $aturan->check("Bu\ndi"));
        $this->assertSame(["abcde\0", 'too_long'], $aturan->check("abcde\0"), 'panjang dinilai lebih dulu');
        $this->assertSame(['', ''], $aturan->check("\t\n "), 'kosong setelah dipangkas tetap sah untuk field opsional');
    }

    public function test_text_rule_without_a_mode_does_not_look_at_control_characters(): void
    {
        $this->assertSame(["a\0b", ''], (new TextRule(optional: true, trim: true, max: 10))->check("a\0b"));
    }

    public function test_control_characters_come_before_the_custom_pattern(): void
    {
        $aturan = new TextRule(pattern: '/^[a-z\x00]+$/D', controlChars: ControlChars::SingleLine);

        // Pola mengizinkan NUL, tetapi mode karakter kontrol tidak.
        $this->assertSame(["a\0b", 'invalid_format'], $aturan->check("a\0b"));
        $this->assertSame(['abc', ''], $aturan->check('abc'));
    }

    public function test_json_object_applies_the_mode_to_escaped_characters_too(): void
    {
        // "\u0000" dan "‮" di JSON diurai menjadi karakter aslinya sebelum dinilai.
        $body = JsonObject::parse('{"name":"a\u0000b","notes":"baris\nbaris","rtl":"x‮y"}');
        $satuBaris = new TextRule(controlChars: ControlChars::SingleLine);
        $banyakBaris = new TextRule(controlChars: ControlChars::MultiLine);

        $body->text('name', $satuBaris);
        $body->text('notes', $banyakBaris);
        $body->text('rtl', $banyakBaris);

        $this->assertSame(['name' => 'invalid_format', 'rtl' => 'invalid_format'], $body->errors()->all());
    }
}
