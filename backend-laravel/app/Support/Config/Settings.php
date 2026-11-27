<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Config;

use App\Support\Text\Text;
use Closure;
use Illuminate\Support\Env;

/**
 * Seluruh pengaturan backend dari env bersama (spec, bagian "Env bersama
 * backend"). Ketiga backend bengkel memakai nama env dan aturan yang sama
 * persis, sehingga satu berkas .env bisa dipakai bergantian oleh Laravel, Go,
 * dan NestJS.
 *
 * Env dibaca mentah lewat repositori env Laravel (bukan env()), karena env()
 * mengubah teks seperti "null" atau "true" menjadi nilai PHP. Semua nilai
 * dipangkas lebih dulu, supaya .env bergaris akhir CRLF tidak diam-diam
 * menambah "\r" di token. Semua masalah dikumpulkan sekaligus supaya pemasang
 * bisa membetulkan semuanya dalam satu kali jalan, dan pesan galat hanya
 * menyebut nama env, tidak pernah isinya.
 */
final class Settings
{
    /** Panjang minimal SETUP_TOKEN dalam byte, bila diisi. */
    public const MIN_SETUP_TOKEN_BYTES = 16;

    /** Pesan galat bila isDatabaseUrl() bernilai false. */
    public const DATABASE_URL_INVALID = 'DATABASE_URL harus berbentuk mysql://user:sandi@host:port/database';

    /**
     * Nilai SETUP_TOKEN yang pernah atau masih tertulis di .env.example dan
     * dokumentasi. Semua pembeli bisa membacanya, jadi server yang memakainya
     * bisa direbut siapa pun sebelum akun pemilik dibuat. Dibandingkan tanpa
     * membedakan huruf besar/kecil.
     */
    public const SETUP_TOKEN_CONTOH = [
        'token-setup-dev-bukan-rahasia',
        'HASIL_RAND_HEX_16',
    ];

    public int $port;

    public string $databaseUrl;

    /**
     * Token pemasangan pemilik pertama (POST /api/setup). Kosong berarti
     * pemasangan dimatikan, sehingga server yang baru dipasang tidak bisa
     * direbut orang lain sebelum pemiliknya siap.
     */
    public string $setupToken;

    /** Alamat kirim penyedia WhatsApp lengkap dengan path, dipakai apa adanya. */
    public string $waApiUrl;

    public string $waToken;

    /**
     * Alamat website publik tanpa garis miring di akhir, untuk merangkai
     * tautan di pesan WhatsApp: "{publicWebUrl}/servis/{token}" dan
     * "{publicWebUrl}/booking".
     */
    public string $publicWebUrl;

    /** @var list<string> */
    private array $problems = [];

    /** @param  Closure(string): string  $read  pembaca env mentah */
    private function __construct(private readonly Closure $read) {}

    /** @throws ConfigurationError bila ada env yang kosong atau tidak sah */
    public static function fromEnvironment(): self
    {
        return self::fromReader(fn (string $name): string => (string) Env::getRepository()->get($name));
    }

    /**
     * Sumber env dipisah dari aturan pemeriksaannya, supaya aturan itu bisa
     * diuji tanpa mengubah env proses.
     *
     * @param  callable(string): string  $read
     *
     * @throws ConfigurationError
     */
    public static function fromReader(callable $read): self
    {
        $s = new self($read(...));
        $s->port = $s->port();
        $s->databaseUrl = $s->required('DATABASE_URL');
        $s->checkDatabaseUrl();
        $s->waApiUrl = $s->required('WA_API_URL');
        $s->checkWaApiUrl();
        $s->waToken = $s->required('WA_TOKEN');
        // Token dikirim sebagai isi header Authorization. Spasi, baris baru,
        // atau huruf non-ASCII di header ditolak atau diubah pustaka HTTP,
        // jadi lebih baik backend menolak menyala daripada diam-diam gagal
        // mengirim setiap pesan.
        if ($s->waToken !== '' && preg_match('/^[\x21-\x7E]+$/D', $s->waToken) !== 1) {
            $s->fail('WA_TOKEN hanya boleh berisi karakter ASCII terlihat 0x21-0x7E (tanpa spasi)');
        }
        $s->publicWebUrl = $s->publicWebUrl();
        $s->setupToken = $s->value('SETUP_TOKEN');
        if ($s->setupToken !== '' && strlen($s->setupToken) < self::MIN_SETUP_TOKEN_BYTES) {
            $s->fail('SETUP_TOKEN minimal '.self::MIN_SETUP_TOKEN_BYTES.' byte, atau kosongkan untuk mematikan pemasangan awal');
        }
        foreach (self::SETUP_TOKEN_CONTOH as $contoh) {
            if (strcasecmp($s->setupToken, $contoh) === 0) {
                $s->fail('SETUP_TOKEN masih nilai contoh dari dokumentasi; isi dengan nilai acak sendiri, mis. hasil openssl rand -hex 16');
            }
        }
        if ($s->problems !== []) {
            throw new ConfigurationError('konfigurasi tidak sah: '.implode('; ', $s->problems));
        }

        return $s;
    }

    private function port(): int
    {
        $text = $this->required('PORT');
        if ($text === '') {
            return 0;
        }
        if (preg_match('/^[0-9]{1,5}$/D', $text) !== 1 || (int) $text < 1 || (int) $text > 65535) {
            $this->fail('PORT harus bilangan bulat 1..65535');

            return 0;
        }

        return (int) $text;
    }

    /**
     * Membaca DATABASE_URL dari env dengan cara yang sama seperti
     * fromEnvironment(): mentah, lalu dipangkas. "" berarti tidak diisi.
     * Dipakai juga oleh bengkel:migrate, yang hanya membutuhkan env ini.
     */
    public static function databaseUrlFromEnvironment(): string
    {
        return Text::trim((string) Env::getRepository()->get('DATABASE_URL'));
    }

    /** Bentuk yang diterima: mysql://user:sandi@host:port/database (satu nama database). */
    public static function isDatabaseUrl(string $databaseUrl): bool
    {
        $url = parse_url($databaseUrl);
        $database = is_array($url) ? ltrim($url['path'] ?? '', '/') : '';

        return is_array($url) && ($url['scheme'] ?? '') === 'mysql' && ($url['host'] ?? '') !== ''
            && $database !== '' && ! str_contains($database, '/');
    }

    private function checkDatabaseUrl(): void
    {
        if ($this->databaseUrl !== '' && ! self::isDatabaseUrl($this->databaseUrl)) {
            $this->fail(self::DATABASE_URL_INVALID);
        }
    }

    /**
     * Alamat kirim dipakai apa adanya (backend tidak menambah path), jadi
     * alamat tanpa path hampir pasti salah ketik: pesan akan terkirim ke "/"
     * dan selalu gagal.
     */
    private function checkWaApiUrl(): void
    {
        if ($this->waApiUrl === '') {
            return;
        }
        $url = parse_url($this->waApiUrl);
        if (! is_array($url) || ! in_array($url['scheme'] ?? '', ['http', 'https'], true) || ($url['host'] ?? '') === ''
            || in_array($url['path'] ?? '', ['', '/'], true)) {
            $this->fail('WA_API_URL harus alamat kirim http(s) lengkap dengan path, mis. https://api.fonnte.com/send');
        }
    }

    /**
     * PUBLIC_WEB_URL wajib diawali http:// atau https:// dan tanpa spasi.
     * Garis miring di akhir dibuang, jadi "https://bengkelku.id/" menghasilkan
     * tautan "https://bengkelku.id/servis/<token>", bukan "…id//servis/…".
     * Sesudah awalan harus ada alamat: "https://" saja akan menjadi tautan
     * rusak di setiap pesan WhatsApp.
     */
    private function publicWebUrl(): string
    {
        $url = $this->required('PUBLIC_WEB_URL');
        if ($url === '') {
            return '';
        }
        $url = rtrim($url, '/');
        if (preg_match('~^https?://[^/\s]~D', $url) !== 1 || preg_match('/\s/', $url) === 1) {
            $this->fail('PUBLIC_WEB_URL harus diawali http:// atau https:// tanpa spasi, mis. https://bengkelku.id');

            return '';
        }

        return $url;
    }

    /** Nilai env sesudah dipangkas; "" berarti tidak diisi. */
    private function value(string $name): string
    {
        return Text::trim(($this->read)($name));
    }

    private function required(string $name): string
    {
        $value = $this->value($name);
        if ($value === '') {
            $this->fail($name.' wajib diisi');
        }

        return $value;
    }

    private function fail(string $problem): void
    {
        $this->problems[] = $problem;
    }
}
