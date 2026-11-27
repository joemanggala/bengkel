<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Database;

use App\Support\Text\Text;
use App\Support\Validation\Plate;

/**
 * Parameter ?search= yang sudah dipangkas, beserta turunannya untuk tiap
 * jenis kolom yang dicocokkan (spec, parameter Search, "Aturan cocok").
 * Setiap turunan sudah di-escape untuk Like::CONTAINS.
 *
 * Kolom yang berbeda butuh bentuk term yang berbeda, dan sebuah baris cocok
 * bila salah satu aturannya cocok:
 *  - nama (pelanggan, pemesan, jasa, sparepart) dicocokkan apa adanya,
 *    karena collation utf8mb4_0900_ai_ci mengabaikan huruf besar/kecil dan
 *    aksen;
 *  - SKU, nomor SPK, dan nomor booking memakai huruf besar ("s-0001"
 *    menemukan S-0001);
 *  - nomor HP dibuang spasi dan tanda hubungnya, awalan 0 atau +62 diganti
 *    62 ("0812-34" menemukan 6281234567890);
 *  - plat dibuang spasi, tanda hubung, dan titiknya ("b 1234" menemukan
 *    B 1234 XYZ).
 *
 * Turunan yang bernilai null berarti term itu tidak pernah cocok dengan
 * kolom tersebut, jadi pemanggil cukup melewatkan kondisinya.
 */
final class SearchTerm
{
    private function __construct(public readonly string $term) {}

    public static function of(string $trimmed): self
    {
        return new self($trimmed);
    }

    /** "" berarti tanpa filter. */
    public function isEmpty(): bool
    {
        return $this->term === '';
    }

    /**
     * Term dengan byte UTF-8 tidak sah (mis. %FF) tidak pernah cocok. Ia
     * juga tidak boleh dikirim ke kolom utf8mb4, karena MySQL menolaknya.
     * Pemanggil langsung membalas daftar kosong.
     */
    public function neverMatches(): bool
    {
        return ! mb_check_encoding($this->term, 'UTF-8');
    }

    /** Kolom nama: term apa adanya, collation kolom yang membandingkan. */
    public function forName(): string
    {
        return Like::escape($this->term);
    }

    /**
     * Kolom ASCII yang huruf a-z-nya dibesarkan: nomor SPK, nomor booking,
     * dan SKU. Null bila term memuat karakter non-ASCII: kolomnya ascii_bin,
     * jadi term seperti itu pasti tidak cocok.
     */
    public function forNumber(): ?string
    {
        return Text::isAscii($this->term) ? Like::escape(Text::upperAscii($this->term)) : null;
    }

    /**
     * Kolom nomor HP seragam (628…). Spasi dan tanda hubung dibuang; hanya
     * term berbentuk ^\+?[0-9]+$ yang dipakai, dengan awalan +62 atau 0
     * diganti 62. Term lain (huruf, tanda kurung) tidak pernah cocok.
     */
    public function forPhone(): ?string
    {
        $digits = str_replace([' ', '-'], '', $this->term);
        if (preg_match('/^\+?[0-9]+$/D', $digits) !== 1) {
            return null;
        }
        if (str_starts_with($digits, '+62')) {
            $digits = '62'.substr($digits, 3);
        } elseif (str_starts_with($digits, '0')) {
            $digits = '62'.substr($digits, 1);
        }

        // Term yang masih berawalan "+" (mis. "+81") tidak mungkin menjadi
        // bagian dari nomor seragam yang hanya berisi angka.
        return str_starts_with($digits, '+') ? null : $digits;
    }

    /**
     * Kolom kunci plat. Spasi, tanda hubung, dan titik dibuang, a-z
     * dibesarkan; hanya term yang lalu berisi A-Z dan 0-9 saja yang dipakai.
     * Hasilnya tidak perlu di-escape karena tidak memuat %, _, atau \.
     */
    public function forPlate(): ?string
    {
        $key = Plate::compact($this->term);

        return $key !== '' && preg_match('/^[A-Z0-9]+$/D', $key) === 1 ? $key : null;
    }
}
