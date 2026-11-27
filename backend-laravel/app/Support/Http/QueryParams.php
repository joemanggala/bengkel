<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Http;

use App\Support\Text\Text;
use App\Support\Validation\FieldCode;
use App\Support\Validation\FieldErrors;
use Illuminate\Http\Request;

/**
 * Parameter query yang dibaca langsung dari QUERY_STRING mentah.
 *
 * $request->query() tidak dipakai karena parse_str bawaan PHP berbeda
 * dengan backend Go dan NestJS: nama berakhiran [] menjadi larik, kunci yang
 * sama diambil yang terakhir, dan titik di nama kunci diubah menjadi garis
 * bawah. Di sini setiap pasangan nama=nilai dibaca apa adanya, dan untuk
 * setiap nama hanya kemunculan pertama yang dipakai. Pemisah pasangan hanya
 * "&"; titik koma adalah bagian dari nilai.
 */
final class QueryParams
{
    /** @param  array<string, string>  $values */
    private function __construct(private readonly array $values) {}

    public static function from(Request $request): self
    {
        return self::parse((string) $request->server('QUERY_STRING', ''));
    }

    public static function parse(string $query): self
    {
        $values = [];
        foreach (explode('&', $query) as $pair) {
            // Hanya pasangan kosong ("a=1&&b=2") yang dilewati. Titik koma
            // BUKAN pemisah: "search=a;b" mencari "a;b" dan "limit=1;page=2"
            // berarti limit bernilai "1;page=2" (spek, bagian Format). Pengurai
            // query bawaan sebagian bahasa memperlakukan ";" sebagai pemisah
            // dan membuang pasangannya diam-diam, sehingga filter hilang tanpa
            // kabar; di sini tidak ada perlakuan khusus.
            if ($pair === '') {
                continue;
            }
            [$name, $value] = array_pad(explode('=', $pair, 2), 2, '');
            $name = self::unescape($name);
            $value = self::unescape($value);
            if ($name === null || $value === null || array_key_exists($name, $values)) {
                continue;
            }
            $values[$name] = $value;
        }

        return new self($values);
    }

    /** Apakah parameter dikirim, walau nilainya kosong (?status=). */
    public function has(string $name): bool
    {
        return array_key_exists($name, $this->values);
    }

    /** Nilai parameter; "" bila tidak dikirim. Bisa memuat byte non-UTF-8. */
    public function get(string $name): string
    {
        return $this->values[$name] ?? '';
    }

    /**
     * Filter true/false: hanya "true" atau "false" persis huruf kecil. Tidak
     * dikirim → null (semua); kosong, "TRUE", "1", dan lainnya → invalid_format,
     * dicatat ke $errors supaya dilaporkan bersama galat parameter lain.
     */
    public function boolean(string $name, FieldErrors $errors): ?bool
    {
        if (! $this->has($name)) {
            return null;
        }
        $nilai = match ($this->get($name)) {
            'true' => true,
            'false' => false,
            default => null,
        };
        if ($nilai === null) {
            $errors->add($name, FieldCode::INVALID_FORMAT);
        }

        return $nilai;
    }

    /** Parameter search yang sudah dipangkas; "" berarti tanpa filter. */
    public function search(): string
    {
        return Text::trim($this->get('search'));
    }

    /**
     * Mengurai %XX dan "+" (spasi). Escape yang rusak (mis. "%zz") membuat
     * pasangan itu diabaikan, bukan diterjemahkan setengah jalan.
     */
    private static function unescape(string $text): ?string
    {
        if (preg_match('/%(?![0-9A-Fa-f]{2})/', $text) === 1) {
            return null;
        }

        return urldecode($text);
    }
}
