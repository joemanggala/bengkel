<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Validation;

use App\Support\Http\ApiError;
use App\Support\Time\Time;
use App\Support\Time\WaktuMasukan;
use stdClass;

/**
 * Badan JSON berbentuk objek yang field-nya belum dinilai.
 *
 * Validator bawaan Laravel tidak cukup ketat untuk kontrak: "15000" lolos
 * aturan integer, 1 lolos aturan boolean, dan null diperlakukan sama dengan
 * field yang tidak dikirim. Di sini setiap pengambil (text, int, bool, ...)
 * menilai tipe JSON aslinya dan mencatat galatnya sendiri, jadi pemanggil
 * cukup membaca semua field lalu memanggil throwIfInvalid() sekali.
 *
 * Tidak ada badan permintaan di kontrak bengkel yang berisi larik, jadi
 * kelas ini hanya membaca field tingkat atas.
 */
final class JsonObject
{
    /** Nama atribut request tempat middleware ReadJsonBody menitipkan badan. */
    public const ATTRIBUTE = 'bengkel.json-body';

    /**
     * Tingkat objek dan larik bersarang yang masih sah (spek, bagian "Tipe
     * JSON"): objek badan itu sendiri tingkat 1, jadi 64 sah dan 65 ditolak
     * (400). Tanpa batas, badan 1 MiB berisi puluhan ribu "[" memaksa
     * pengurai bekerja jauh di luar kewajaran.
     */
    public const MAX_NESTING = 64;

    /** 2^53−1: bilangan bulat terbesar yang masih tepat dalam double (dan di JavaScript). */
    public const MAX_SAFE_INTEGER = 9_007_199_254_740_991;

    /** @param  array<array-key, mixed>  $values */
    private function __construct(
        private readonly array $values,
        private readonly FieldErrors $errors,
    ) {}

    /**
     * Menerima tepat satu objek JSON. Larik, teks, null, JSON rusak, sisa data
     * setelah objek, atau byte UTF-8 tidak sah → 400 bad_request.
     *
     * Field yang namanya sama ditimpa yang terakhir (sama dengan JSON.parse),
     * dan field yang tidak dikenal diabaikan.
     */
    public static function parse(string $body): self
    {
        // json_decode menolak byte UTF-8 tidak sah, tetapi pemeriksaan
        // eksplisit membuat aturannya terbaca di sini.
        if (! mb_check_encoding($body, 'UTF-8')) {
            throw ApiError::badRequest();
        }
        // Tanpa mode asosiatif: objek JSON menjadi stdClass dan larik JSON
        // menjadi array, sehingga {} dan [] tetap bisa dibedakan.
        // Parameter depth PHP menghitung nilai paling dalam sebagai satu
        // tingkat sendiri: dengan depth 64, "[[...]]" 64 tingkat sudah ditolak
        // (dicoba: tingkat sah maksimum = depth - 1). Karena itu yang diberikan
        // MAX_NESTING + 1, supaya tepat 64 tingkat sah dan 65 ditolak.
        $decoded = json_decode($body, false, self::MAX_NESTING + 1);
        if (json_last_error() === JSON_ERROR_INVALID_PROPERTY_NAME) {
            $decoded = json_decode(self::renameNulKeys($body), false, self::MAX_NESTING + 1);
        }
        if (json_last_error() !== JSON_ERROR_NONE || ! $decoded instanceof stdClass) {
            throw ApiError::badRequest();
        }

        return new self(get_object_vars($decoded), new FieldErrors);
    }

    /**
     * PHP menolak properti objek yang namanya diawali NUL ("\u0000…"),
     * padahal itu JSON yang sah dan bagi kontrak hanya field tak dikenal yang
     * diabaikan. Nama seperti itu diganti awalan "\u0001": tetap tidak dikenal
     * (tidak ada field kontrak yang diawali karakter kendali), tetapi bisa
     * diurai. Hanya kunci objek yang diubah, yaitu string yang diikuti ":";
     * nilai string yang diawali NUL (mis. sandi) dibiarkan apa adanya.
     */
    private static function renameNulKeys(string $body): string
    {
        return preg_replace_callback('/"(?:[^"\\\\]++|\\\\.)*+"(?=\s*:)/', function (array $m): string {
            return preg_replace('/^"\\\\u0000/i', '"\\u0001', $m[0]) ?? $m[0];
        }, $body) ?? $body;
    }

    public function errors(): FieldErrors
    {
        return $this->errors;
    }

    /** Melempar 422 validation_failed berisi semua field yang gagal. */
    public function throwIfInvalid(): void
    {
        $this->errors->throwIfAny();
    }

    /** Apakah field dikirim, walau nilainya null (penting untuk PATCH). */
    public function has(string $name): bool
    {
        return array_key_exists($name, $this->values);
    }

    /** Mencatat galat untuk field ini, mis. unknown_reference dari pemeriksaan database. */
    public function fail(string $name, string $code): void
    {
        $this->errors->add($name, $code);
    }

    public function failed(string $name): bool
    {
        return $this->errors->has($name);
    }

    /**
     * Field teks. Field wajib (juga allowEmpty): tidak dikirim atau null →
     * required. Field opsional: tidak dikirim → "", null → invalid_type.
     */
    public function text(string $name, TextRule $rule): string
    {
        if (! $this->has($name)) {
            if (! $rule->optional) {
                $this->fail($name, FieldCode::REQUIRED);
            }

            return '';
        }
        $value = $this->values[$name];
        if ($value === null && ! $rule->optional) {
            $this->fail($name, FieldCode::REQUIRED);

            return '';
        }
        if (! is_string($value)) {
            $this->fail($name, FieldCode::INVALID_TYPE);

            return '';
        }
        [$clean, $code] = $rule->check($value);
        $this->fail($name, $code);

        return $clean;
    }

    /**
     * Teks wajib yang harus salah satu dari $allowed, dibandingkan persis
     * tanpa dipangkas (mis. role, vehicleType, method). Tidak dikirim, null, atau ""
     * → required; bukan string → invalid_type; nilai lain → invalid_format.
     *
     * @param  list<string>  $allowed
     */
    public function choice(string $name, array $allowed): string
    {
        $value = $this->text($name, new TextRule);
        if ($value !== '' && ! in_array($value, $allowed, true)) {
            $this->fail($name, FieldCode::INVALID_FORMAT);

            return '';
        }

        return $value;
    }

    /**
     * UUID kanonik huruf kecil, tidak dipangkas. Tidak dikirim, null, atau ""
     * → required; bukan string → invalid_type; bentuk lain → invalid_format.
     */
    public function uuid(string $name): string
    {
        $value = $this->text($name, new TextRule(pattern: Patterns::UUID));

        return $this->failed($name) ? '' : $value;
    }

    /**
     * Integer = angka JSON bernilai bulat: 15000, 15000.0, dan 1.5e4 sah;
     * 1500.5, "15000", dan true → invalid_type. Nilai mutlak di atas 2^53−1
     * (termasuk 1e400, yang diurai PHP menjadi INF) → out_of_range tanpa
     * menilai apakah ia bulat.
     */
    public function int(string $name, IntRule $rule): int
    {
        if (! $this->has($name)) {
            if ($rule->optional) {
                return $rule->default;
            }
            $this->fail($name, FieldCode::REQUIRED);

            return 0;
        }
        $value = $this->values[$name];
        if ($value === null && ! $rule->optional) {
            $this->fail($name, FieldCode::REQUIRED);

            return 0;
        }
        $number = self::integerValue($value);
        if ($number === null) {
            $this->fail($name, FieldCode::INVALID_TYPE);

            return 0;
        }
        if ($number === false || $number < $rule->min || $number > $rule->max) {
            $this->fail($name, FieldCode::OUT_OF_RANGE);

            return 0;
        }

        return $number;
    }

    /**
     * Boolean; hanya true/false yang sah (1 dan "true" → invalid_type). Field
     * wajib: tidak dikirim atau null → required. Field opsional: tidak
     * dikirim → $default, null → invalid_type.
     */
    public function bool(string $name, bool $optional = false, bool $default = false): bool
    {
        if (! $this->has($name)) {
            if (! $optional) {
                $this->fail($name, FieldCode::REQUIRED);
            }

            return $default;
        }
        $value = $this->values[$name];
        if ($value === null && ! $optional) {
            $this->fail($name, FieldCode::REQUIRED);

            return $default;
        }
        if (! is_bool($value)) {
            $this->fail($name, FieldCode::INVALID_TYPE);

            return $default;
        }

        return $value;
    }

    /**
     * Nomor HP wajib, dikembalikan dalam bentuk seragam 628…. Tidak dikirim
     * atau null → required; bukan string → invalid_type; selebihnya aturan
     * PhoneNumber.
     */
    public function phone(string $name): string
    {
        $value = $this->values[$name] ?? null;
        if ($value === null) {
            $this->fail($name, FieldCode::REQUIRED);

            return '';
        }

        return $this->phoneValue($name, $value);
    }

    /**
     * Nomor HP yang wajib dikirim tetapi boleh null. Tidak dikirim →
     * required; null → null; selebihnya sama dengan phone().
     */
    public function nullablePhone(string $name): ?string
    {
        if (! $this->has($name)) {
            $this->fail($name, FieldCode::REQUIRED);

            return null;
        }
        $value = $this->values[$name];

        return $value === null ? null : $this->phoneValue($name, $value);
    }

    /**
     * Nomor HP opsional yang boleh null, mis. `phone` di kirim ulang
     * WhatsApp. Tidak dikirim atau null → null (pemanggil memakai nomor
     * bawaannya); selebihnya sama dengan phone().
     */
    public function optionalPhone(string $name): ?string
    {
        $value = $this->values[$name] ?? null;

        return $value === null ? null : $this->phoneValue($name, $value);
    }

    /**
     * UUID yang boleh null, mis. mechanicId dan serviceId (MekanikMasukan,
     * BuatBookingRequest.serviceId). Tidak dikirim atau null → null; string
     * kosong → required; bukan string → invalid_type; bukan UUID kanonik
     * huruf kecil → invalid_format. Untuk PATCH, pemanggil membedakan "tidak
     * dikirim" dari "null" lewat has().
     */
    public function nullableUuid(string $name): ?string
    {
        if (($this->values[$name] ?? null) === null) {
            return null;
        }
        $value = $this->uuid($name);

        return $value === '' ? null : $value;
    }

    /**
     * Integer yang boleh null, mis. odometer (OdometerMasukan). Tidak dikirim
     * atau null → null; selebihnya aturan int(). Untuk PATCH, pemanggil
     * membedakan "tidak dikirim" dari "null" lewat has().
     */
    public function nullableInt(string $name, int $min, int $max): ?int
    {
        if (($this->values[$name] ?? null) === null) {
            return null;
        }
        $number = $this->int($name, new IntRule($min, $max));

        return $this->failed($name) ? null : $number;
    }

    /**
     * Waktu yang boleh null, mis. estimatedDoneAt (EstimasiMasukan). Tidak
     * dikirim atau null → null; bukan string → invalid_type; selebihnya aturan
     * WaktuMasukan, termasuk string kosong → invalid_format (spec tidak
     * menyebut "required" untuk field ini). Dikembalikan sebagai nilai
     * DATETIME(3) UTC siap disimpan. Untuk PATCH, pemanggil membedakan "tidak
     * dikirim" dari "null" lewat has().
     */
    public function nullableTime(string $name): ?string
    {
        $value = $this->values[$name] ?? null;
        if ($value === null) {
            return null;
        }
        if (! is_string($value)) {
            $this->fail($name, FieldCode::INVALID_TYPE);

            return null;
        }
        [$time, $code] = WaktuMasukan::parse($value);
        $this->fail($name, $code);

        return $time === null ? null : Time::toDb($time);
    }

    /**
     * Plat wajib (PlatMasukan). Tidak dikirim atau null → required; bukan
     * string → invalid_type; selebihnya aturan Plate::normalize().
     */
    public function plate(string $name): ?Plate
    {
        $value = $this->values[$name] ?? null;
        if ($value === null) {
            $this->fail($name, FieldCode::REQUIRED);

            return null;
        }
        if (! is_string($value)) {
            $this->fail($name, FieldCode::INVALID_TYPE);

            return null;
        }
        [$plate, $code] = Plate::normalize($value);
        $this->fail($name, $code);

        return $plate;
    }

    /**
     * Nilai integer dari angka JSON: null bila bukan angka atau berpecahan,
     * false bila nilai mutlaknya di luar ±(2^53−1).
     */
    public static function integerValue(mixed $value): int|false|null
    {
        if (is_int($value)) {
            return abs($value) > self::MAX_SAFE_INTEGER ? false : $value;
        }
        if (! is_float($value)) {
            return null;
        }
        if (! is_finite($value) || abs($value) > self::MAX_SAFE_INTEGER) {
            return false;
        }
        if (floor($value) !== $value) {
            return null;
        }

        return (int) $value;
    }

    private function phoneValue(string $name, mixed $value): string
    {
        if (! is_string($value)) {
            $this->fail($name, FieldCode::INVALID_TYPE);

            return '';
        }
        [$normalized, $code] = PhoneNumber::normalize($value);
        $this->fail($name, $code);

        return $normalized;
    }
}
