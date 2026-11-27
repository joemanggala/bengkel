<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis\Requests;

use App\Modules\Servis\StatusSpk;
use App\Support\Validation\IntRule;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;

/**
 * Aturan field badan rute SPK. Satu field yang sama (keluhan, odometer,
 * estimasi, mekanik) dipakai di beberapa rute (buat SPK, PATCH, jadikan
 * booking SPK), jadi aturannya ditulis sekali di sini supaya ketiganya
 * selalu menilai dengan cara yang sama.
 *
 * Setiap metode hanya mencatat galat ke $body; pemanggil membaca semua field
 * lebih dulu, menilai rujukan untuk field yang lolos, lalu memanggil
 * throwIfInvalid() sekali supaya semua galat dilaporkan bersama.
 */
final class SpkInput
{
    /** Batas odometer (OdometerMasukan). */
    public const ODOMETER_MAKS = 9_999_999;

    /** Batas harga item per satuan (TambahItemRequest.price, sama dengan harga katalog). */
    public const HARGA_MAKS = 100_000_000;

    /** Keluhan: dipangkas, wajib, paling banyak 1000 code point, boleh berisi pergantian baris. */
    public static function complaint(JsonObject $body): string
    {
        return $body->text('complaint', new TextRule(trim: true, max: 1000));
    }

    /** Diagnosis (PATCH): opsional, boleh kosong, null → invalid_type, paling banyak 2000. */
    public static function diagnosis(JsonObject $body): string
    {
        return $body->text('diagnosis', new TextRule(optional: true, trim: true, max: 2000));
    }

    /** Odometer: integer 0..9.999.999 atau null (= tidak diisi). */
    public static function odometer(JsonObject $body): ?int
    {
        return $body->nullableInt('odometer', 0, self::ODOMETER_MAKS);
    }

    /** Estimasi selesai: WaktuMasukan atau null; dikembalikan sebagai DATETIME(3) UTC. */
    public static function estimatedDoneAt(JsonObject $body): ?string
    {
        return $body->nullableTime('estimatedDoneAt');
    }

    /**
     * mechanicId: UUID atau null. Rujukannya (staf ber-role mechanic dan
     * aktif) dinilai pemanggil lewat database, hanya bila bentuknya sah.
     */
    public static function mechanicId(JsonObject $body): ?string
    {
        return $body->nullableUuid('mechanicId');
    }

    /** Status tujuan rute ubah status; QUEUED dan CANCELLED → invalid_format. */
    public static function statusTujuan(JsonObject $body): ?StatusSpk
    {
        $nilai = $body->choice('status', StatusSpk::tujuanRuteStatus());

        return $nilai === '' ? null : StatusSpk::from($nilai);
    }

    /** Catatan linimasa: opsional (bawaan ""), null → invalid_type, paling banyak 200. */
    public static function note(JsonObject $body): string
    {
        return $body->text('note', new TextRule(optional: true, trim: true, max: 200));
    }

    /** Alasan batal: dipangkas, 3..500 code point. Alasan ini terlihat pelanggan. */
    public static function reason(JsonObject $body): string
    {
        return $body->text('reason', new TextRule(trim: true, min: 3, max: 500));
    }

    /** Jumlah item 1..99. */
    public static function quantity(JsonObject $body): int
    {
        return $body->int('quantity', new IntRule(1, 99));
    }

    /**
     * Harga jasa per satuan, hanya bila dikirim (null = harga katalog).
     * Nilai null yang dikirim → invalid_type, karena field ini tidak nullable.
     */
    public static function price(JsonObject $body): ?int
    {
        if (! $body->has('price')) {
            return null;
        }
        $harga = $body->int('price', new IntRule(0, self::HARGA_MAKS, optional: true));

        return $body->failed('price') ? null : $harga;
    }

    /** Jumlah pembayaran: integer 1..2^53−1; batas atas sisa tagihan dinilai sesudah 409. */
    public static function amount(JsonObject $body): int
    {
        return $body->int('amount', new IntRule(1, JsonObject::MAX_SAFE_INTEGER));
    }

    /** Metode bayar, dibandingkan persis tanpa dipangkas. */
    public static function method(JsonObject $body): string
    {
        return $body->choice('method', ['cash', 'transfer', 'qris']);
    }
}
