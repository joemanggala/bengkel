<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Http\ApiError;
use App\Support\Validation\IntRule;
use App\Support\Validation\JsonObject;
use App\Support\Validation\TextRule;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Validator JSON ketat: tipe persis, null, angka bulat, dan prioritas kode. */
final class JsonObjectTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function badBodies(): array
    {
        return [
            'JSON rusak' => ['{"name": "Budi",'],
            'larik' => ['[]'],
            'teks' => ['"teks"'],
            'angka' => ['1'],
            'null' => ['null'],
            'sisa data setelah objek' => ['{} sisa'],
            'byte UTF-8 tidak sah' => ["{\"name\":\"Bu\xFFdi\"}"],
            'kosong' => [''],
        ];
    }

    #[DataProvider('badBodies')]
    public function test_only_one_json_object_is_accepted(string $body): void
    {
        try {
            JsonObject::parse($body);
            $this->fail('badan seharusnya ditolak');
        } catch (ApiError $e) {
            $this->assertSame(400, $e->status);
            $this->assertSame('bad_request', $e->errorCode);
        }
    }

    /** Badan {"name":"x","lain": <$tingkat larik bersarang>}: tingkat total = $tingkat + 1 (objek badan). */
    private static function badanBersarang(int $tingkatLarik): string
    {
        return '{"name":"x","lain":'.str_repeat('[', $tingkatLarik).str_repeat(']', $tingkatLarik).'}';
    }

    /** Objek bersarang $n tingkat sebagai nilai field yang diabaikan: {"a":{"a":...1...}}. */
    private static function objekBersarang(int $n): string
    {
        return '{"name":"x","lain":'.str_repeat('{"a":', $n).'1'.str_repeat('}', $n).'}';
    }

    public function test_exactly_64_nesting_levels_are_accepted_for_arrays(): void
    {
        // Objek badan = tingkat 1, jadi 63 larik di dalamnya = 64 tingkat.
        $body = JsonObject::parse(self::badanBersarang(63));

        $this->assertSame('x', $body->text('name', new TextRule));
    }

    public function test_65_nesting_levels_are_bad_request_for_arrays(): void
    {
        $this->assertBadRequest(self::badanBersarang(64));
    }

    public function test_exactly_64_nesting_levels_are_accepted_for_objects(): void
    {
        // Objek badan + 63 objek "a" = 64 tingkat.
        $body = JsonObject::parse(self::objekBersarang(63));

        $this->assertSame('x', $body->text('name', new TextRule));
    }

    public function test_65_nesting_levels_are_bad_request_for_objects(): void
    {
        $this->assertBadRequest(self::objekBersarang(64));
    }

    public function test_mixed_objects_and_arrays_count_together(): void
    {
        // 31 x ([{...}] = 2 tingkat) = 62 tingkat di dalam, ditambah objek badan = 63.
        $dalam = str_repeat('[{"a":', 31).'1'.str_repeat('}]', 31);
        // Satu larik lagi = 64 tingkat: sah.
        JsonObject::parse('{"name":"x","lain":['.$dalam.']}');
        // Dua larik lagi = 65 tingkat: ditolak.
        $this->assertBadRequest('{"name":"x","lain":[['.$dalam.']]}');
    }

    public function test_extremely_deep_nesting_is_bad_request_without_a_server_error(): void
    {
        $this->assertBadRequest(self::badanBersarang(20_000));
    }

    public function test_the_nesting_limit_still_applies_when_a_key_starts_with_nul(): void
    {
        // Kunci berawalan NUL memicu pengurai kedua (renameNulKeys); batasnya harus ikut.
        $this->assertBadRequest('{"\u0000k":1,"lain":'.str_repeat('[', 64).str_repeat(']', 64).'}');
        $this->assertTrue(JsonObject::parse('{"\u0000k":1,"lain":'.str_repeat('[', 63).str_repeat(']', 63).'}')->has('lain'));
    }

    /** @return array<string, array{string}> */
    public static function surrogatTunggal(): array
    {
        return [
            'surrogat tinggi di akhir nilai' => ['{"name":"ab\ud800"}'],
            'surrogat rendah di awal nilai' => ['{"name":"\udc00ab"}'],
            'dua surrogat tinggi berurutan' => ['{"name":"a\ud800\ud800b"}'],
            'pasangan terbalik (rendah lalu tinggi)' => ['{"name":"a\udc00\ud800b"}'],
            'surrogat tinggi sebelum karakter biasa' => ['{"name":"a\ud83db"}'],
            'surrogat tunggal di kunci objek' => ['{"\ud800":1,"name":"x"}'],
            'surrogat tunggal di nilai bersarang (field yang diabaikan)' => ['{"name":"x","lain":{"d":["\udfff"]}}'],
            'batas bawah rentang (d800)' => ['{"name":"\ud800"}'],
            'batas atas rentang (dfff)' => ['{"name":"\udfff"}'],
        ];
    }

    #[DataProvider('surrogatTunggal')]
    public function test_a_lone_surrogate_escape_is_bad_request_never_replaced_with_u_fffd(string $body): void
    {
        $this->assertBadRequest($body);
    }

    public function test_a_complete_surrogate_pair_is_valid_and_kept(): void
    {
        $body = JsonObject::parse('{"name":"Kopi 😀"}');

        $this->assertSame("Kopi \u{1F600}", $body->text('name', new TextRule));
    }

    private function assertBadRequest(string $body): void
    {
        try {
            JsonObject::parse($body);
            $this->fail('badan seharusnya ditolak');
        } catch (ApiError $e) {
            $this->assertSame([400, 'bad_request'], [$e->status, $e->errorCode]);
        }
    }

    public function test_duplicate_keys_take_the_last_value_like_json_parse(): void
    {
        $body = JsonObject::parse('{"name":"Ani","name":"Budi","unknown":1}');

        $this->assertSame('Budi', $body->text('name', new TextRule));
        $this->assertTrue($body->errors()->isEmpty());
    }

    public function test_field_names_starting_with_nul_are_ignored_not_rejected(): void
    {
        // PHP menolak properti berawalan NUL; bagi kontrak itu hanya field tak dikenal.
        $body = JsonObject::parse('{"\u0000x":1,"name":"Ani","sub":{"\u0000":true},"quantity":5,"password":"\u0000abc"}');

        $this->assertSame('Ani', $body->text('name', new TextRule));
        $this->assertSame(5, $body->int('quantity', new IntRule(1, 10)));
        // Nilai (bukan nama field) yang diawali NUL tidak diubah.
        $this->assertSame("\0abc", $body->text('password', new TextRule));
        $this->assertTrue($body->errors()->isEmpty());
    }

    /** @return array<string, array{string, int, string}> */
    public static function integers(): array
    {
        return [
            'bulat' => ['15000', 15_000, ''],
            'pecahan nol' => ['15000.0', 15_000, ''],
            'eksponen' => ['1.5e4', 15_000, ''],
            'pecahan' => ['1500.5', 0, 'invalid_type'],
            'teks angka' => ['"15000"', 0, 'invalid_type'],
            'boolean' => ['true', 0, 'invalid_type'],
            'larik' => ['[1]', 0, 'invalid_type'],
            'null pada field wajib' => ['null', 0, 'required'],
            'di bawah batas' => ['0', 0, 'out_of_range'],
            'di atas batas' => ['10000001', 0, 'out_of_range'],
            '1e400 tanpa menilai bulat atau tidak' => ['1e400', 0, 'out_of_range'],
            'di atas 2^53-1' => ['9007199254740993', 0, 'out_of_range'],
            'negatif besar' => ['-1e20', 0, 'out_of_range'],
        ];
    }

    #[DataProvider('integers')]
    public function test_integer_is_a_json_number_with_integral_value(string $literal, int $value, string $code): void
    {
        $body = JsonObject::parse('{"price":'.$literal.'}');

        $this->assertSame($value, $body->int('price', new IntRule(1, 10_000_000)));
        $this->assertSame($code === '' ? [] : ['price' => $code], $body->errors()->all());
    }

    /** @return array<string, array{string, int, string}> */
    public static function quantities(): array
    {
        return [
            'batas bawah' => ['1', 1, ''],
            'batas atas' => ['99', 99, ''],
            'pecahan nol' => ['5.0', 5, ''],
            'eksponen' => ['5e1', 50, ''],
            'nol' => ['0', 0, 'out_of_range'],
            'satu di atas batas' => ['100', 0, 'out_of_range'],
            'negatif' => ['-1', 0, 'out_of_range'],
            '2^53' => ['9007199254740992', 0, 'out_of_range'],
            'di luar int 64-bit' => ['99999999999999999999', 0, 'out_of_range'],
            'pecahan' => ['1.5', 0, 'invalid_type'],
            'teks' => ['"5"', 0, 'invalid_type'],
            'boolean' => ['true', 0, 'invalid_type'],
            'null pada field wajib' => ['null', 0, 'required'],
        ];
    }

    /** Jumlah per item SPK: 1 sampai 99 (TambahItemRequest.quantity). */
    #[DataProvider('quantities')]
    public function test_item_quantity_is_one_to_99(string $literal, int $value, string $code): void
    {
        $body = JsonObject::parse('{"quantity":'.$literal.'}');

        $this->assertSame($value, $body->int('quantity', new IntRule(1, 99)));
        $this->assertSame($code === '' ? [] : ['quantity' => $code], $body->errors()->all());
    }

    public function test_optional_integer_uses_default_but_null_is_invalid_type(): void
    {
        $rule = new IntRule(1, 720, optional: true, default: 24);
        $missing = JsonObject::parse('{}');
        $null = JsonObject::parse('{"durationHours":null}');

        $this->assertSame(24, $missing->int('durationHours', $rule));
        $this->assertTrue($missing->errors()->isEmpty());
        $this->assertSame(0, $null->int('durationHours', $rule));
        $this->assertSame(['durationHours' => 'invalid_type'], $null->errors()->all());
    }

    /** @return array<string, array{string, string, string}> */
    public static function texts(): array
    {
        return [
            'sah, dipangkas' => ['"  Setrika  "', 'Setrika', ''],
            'bukan teks' => ['123', '', 'invalid_type'],
            'null pada field wajib' => ['null', '', 'required'],
            'kosong setelah dipangkas' => ['" \t\r\n "', '', 'required'],
            'terlalu pendek' => ['"A"', 'A', 'too_short'],
            'terlalu panjang dihitung code point' => ['"'.str_repeat('é', 11).'"', str_repeat('é', 11), 'too_long'],
            'tepat batas atas dalam code point' => ['"'.str_repeat('é', 10).'"', str_repeat('é', 10), ''],
        ];
    }

    #[DataProvider('texts')]
    public function test_text_codes_follow_priority_type_empty_length(string $literal, string $value, string $code): void
    {
        $body = JsonObject::parse('{"name":'.$literal.'}');

        $this->assertSame($value, $body->text('name', new TextRule(trim: true, min: 2, max: 10)));
        $this->assertSame($code === '' ? [] : ['name' => $code], $body->errors()->all());
    }

    public function test_optional_text_missing_is_empty_but_null_is_invalid_type(): void
    {
        $rule = new TextRule(optional: true, trim: true, max: 500);
        $body = JsonObject::parse('{"notes":null,"address":"   "}');

        $this->assertSame('', $body->text('missing', $rule));
        $this->assertSame('', $body->text('address', $rule));
        $this->assertSame('', $body->text('notes', $rule));
        $this->assertSame(['notes' => 'invalid_type'], $body->errors()->all());
    }

    public function test_email_is_trimmed_and_ascii_lowercased_before_pattern(): void
    {
        $rule = new TextRule(trim: true, lowerAscii: true, max: 254, pattern: '/^[^@\s]+@[^@\s]+$/D');
        $body = JsonObject::parse('{"email":"  Kasir@Bengkel.ID ","bad":"bukan email"}');

        $this->assertSame('kasir@bengkel.id', $body->text('email', $rule));
        $body->text('bad', $rule);
        $this->assertSame(['bad' => 'invalid_format'], $body->errors()->all());
    }

    public function test_password_limit_counts_utf8_bytes(): void
    {
        $rule = new TextRule(min: 8, max: 72, countBytes: true);
        $body = JsonObject::parse('{"ok":"'.str_repeat('é', 36).'","long":"'.str_repeat('é', 37).'"}');

        $body->text('ok', $rule);
        $body->text('long', $rule);
        $this->assertSame(['long' => 'too_long'], $body->errors()->all());
    }

    /** @return array<string, array{string, bool, bool, string}> */
    public static function booleans(): array
    {
        return [
            'true' => ['true', false, true, ''],
            'false' => ['false', false, false, ''],
            'angka 1' => ['1', false, false, 'invalid_type'],
            'teks "true"' => ['"true"', false, false, 'invalid_type'],
            'null pada field wajib' => ['null', false, false, 'required'],
            'null pada field opsional' => ['null', true, false, 'invalid_type'],
        ];
    }

    #[DataProvider('booleans')]
    public function test_boolean_accepts_only_true_and_false(string $literal, bool $optional, bool $value, string $code): void
    {
        $body = JsonObject::parse('{"isActive":'.$literal.'}');

        $this->assertSame($value, $body->bool('isActive', $optional));
        $this->assertSame($code === '' ? [] : ['isActive' => $code], $body->errors()->all());
    }

    public function test_optional_boolean_missing_uses_default(): void
    {
        $body = JsonObject::parse('{}');

        $this->assertTrue($body->bool('isActive', optional: true, default: true));
        $this->assertFalse($body->bool('required'));
        $this->assertSame(['required' => 'required'], $body->errors()->all());
    }

    public function test_all_failing_fields_are_reported_together_as_422(): void
    {
        $body = JsonObject::parse('{"name":1,"price":"x"}');
        $body->text('name', new TextRule);
        $body->int('price', new IntRule(1, 10));
        $body->text('unit', new TextRule);

        try {
            $body->throwIfInvalid();
            $this->fail('seharusnya 422');
        } catch (ApiError $e) {
            $this->assertSame(422, $e->status);
            $this->assertSame('validation_failed', $e->errorCode);
            $this->assertSame(['name' => 'invalid_type', 'price' => 'invalid_type', 'unit' => 'required'], $e->fields);
        }
    }

    public function test_has_distinguishes_missing_from_null(): void
    {
        $body = JsonObject::parse('{"address":null}');

        $this->assertTrue($body->has('address'));
        $this->assertFalse($body->has('notes'));
    }

    /** @return array<string, array{string, string|null, string}> */
    public static function nullableUuids(): array
    {
        return [
            'tidak dikirim' => ['{}', null, ''],
            'null' => ['{"mechanicId":null}', null, ''],
            'sah' => ['{"mechanicId":"11111111-1111-4111-8111-111111111111"}', '11111111-1111-4111-8111-111111111111', ''],
            'string kosong' => ['{"mechanicId":""}', null, 'required'],
            'spasi tidak dipangkas' => ['{"mechanicId":" 11111111-1111-4111-8111-111111111111"}', null, 'invalid_format'],
            'huruf besar' => ['{"mechanicId":"11111111-1111-4111-8111-11111111111A"}', null, 'invalid_format'],
            'baris baru di akhir' => ['{"mechanicId":"11111111-1111-4111-8111-111111111111\\n"}', null, 'invalid_format'],
            'angka' => ['{"mechanicId":1}', null, 'invalid_type'],
            'objek' => ['{"mechanicId":{}}', null, 'invalid_type'],
        ];
    }

    /** mechanicId dan serviceId: UUID atau null (MekanikMasukan). */
    #[DataProvider('nullableUuids')]
    public function test_nullable_uuid(string $json, ?string $value, string $code): void
    {
        $body = JsonObject::parse($json);

        $this->assertSame($value, $body->nullableUuid('mechanicId'));
        $this->assertSame($code === '' ? [] : ['mechanicId' => $code], $body->errors()->all());
    }

    /** @return array<string, array{string, int|null, string}> */
    public static function odometers(): array
    {
        return [
            'tidak dikirim' => ['{}', null, ''],
            'null mengosongkan' => ['{"odometer":null}', null, ''],
            'nol' => ['{"odometer":0}', 0, ''],
            'batas atas' => ['{"odometer":9999999}', 9_999_999, ''],
            'di atas batas' => ['{"odometer":10000000}', null, 'out_of_range'],
            'negatif' => ['{"odometer":-1}', null, 'out_of_range'],
            'pecahan' => ['{"odometer":12.5}', null, 'invalid_type'],
            'teks' => ['{"odometer":"12000"}', null, 'invalid_type'],
        ];
    }

    /** Odometer: integer 0..9.999.999 atau null (OdometerMasukan). */
    #[DataProvider('odometers')]
    public function test_nullable_integer(string $json, ?int $value, string $code): void
    {
        $body = JsonObject::parse($json);

        $this->assertSame($value, $body->nullableInt('odometer', 0, 9_999_999));
        $this->assertSame($code === '' ? [] : ['odometer' => $code], $body->errors()->all());
    }

    public function test_optional_phone_is_null_when_missing_or_null(): void
    {
        $body = JsonObject::parse('{"a":null,"b":"0812-3456-7890","c":"","d":628123}');

        $this->assertNull($body->optionalPhone('a'));
        $this->assertNull($body->optionalPhone('tidak-ada'));
        $this->assertSame('6281234567890', $body->optionalPhone('b'));
        $this->assertSame('', $body->optionalPhone('c'));
        $this->assertSame('', $body->optionalPhone('d'));
        $this->assertSame(['c' => 'required', 'd' => 'invalid_type'], $body->errors()->all());
    }

    public function test_plate_field_checks_type_before_plate_rules(): void
    {
        $body = JsonObject::parse('{"a":" b 1234-xyz ","b":1234,"c":null,"e":"B","f":"1234 AB"}');

        $plate = $body->plate('a');
        $this->assertSame(['B1234XYZ', 'B 1234 XYZ'], [$plate?->key, $plate?->display]);
        $this->assertNull($body->plate('b'));
        $this->assertNull($body->plate('c'));
        $this->assertNull($body->plate('d'));
        $this->assertNull($body->plate('e'));
        $this->assertNull($body->plate('f'));
        $this->assertSame(
            ['b' => 'invalid_type', 'c' => 'required', 'd' => 'required', 'e' => 'too_short', 'f' => 'invalid_format'],
            $body->errors()->all(),
        );
    }
}
