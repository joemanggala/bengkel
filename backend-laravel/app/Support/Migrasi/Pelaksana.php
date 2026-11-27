<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\Migrasi;

use App\Support\Database\SqlError;
use Closure;
use InvalidArgumentException;
use PDO;
use PDOException;
use RuntimeException;
use Throwable;

/**
 * Menjalankan migrasi pada satu database, lewat satu koneksi PDO dari
 * Migrasi::buka(). Satu objek PDO = satu sesi MySQL, jadi kunci GET_LOCK
 * dan semua pernyataan berada di koneksi yang sama sampai selesai.
 */
final class Pelaksana
{
    /** Nama tabel catatan versi bawaan golang-migrate. */
    public const TABEL_VERSI = 'schema_migrations';

    /** Galat MySQL "tabel tidak ada". */
    private const TABEL_TIDAK_ADA = 1146;

    /**
     * @param  string  $tabel  tabel catatan versi; selain bawaan hanya untuk tes
     * @param  int  $tungguKunci  detik menunggu migrasi lain yang sedang berjalan
     */
    public function __construct(
        private readonly PDO $pdo,
        private readonly string $tabel = self::TABEL_VERSI,
        private readonly int $tungguKunci = 10,
    ) {
        if (preg_match('/^[A-Za-z0-9_]+$/D', $tabel) !== 1) {
            throw new InvalidArgumentException('nama tabel catatan versi tidak sah');
        }
    }

    /** Membaca versi database tanpa mengubah apa pun. */
    public function status(): Status
    {
        return $this->bacaStatus();
    }

    /**
     * Menjalankan semua berkas yang versinya lebih baru dari database.
     *
     * @param  list<Berkas>  $daftar  hasil Migrasi::muat(), urut menurut versi
     * @param  (Closure(Berkas): void)|null  $lapor  dipanggil sebelum tiap berkas dijalankan
     * @return int jumlah berkas yang dijalankan
     *
     * @throws MigrasiKotor migrasi sebelumnya gagal di tengah jalan
     * @throws RuntimeException berkas gagal (database kini kotor di versi itu), atau versi database tidak cocok dengan folder
     */
    public function naik(array $daftar, ?Closure $lapor = null): int
    {
        if ($daftar === []) {
            throw new InvalidArgumentException('daftar berkas migrasi kosong');
        }

        return $this->denganKunci(function () use ($daftar, $lapor): int {
            $st = $this->bacaStatus();
            if ($st->kotor) {
                throw new MigrasiKotor($st->versi);
            }
            $mulai = 0;
            if ($st->ada) {
                $i = self::cariVersi($daftar, $st->versi);
                if ($i < 0) {
                    $terakhir = $daftar[count($daftar) - 1]->versi;
                    if ($st->versi > $terakhir) {
                        throw new RuntimeException(sprintf('database sudah di versi %d, lebih baru dari berkas migrasi terakhir (%d); pakai paket versi yang sesuai',
                            $st->versi, $terakhir));
                    }
                    throw new RuntimeException(sprintf('database di versi %d, tapi berkas migrasi versi itu tidak ada di folder', $st->versi));
                }
                $mulai = $i + 1;
            }
            $n = 0;
            foreach (array_slice($daftar, $mulai) as $b) {
                if ($lapor !== null) {
                    $lapor($b);
                }
                $this->tulisVersi($b->versi, true);
                if (trim($b->isi) !== '') {
                    try {
                        $this->jalankanBerkas($b->isi);
                    } catch (PDOException $e) {
                        throw new RuntimeException(sprintf('migrasi %s gagal: %s (database kini berstatus kotor di versi %d)',
                            $b->nama, $e->getMessage(), $b->versi), 0, $e);
                    }
                }
                $this->tulisVersi($b->versi, false);
                $n++;
            }

            return $n;
        });
    }

    /**
     * Menetapkan versi database tanpa menjalankan berkas apa pun, sama
     * seperti "migrate force". Dipakai setelah migrasi gagal dan isi
     * database sudah diperbaiki tangan. Versi harus salah satu berkas di
     * daftar.
     *
     * @param  list<Berkas>  $daftar
     *
     * @throws RuntimeException tidak ada berkas versi itu
     */
    public function paksa(array $daftar, int $versi): void
    {
        if (self::cariVersi($daftar, $versi) < 0) {
            throw new RuntimeException(sprintf('tidak ada berkas migrasi versi %d', $versi));
        }
        $this->denganKunci(fn () => $this->tulisVersi($versi, false));
    }

    /** @param  list<Berkas>  $daftar */
    private static function cariVersi(array $daftar, int $versi): int
    {
        foreach ($daftar as $i => $b) {
            if ($b->versi === $versi) {
                return $i;
            }
        }

        return -1;
    }

    /**
     * Satu berkas berisi banyak pernyataan dan dikirim sekaligus. Hasil tiap
     * pernyataan dibaca satu per satu dengan nextRowset(): galat di
     * pernyataan mana pun (bukan hanya yang pertama) dilempar sebagai
     * PDOException karena ERRMODE_EXCEPTION, dan MySQL berhenti di
     * pernyataan yang gagal itu. PDO::exec() tidak dipakai karena tidak
     * menjamin galat di pernyataan kedua dan seterusnya ikut dilaporkan.
     */
    private function jalankanBerkas(string $isi): void
    {
        $hasil = $this->pdo->query($isi);
        while ($hasil->nextRowset()) {
            // Lanjut ke hasil pernyataan berikutnya sampai habis.
        }
    }

    private function bacaStatus(): Status
    {
        try {
            $baris = $this->pdo->query('SELECT version, dirty FROM `'.$this->tabel.'` LIMIT 1')->fetch(PDO::FETCH_NUM);
        } catch (PDOException $e) {
            if (SqlError::errno($e) === self::TABEL_TIDAK_ADA) {
                return Status::kosong();
            }
            throw $e;
        }
        if ($baris === false) {
            return Status::kosong();
        }
        $versi = (int) $baris[0];

        // golang-migrate menulis versi -1 berstatus kotor bila migrasi
        // pertama gagal saat turun; artinya belum ada versi yang utuh.
        return new Status($versi >= 0, $versi, (bool) (int) $baris[1]);
    }

    /**
     * Meniru SetVersion golang-migrate: hapus baris lama dan tulis baris
     * baru dalam satu transaksi.
     */
    private function tulisVersi(int $versi, bool $kotor): void
    {
        $this->pdo->beginTransaction();
        try {
            $this->pdo->exec('DELETE FROM `'.$this->tabel.'`');
            $tulis = $this->pdo->prepare('INSERT INTO `'.$this->tabel.'` (version, dirty) VALUES (?, ?)');
            $tulis->bindValue(1, $versi, PDO::PARAM_INT);
            $tulis->bindValue(2, $kotor ? 1 : 0, PDO::PARAM_INT);
            $tulis->execute();
            $this->pdo->commit();
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Mengunci lewat GET_LOCK supaya dua migrasi tidak berjalan bersamaan di
     * database yang sama, memastikan tabel catatan versi ada (bentuknya sama
     * dengan buatan golang-migrate), lalu menjalankan $kerja. Kunci dilepas
     * apa pun hasilnya; bila proses mati di tengah jalan, MySQL melepasnya
     * sendiri saat koneksi putus.
     *
     * @template T
     *
     * @param  Closure(): T  $kerja
     * @return T
     */
    private function denganKunci(Closure $kerja): mixed
    {
        $kunci = 'bengkel-migrasi:'.(string) $this->pdo->query('SELECT DATABASE()')->fetchColumn();
        $kunciDiminta = $this->pdo->prepare('SELECT GET_LOCK(?, ?)');
        $kunciDiminta->bindValue(1, $kunci);
        $kunciDiminta->bindValue(2, $this->tungguKunci, PDO::PARAM_INT);
        $kunciDiminta->execute();
        $dapat = $kunciDiminta->fetchColumn();
        $kunciDiminta->closeCursor();
        if ($dapat === null || $dapat === false || (int) $dapat !== 1) {
            throw new RuntimeException('migrasi lain sedang berjalan di database ini; tunggu sampai selesai lalu coba lagi');
        }
        try {
            $this->pdo->exec('CREATE TABLE IF NOT EXISTS `'.$this->tabel.'` (version bigint not null primary key, dirty boolean not null)');

            return $kerja();
        } finally {
            try {
                $lepas = $this->pdo->prepare('SELECT RELEASE_LOCK(?)');
                $lepas->execute([$kunci]);
                $lepas->closeCursor();
            } catch (Throwable) {
                // Kunci tetap lepas saat koneksi ditutup.
            }
        }
    }
}
