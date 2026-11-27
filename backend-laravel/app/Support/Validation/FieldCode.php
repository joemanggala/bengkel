<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Validation;

/**
 * Kode aturan di `fields` (KodeField di spec). Satu field hanya punya satu
 * kode, dipilih menurut prioritas: tipe → kosong → panjang/rentang → format
 * → rujukan. Pemeriksa di namespace ini mengikuti urutan itu, kecuali nomor
 * HP dan plat (lihat PhoneNumber dan Plate) yang menilai format sebelum
 * panjang. Kode rujukan dinilai pemanggil hanya untuk field yang lolos semua
 * aturan lain.
 */
final class FieldCode
{
    public const REQUIRED = 'required';

    public const INVALID_TYPE = 'invalid_type';

    public const INVALID_FORMAT = 'invalid_format';

    public const TOO_SHORT = 'too_short';

    public const TOO_LONG = 'too_long';

    public const OUT_OF_RANGE = 'out_of_range';

    /** SPK sudah berisi 50 item; dilaporkan di field `items`. */
    public const TOO_MANY_ITEMS = 'too_many_items';

    /** UUID sah yang barisnya tidak ada (atau tidak boleh dipakai di tempat itu). */
    public const UNKNOWN_REFERENCE = 'unknown_reference';

    /** UUID merujuk jasa, sparepart, atau mekanik yang nonaktif. */
    public const INACTIVE_REFERENCE = 'inactive_reference';
}
