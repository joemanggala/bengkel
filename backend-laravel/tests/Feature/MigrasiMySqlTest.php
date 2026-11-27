<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Feature;

use App\Support\Config\PemeriksaanPasang;
use App\Support\Migrasi\Berkas;
use App\Support\Migrasi\Migrasi;
use App\Support\Migrasi\MigrasiKotor;
use App\Support\Migrasi\Pelaksana;
use App\Support\Migrasi\Status;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\Artisan;
use PDO;
use RuntimeException;
use Symfony\Component\Console\Output\BufferedOutput;

/**
 * bengkel:migrate terhadap MySQL sungguhan. Hanya jalan bila TEST_DATABASE_URL
 * diisi dengan database KOSONG yang dibuat khusus untuk tes ini, mis.
 *
 *   TEST_DATABASE_URL=mysql://root:root@127.0.0.1:3350/bengkel_tes_migrasi vendor/bin/phpunit --filter MigrasiMySqlTest
 *
 * Tes membuat semua tabel aplikasi di database itu lalu menghapus SEMUA
 * tabelnya sesudahnya. Karena itu tes menolak berjalan bila database sudah
 * berisi tabel, supaya database dev tidak terhapus karena salah alamat.
 */
final class MigrasiMySqlTest extends TestCase
{
    private ?PDO $pdo = null;

    private string $namaDb = '';

    /** @var list<string> */
    private array $folder = [];

    private bool $adaEnvAsli = false;

    private mixed $envAsli = null;

    protected function setUp(): void
    {
        parent::setUp();
        $url = trim((string) getenv('TEST_DATABASE_URL'));
        if ($url === '') {
            $this->markTestSkipped('TEST_DATABASE_URL kosong; tes migrasi sungguhan dilewati');
        }
        $pdo = Migrasi::buka($url);
        $this->namaDb = (string) $pdo->query('SELECT DATABASE()')->fetchColumn();
        $jumlah = (int) $pdo->query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()')->fetchColumn();
        if ($jumlah > 0) {
            $this->fail(sprintf('database %s berisi %d tabel; tes ini menghapus semua tabel di database uji, jadi pakai database kosong yang dibuat khusus',
                $this->namaDb, $jumlah));
        }
        // Baru dipasang sesudah database terbukti kosong: tearDown hanya
        // menghapus tabel bila $this->pdo terisi.
        $this->pdo = $pdo;

        // Perintah membaca DATABASE_URL lewat repositori env Laravel, yang
        // membaca $_SERVER lebih dulu.
        $this->adaEnvAsli = array_key_exists('DATABASE_URL', $_SERVER);
        $this->envAsli = $_SERVER['DATABASE_URL'] ?? null;
        $_SERVER['DATABASE_URL'] = $url;
    }

    protected function tearDown(): void
    {
        if ($this->pdo !== null) {
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
            $tabel = $this->pdo->query('SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()')->fetchAll(PDO::FETCH_COLUMN);
            foreach ($tabel as $nama) {
                $this->pdo->exec('DROP TABLE IF EXISTS `'.str_replace('`', '``', (string) $nama).'`');
            }
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
            $this->pdo = null;
            if ($this->adaEnvAsli) {
                $_SERVER['DATABASE_URL'] = $this->envAsli;
            } else {
                unset($_SERVER['DATABASE_URL']);
            }
        }
        foreach ($this->folder as $dir) {
            foreach (glob($dir.'/*') ?: [] as $berkas) {
                unlink($berkas);
            }
            rmdir($dir);
        }
        parent::tearDown();
    }

    private static function folderPaket(): string
    {
        return dirname(__DIR__, 3).DIRECTORY_SEPARATOR.'db'.DIRECTORY_SEPARATOR.'migrations';
    }

    /**
     * Folder sementara berisi salinan migrasi paket (bila $salinPaket) dan
     * berkas tambahan.
     *
     * @param  array<string, string>  $tambahan  nama berkas → isinya
     */
    private function folder(array $tambahan, bool $salinPaket): string
    {
        $dir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'bengkel-migrasi-'.bin2hex(random_bytes(6));
        mkdir($dir);
        $this->folder[] = $dir;
        if ($salinPaket) {
            foreach (glob(self::folderPaket().DIRECTORY_SEPARATOR.'*.up.sql') ?: [] as $berkas) {
                copy($berkas, $dir.DIRECTORY_SEPARATOR.basename($berkas));
            }
        }
        foreach ($tambahan as $nama => $isi) {
            file_put_contents($dir.DIRECTORY_SEPARATOR.$nama, $isi);
        }

        return $dir;
    }

    /**
     * @param  array<string, string>  $parameter
     * @return array{int, string}
     */
    private function migrate(array $parameter = []): array
    {
        $keluaran = new BufferedOutput;
        $kode = Artisan::call('bengkel:migrate', $parameter, $keluaran);

        // writeln memakai PHP_EOL, yang di Windows berupa CRLF.
        return [$kode, str_replace(PHP_EOL, "\n", $keluaran->fetch())];
    }

    /** @return list<array{int, int}> semua baris catatan versi */
    private function barisVersi(string $tabel = Pelaksana::TABEL_VERSI): array
    {
        return array_map(fn (array $b): array => [(int) $b[0], (int) $b[1]],
            $this->pdo->query('SELECT version, dirty FROM `'.$tabel.'`')->fetchAll(PDO::FETCH_NUM));
    }

    private function tabelAda(string $nama): bool
    {
        $q = $this->pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
        $q->execute([$nama]);

        return (int) $q->fetchColumn() === 1;
    }

    public function test_the_command_migrates_a_fresh_database_like_golang_migrate(): void
    {
        $paket = Migrasi::muat(self::folderPaket());
        $terakhir = $paket[count($paket) - 1]->versi;

        [$kode, $keluaran] = $this->migrate(['perintah' => 'versi']);
        $this->assertSame([0, "Database masih kosong (belum ada migrasi). Berkas terbaru: versi $terakhir.\n"], [$kode, $keluaran]);

        // Semua berkas paket dijalankan berurutan.
        [$kode, $keluaran] = $this->migrate();
        $harapan = implode('', array_map(fn (Berkas $b): string => 'Menjalankan '.$b->nama."\n", $paket))
            .sprintf("Selesai: %d migrasi dijalankan, database kini di versi %d.\n", count($paket), $terakhir);
        $this->assertSame([0, $harapan], [$kode, $keluaran]);

        // Catatan versi berbentuk sama dengan buatan golang-migrate: satu baris, bersih.
        $this->assertSame([[$terakhir, 0]], $this->barisVersi());
        $kolom = $this->pdo->query("SELECT column_name, column_type, is_nullable, column_key FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'schema_migrations' ORDER BY ordinal_position")->fetchAll(PDO::FETCH_NUM);
        $this->assertSame([['version', 'bigint', 'NO', 'PRI'], ['dirty', 'tinyint(1)', 'NO', '']], $kolom);

        // Skema lengkap: tabel dan baris awal yang diperiksa backend saat menyala.
        foreach (PemeriksaanPasang::TABLES as $tabel) {
            $this->assertTrue($this->tabelAda($tabel), 'tabel '.$tabel.' harus ada');
        }
        $this->assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM outlet WHERE outlet_id = 1')->fetchColumn());
        $this->assertSame(count(PemeriksaanPasang::COUNTERS), (int) $this->pdo->query(
            "SELECT COUNT(*) FROM counters WHERE name IN ('".implode("', '", PemeriksaanPasang::COUNTERS)."')")->fetchColumn());

        // Kunci sudah dilepas: koneksi lain bisa langsung memakainya.
        $kunci = $this->pdo->prepare('SELECT IS_FREE_LOCK(?)');
        $kunci->execute(['bengkel-migrasi:'.$this->namaDb]);
        $this->assertSame(1, (int) $kunci->fetchColumn());

        // Dijalankan ulang: tidak ada yang dijalankan.
        [$kode, $keluaran] = $this->migrate(['perintah' => 'up']);
        $this->assertSame([0, "Database sudah terbaru (versi $terakhir). Tidak ada yang dijalankan.\n"], [$kode, $keluaran]);
        [$kode, $keluaran] = $this->migrate(['perintah' => 'versi']);
        $this->assertSame([0, "Database di versi $terakhir (terbaru).\n"], [$kode, $keluaran]);

        // Berkas baru yang gagal di pernyataan KETIGA: dua pernyataan pertama
        // sudah jalan, pernyataan sesudah galat tidak, dan database kotor di
        // versi itu.
        $rusak = sprintf('%06d_rusak.up.sql', $terakhir + 1);
        $dir = $this->folder([$rusak => "CREATE TABLE uji_migrasi_b (id INT PRIMARY KEY);\n"
            ."INSERT INTO uji_migrasi_b (id) VALUES (1);\n"
            ."INI BUKAN SQL;\n"
            ."CREATE TABLE uji_migrasi_c (id INT PRIMARY KEY);\n"], true);
        [$kode, $keluaran] = $this->migrate(['perintah' => 'versi', '--dir' => $dir]);
        $this->assertSame([0, sprintf("Database di versi %d; ada migrasi baru sampai versi %d. Jalankan: php artisan bengkel:migrate up\n", $terakhir, $terakhir + 1)],
            [$kode, $keluaran]);

        [$kode, $keluaran] = $this->migrate(['--dir' => $dir]);
        $this->assertSame(1, $kode);
        $this->assertStringStartsWith("Menjalankan $rusak\nGagal: migrasi $rusak gagal: SQLSTATE[42000]", $keluaran);
        $this->assertStringContainsString(sprintf('(database kini berstatus kotor di versi %d)', $terakhir + 1), $keluaran);
        $this->assertSame([[$terakhir + 1, 1]], $this->barisVersi());
        $this->assertTrue($this->tabelAda('uji_migrasi_b'), 'pernyataan sebelum galat harus sudah jalan');
        $this->assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM uji_migrasi_b')->fetchColumn());
        $this->assertFalse($this->tabelAda('uji_migrasi_c'), 'pernyataan sesudah galat tidak boleh jalan');

        // Status kotor menolak migrasi dan versi sampai versinya dipaksa.
        $pesanKotor = 'Gagal: '.(new MigrasiKotor($terakhir + 1))->getMessage()."\n";
        $this->assertSame([1, $pesanKotor], $this->migrate(['--dir' => $dir]));
        $this->assertSame([1, $pesanKotor], $this->migrate(['perintah' => 'versi', '--dir' => $dir]));
        $this->assertSame([1, "Gagal: tidak ada berkas migrasi versi 99\n"], $this->migrate(['perintah' => 'paksa', 'nomor' => '99', '--dir' => $dir]));
        $this->assertSame([[$terakhir + 1, 1]], $this->barisVersi());

        $this->assertSame([0, sprintf("Versi database ditetapkan ke %d tanpa menjalankan berkas apa pun.\n", $terakhir + 1)],
            $this->migrate(['perintah' => 'paksa', 'nomor' => (string) ($terakhir + 1), '--dir' => $dir]));
        $this->assertSame([[$terakhir + 1, 0]], $this->barisVersi());

        // Database yang lebih baru dari berkas yang ada ditolak dengan jelas.
        $this->assertSame([1, sprintf("Gagal: database sudah di versi %d, lebih baru dari berkas migrasi terakhir (%d); pakai paket versi yang sesuai\n",
            $terakhir + 1, $terakhir)], $this->migrate());

        // Nama lain dari golang-migrate: force dan version.
        $this->assertSame(0, $this->migrate(['perintah' => 'force', 'nomor' => (string) $terakhir])[0]);
        $this->assertSame([0, "Database di versi $terakhir (terbaru).\n"], $this->migrate(['perintah' => 'version']));
        $this->assertSame([[$terakhir, 0]], $this->barisVersi());
    }

    /**
     * Kasus tepi lewat Pelaksana langsung, dengan tabel catatan versi
     * sendiri, seperti golang-migrate yang menerima nama tabel lain.
     */
    public function test_edge_cases_of_the_version_table_and_the_lock(): void
    {
        $tabel = 'uji_migrasi_versi';
        $p = new Pelaksana($this->pdo, $tabel, 1);
        $this->assertEquals(new Status(false, 0, false), $p->status(), 'tabel belum ada = kosong');

        // Berkas yang hanya berisi spasi tetap dihitung, tanpa mengirim apa pun ke MySQL.
        $daftar = Migrasi::muat($this->folder([
            '000001_buat.up.sql' => "CREATE TABLE uji_migrasi_a (id INT PRIMARY KEY);\n",
            '000002_kosong.up.sql' => " \n\t\n",
            // REPLACE: berkas ini dijalankan lagi di akhir tes, sesudah versi dipaksa mundur.
            '000004_isi.up.sql' => "REPLACE INTO uji_migrasi_a (id) VALUES (1), (2);\n",
        ], false));
        $dilapor = [];
        $this->assertSame(3, $p->naik($daftar, function (Berkas $b) use (&$dilapor): void {
            $dilapor[] = $b->versi;
        }));
        $this->assertSame([1, 2, 4], $dilapor);
        $this->assertSame([[4, 0]], $this->barisVersi($tabel));
        $this->assertSame(2, (int) $this->pdo->query('SELECT COUNT(*) FROM uji_migrasi_a')->fetchColumn());

        // Versi database yang berkasnya tidak ada di folder.
        $this->pdo->exec("UPDATE `$tabel` SET version = 3");
        $this->assertGalat('database di versi 3, tapi berkas migrasi versi itu tidak ada di folder', fn () => $p->naik($daftar));

        // Versi -1 kotor (ditulis golang-migrate bila migrasi pertama gagal
        // saat turun): belum ada versi utuh, dan migrasi ditolak.
        $this->pdo->exec("UPDATE `$tabel` SET version = -1, dirty = 1");
        $this->assertEquals(new Status(false, -1, true), $p->status());
        try {
            $p->naik($daftar);
            $this->fail('versi -1 kotor harus menolak migrasi');
        } catch (MigrasiKotor $e) {
            $this->assertSame(-1, $e->versi);
            $this->assertStringContainsString('"paksa -2"', $e->getMessage());
        }
        $p->paksa($daftar, 2);
        $this->assertSame([[2, 0]], $this->barisVersi($tabel));

        // Migrasi lain memegang kunci: ditolak setelah menunggu, tanpa mengubah apa pun.
        $lain = Migrasi::buka((string) $_SERVER['DATABASE_URL']);
        $ambil = $lain->prepare('SELECT GET_LOCK(?, 0)');
        $ambil->execute(['bengkel-migrasi:'.$this->namaDb]);
        $this->assertSame(1, (int) $ambil->fetchColumn());
        $sibuk = 'migrasi lain sedang berjalan di database ini; tunggu sampai selesai lalu coba lagi';
        $this->assertGalat($sibuk, fn () => $p->naik($daftar));
        $this->assertGalat($sibuk, fn () => $p->paksa($daftar, 4));
        $this->assertSame([[2, 0]], $this->barisVersi($tabel));
        $lain->query("SELECT RELEASE_LOCK('bengkel-migrasi:".$this->namaDb."')")->fetchAll();
        $lain = null;

        $this->assertSame(1, $p->naik($daftar));
        $this->assertSame([[4, 0]], $this->barisVersi($tabel));
    }

    private function assertGalat(string $pesan, callable $kerja): void
    {
        try {
            $kerja();
        } catch (RuntimeException $e) {
            $this->assertSame($pesan, $e->getMessage());

            return;
        }
        $this->fail('seharusnya gagal: '.$pesan);
    }
}
