<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Staf;

use App\Modules\Sesi\Peran;
use App\Modules\Sesi\SesiService;
use App\Modules\Sesi\SesiStaf;
use App\Modules\Staf\Contracts\StafRepositoryInterface;
use App\Support\Http\ApiError;
use App\Support\Security\BatasMasuk;
use App\Support\Security\Password;
use App\Support\Security\Uuid;
use App\Support\Text\Text;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use LogicException;

/**
 * Aturan akun staf: pemasangan pemilik pertama, masuk, dan kelola staf.
 * Tidak tahu soal HTTP; mengembalikan data atau melempar ApiError.
 */
final class StafService
{
    public function __construct(
        private readonly StafRepositoryInterface $repository,
        private readonly SesiService $sesi,
        private readonly Clock $clock,
        private readonly BatasMasuk $batas,
    ) {}

    public function perluPemasangan(): bool
    {
        return ! $this->repository->adaStaf();
    }

    /**
     * Membuat pemilik pertama dan langsung membukakan sesinya. Pemeriksaan
     * "sudah ada staf" dan pembuatan staf terjadi di dalam satu transaksi yang
     * mengunci baris yang sama untuk semua setup, jadi permintaan serentak
     * hanya menghasilkan satu pemilik; sisanya 409.
     *
     * @return array{token: string, staff: Staf}
     */
    public function pasangPemilik(string $name, string $email, string $password): array
    {
        // bcrypt sengaja lambat (±250 ms), jadi dihitung sebelum kunci diambil.
        $hash = Password::hash($password);

        return $this->repository->transaction(function () use ($name, $email, $hash): array {
            $this->repository->kunciOutlet();
            if ($this->repository->adaStaf()) {
                throw ApiError::conflict('already_set_up');
            }
            $staffId = Uuid::new();
            $this->repository->simpanBaru($staffId, $name, $email, $hash, Peran::Pemilik->value, Time::toDb($this->clock->now()));

            return ['token' => $this->sesi->buka($staffId), 'staff' => $this->profil($staffId)];
        });
    }

    /**
     * Satu email hanya boleh dicoba AturanBatasMasuk::MAKS_PERCOBAAN kali
     * berturut-turut; sesudahnya semua percobaan (termasuk sandi yang benar)
     * dijawab 429 sampai kuncinya lewat. Email yang tidak terdaftar dihitung
     * sama, supaya jawaban 429 tidak membocorkan email mana yang ada.
     * Percobaan dihitung sebelum sandi diperiksa, jadi permintaan serentak
     * pun tidak melewati batas.
     *
     * @return array{token: string, staff: Staf}
     */
    public function masuk(string $email, string $password): array
    {
        $sisa = $this->batas->coba($email, $this->clock->now());
        if ($sisa > 0) {
            throw ApiError::tooManyRequests($sisa);
        }
        $hasil = $this->periksaMasuk($email, $password);
        $this->batas->berhasil($email);

        return $hasil;
    }

    /**
     * Email tak dikenal, sandi salah, dan staf nonaktif dijawab sama persis
     * (401 invalid_credentials), supaya penebak tidak tahu email mana yang
     * terdaftar.
     *
     * @return array{token: string, staff: Staf}
     */
    private function periksaMasuk(string $email, string $password): array
    {
        // Kolom email hanya ASCII: email berhuruf non-ASCII pasti tidak
        // terdaftar, dan membandingkannya di MySQL justru memicu galat
        // collation. Sandi bermuatan NUL atau lebih dari 72 byte tidak pernah
        // cocok; pustaka bcrypt berbeda-beda menanganinya, jadi tidak
        // diteruskan sama sekali.
        if (! Text::isAscii($email) || str_contains($password, "\0") || strlen($password) > Password::MAX_BYTES) {
            throw ApiError::invalidCredentials();
        }
        $found = $this->repository->cariUntukMasuk($email);
        if ($found === null) {
            // Tetap menghitung bcrypt supaya lama balasan tidak membocorkan
            // apakah email itu terdaftar.
            Password::verifyDummy($password);
            throw ApiError::invalidCredentials();
        }
        if (! Password::verify($password, $found['passwordHash']) || ! $found['isActive']) {
            throw ApiError::invalidCredentials();
        }
        $token = $this->sesi->buka($found['staffId']);
        $this->sesi->bersihkanKedaluwarsa($found['staffId']);

        return ['token' => $token, 'staff' => $this->profil($found['staffId'])];
    }

    public function profil(string $staffId): Staf
    {
        return $this->repository->ambil($staffId) ?? throw new LogicException('staf '.$staffId.' hilang');
    }

    /** @return list<Staf> */
    public function daftar(): array
    {
        return $this->repository->daftar();
    }

    /** @return list<array{staffId: string, name: string}> */
    public function mekanikAktif(): array
    {
        return $this->repository->mekanikAktif();
    }

    /**
     * Pemeriksaan email dan INSERT berada di satu transaksi yang lebih dulu
     * mengunci baris outlet, mutex yang sama dengan mengubah staf, jadi dua
     * staf baru dengan email yang sama → satu 201 dan satu 409. Hash bcrypt
     * dibuat sebelum transaksi supaya kunci tidak ditahan selama hashing.
     */
    public function buat(string $name, string $email, string $password, Peran $role): Staf
    {
        $hash = Password::hash($password);
        $staffId = Uuid::new();
        $this->repository->transaction(function () use ($staffId, $name, $email, $hash, $role): void {
            $this->repository->kunciOutlet();
            if ($this->repository->emailDipakaiStafLain($email, $staffId)) {
                throw ApiError::conflict('email_taken');
            }
            $this->repository->simpanBaru($staffId, $name, $email, $hash, $role->value, Time::toDb($this->clock->now()));
        });

        return $this->profil($staffId);
    }

    /** Staf yang akan diubah; 404 bila tidak ada (diperiksa sebelum validasi badan). */
    public function cari(string $staffId): Staf
    {
        $staf = Uuid::valid($staffId) ? $this->repository->ambil($staffId) : null;

        return $staf ?? throw ApiError::notFound('Staf tidak ditemukan');
    }

    /**
     * Perubahan sebagian. Urutan bentrok: email_taken lebih dulu, lalu
     * last_owner.
     *
     * Semua perubahan staf saling eksklusif: transaksi lebih dulu mengunci
     * baris outlet (mutex), baru staf target dan semua pemilik aktif. Tanpa
     * mutex, dua pemilik terakhir yang saling menurunkan peran bersamaan
     * masing-masing mengunci barisnya sendiri lalu menunggu baris yang lain,
     * dan MySQL mematikan salah satunya sebagai deadlock. Dengan mutex,
     * permintaan kedua menunggu sampai yang pertama selesai, lalu melihat
     * bahwa ia tinggal pemilik terakhir (409 last_owner).
     */
    public function ubah(SesiStaf $peminta, string $staffId, PerubahanStaf $perubahan): Staf
    {
        $hash = $perubahan->password === null ? null : Password::hash($perubahan->password);

        $this->repository->transaction(function () use ($peminta, $staffId, $perubahan, $hash): void {
            $this->repository->kunciOutlet();
            $staf = $this->repository->kunci($staffId) ?? throw ApiError::notFound('Staf tidak ditemukan');
            if ($perubahan->email !== null && $perubahan->email !== $staf->email
                && $this->repository->emailDipakaiStafLain($perubahan->email, $staffId)) {
                throw ApiError::conflict('email_taken');
            }
            $role = $perubahan->role ?? $staf->role;
            $isActive = $perubahan->isActive ?? $staf->isActive;
            $tetapPemilikAktif = $role === Peran::Pemilik && $isActive;
            if ($staf->pemilikAktif() && ! $tetapPemilikAktif
                && $this->repository->kunciJumlahPemilikAktifLain($staffId) === 0) {
                throw ApiError::conflict('last_owner');
            }

            $changes = array_filter([
                'name' => $perubahan->name,
                'email' => $perubahan->email,
                'password_hash' => $hash,
                'role' => $perubahan->role?->value,
                'is_active' => $perubahan->isActive,
            ], fn ($value) => $value !== null);
            if ($changes !== []) {
                $this->repository->ubah($staffId, $changes, Time::toDb($this->clock->now()));
            }

            if ($perubahan->isActive === false) {
                // Staf nonaktif kehilangan semua sesinya, termasuk sesi peminta
                // bila ia menonaktifkan dirinya sendiri.
                $this->sesi->cabutSemua($staffId);
            } elseif ($hash !== null) {
                // Sandi baru mengeluarkan semua perangkat lain, tetapi tidak
                // mengeluarkan orang yang sedang mengganti sandinya.
                $this->sesi->cabutSemua($staffId, $peminta->sesiId);
            }
        });

        return $this->profil($staffId);
    }
}
