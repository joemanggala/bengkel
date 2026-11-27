<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Validation;

/**
 * Sikap sebuah field teks terhadap karakter kontrol dan karakter pengacau
 * tampilan (bagian "Teks" di spec: "Karakter kontrol di teks bebas dari form
 * publik").
 *
 * Teks bebas dari form booking publik tampil di panel staf dan disalin ke
 * data pelanggan dan SPK. Satu karakter yang tidak terlihat sudah cukup untuk
 * memalsukan baris ("Budi" + LF + teks palsu), memotong teks (NUL), memicu
 * urutan ANSI (ESC), atau membalik arah teks (RLO). Yang ditolak, dinilai per
 * code point:
 *
 *  - karakter kontrol U+0000-U+001F, U+007F, dan U+0080-U+009F;
 *  - pemisah baris dan paragraf U+2028 dan U+2029;
 *  - pengatur arah teks U+202A-U+202E dan U+2066-U+2069.
 *
 * Yang sengaja TIDAK ditolak, walau tampak aneh: NBSP (U+00A0), spasi sempit
 * U+202F, penanda arah LRM/RLM (U+200E/U+200F), penyambung ZWJ (U+200D), dan
 * semua aksara non-Latin.
 *
 * Pemeriksaan ini hanya menilai teks yang sudah dipangkas. Tab, CR, dan LF
 * di tepi teks sudah dibuang lebih dulu oleh pemangkasan kontrak, sehingga
 * "\tBudi\n" lolos dan "Bu\ndi" ditolak.
 */
enum ControlChars
{
    /** Tidak diperiksa (bawaan): semua field lain yang bukan teks bebas dari form publik. */
    case Unchecked;

    /** Tanpa karakter kontrol sama sekali, termasuk tab, CR, dan LF (nama pemesan, merek, tipe). */
    case SingleLine;

    /** Tab (U+0009), LF (U+000A), dan CR (U+000D) boleh, karena keluhan bisa beberapa baris. */
    case MultiLine;

    /**
     * Rentang yang selalu ditolak, ditulis sebagai isi kelas karakter PCRE.
     * Dengan pengubah `u` PCRE membaca teks per code point, bukan per byte,
     * sehingga U+2028 tidak keliru dicocokkan dengan potongan byte karakter
     * lain. `$`, `\s`, dan `.` sengaja tidak dipakai: arti ketiganya di PHP
     * (baris baru di akhir teks, NBSP) menyimpang dari spek.
     */
    private const SELALU_DITOLAK = '\x{007F}-\x{009F}\x{2028}\x{2029}\x{202A}-\x{202E}\x{2066}-\x{2069}';

    /** Karakter kontrol ASCII selain tab, LF, dan CR. */
    private const KONTROL_TANPA_TAB_LF_CR = '\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}';

    /** Seluruh U+0000-U+001F. */
    private const KONTROL_ASCII = '\x{0000}-\x{001F}';

    /** Apakah $text (yang sudah dipangkas) memuat karakter yang ditolak mode ini. */
    public function rejects(string $text): bool
    {
        $kelas = match ($this) {
            self::Unchecked => null,
            self::SingleLine => self::KONTROL_ASCII.self::SELALU_DITOLAK,
            self::MultiLine => self::KONTROL_TANPA_TAB_LF_CR.self::SELALU_DITOLAK,
        };
        if ($kelas === null || $text === '') {
            return false;
        }

        // Hasil false (byte UTF-8 tidak sah) dianggap ditolak. Badan JSON yang
        // sampai di sini sudah dipastikan UTF-8 sah, jadi ini hanya sabuk
        // pengaman: lebih baik menolak daripada meloloskan teks yang tidak
        // bisa dinilai.
        return preg_match('/['.$kelas.']/u', $text) !== 0;
    }
}
