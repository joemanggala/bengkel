<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Outlet\Contracts\OutletRepositoryInterface;
use App\Modules\Servis\Contracts\ServisRepositoryInterface;
use App\Modules\Sesi\Peran;
use App\Modules\Sesi\SesiStaf;
use App\Modules\WhatsApp\JenisPesan;
use App\Modules\WhatsApp\PesanWaService;
use App\Support\Http\ApiError;
use App\Support\Http\Page;
use App\Support\Security\SecretToken;
use App\Support\Security\Uuid;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use App\Support\Validation\FieldCode;
use App\Support\Validation\JsonObject;
use LogicException;

/**
 * Aturan SPK: daftar, rincian, membuat, mengubah data, mengubah status, dan
 * membatalkan. Item, pembayaran, WhatsApp kirim ulang, dan tautan lacak ada
 * di AksiSpkService; booking yang dijadikan SPK di KonversiBookingService.
 * Tidak tahu soal HTTP; mengembalikan data atau melempar ApiError.
 *
 * Pola setiap rute yang mengubah SPK: baris SPK dikunci di dalam transaksi,
 * aturan 403/409 dinilai ulang dengan nilai yang baru dikunci (AturanSpk,
 * BatasMekanik), baru data ditulis. Pesan WhatsApp selalu dikirim SESUDAH
 * commit, supaya kunci baris tidak ditahan selama menunggu penyedia.
 */
final class ServisService
{
    /** Jenis pesan di ringkasan `wa` rincian SPK (RingkasanWa). */
    private const JENIS_WA = [JenisPesan::SpkDibuat, JenisPesan::SiapDiambil, JenisPesan::Nota];

    public function __construct(
        private readonly ServisRepositoryInterface $repository,
        private readonly OutletRepositoryInterface $outlet,
        private readonly PesanWaService $wa,
        private readonly PesanSpk $pesan,
        private readonly Clock $clock,
    ) {}

    // --- Baca -------------------------------------------------------------------

    /**
     * Daftar SPK. Untuk mekanik, saringan mekanik selalu dirinya sendiri
     * (BatasMekanik::saringanDaftar), apa pun ?mechanicId= yang dikirim.
     *
     * @return array{0: list<array<string, mixed>>, 1: int}
     */
    public function daftar(FilterDaftar $filter, Page $page): array
    {
        if ($filter->search !== null && $filter->search->neverMatches()) {
            return [[], 0];
        }
        [$rows, $total] = $this->repository->daftar($filter, $page);

        return [array_map(fn (object $r): array => PenyajiSpk::ringkas($r), $rows), $total];
    }

    /** SPK dari nomor di path; bentuk yang salah langsung 404 tanpa bertanya ke database. */
    public function cari(string $number): DasarSpk
    {
        $spk = NomorSpk::sah($number) ? $this->repository->cariNomor($number) : null;

        return $spk ?? throw ApiError::notFound('SPK tidak ditemukan');
    }

    /**
     * Rute yang boleh dipanggil mekanik (rincian, PATCH, status): 404 lebih
     * dulu, lalu 403 bila SPK itu bukan miliknya (keputusan 0a-6).
     */
    public function bukaUntuk(SesiStaf $sesi, string $number): DasarSpk
    {
        $spk = $this->cari($number);
        BatasMekanik::bolehBuka($sesi, $spk->mechanicId);

        return $spk;
    }

    /** @return array<string, mixed> SpkDetail */
    public function detail(string $workOrderId): array
    {
        $r = $this->repository->baris($workOrderId) ?? throw new LogicException('SPK '.$workOrderId.' hilang');

        return PenyajiSpk::detail(
            $r,
            $this->repository->item($workOrderId),
            $this->repository->pembayaran($workOrderId),
            $this->repository->linimasa($workOrderId),
            $this->wa->ringkasan('work_order_id', $workOrderId, self::JENIS_WA),
        );
    }

    /**
     * Halaman lacak publik. Token yang bentuknya salah, tak dikenal, atau
     * sudah dibuat ulang sama-sama 404.
     *
     * @return array<string, mixed> SpkPublik
     */
    public function publik(string $trackingToken): array
    {
        $id = SecretToken::valid($trackingToken) ? $this->repository->cariToken($trackingToken) : null;
        if ($id === null) {
            throw ApiError::notFound('SPK tidak ditemukan');
        }
        $r = $this->repository->baris($id) ?? throw ApiError::notFound('SPK tidak ditemukan');

        return PenyajiSpk::publik($r, $this->repository->item($id), $this->repository->linimasa($id), $this->outlet->ambil());
    }

    /** Kendaraan untuk riwayat servis; bentuk UUID yang salah atau tidak ada → 404. */
    public function pastikanKendaraan(string $vehicleId): void
    {
        if (! Uuid::valid($vehicleId) || $this->repository->pemilikKendaraan($vehicleId) === null) {
            throw ApiError::notFound('Kendaraan tidak ditemukan');
        }
    }

    // --- Rujukan untuk validasi (langkah 422) ------------------------------------

    /**
     * Rujukan vehicleId: kendaraan tidak ada → unknown_reference. Hanya
     * dinilai bila bentuknya sah. Mengembalikan pemilik kendaraan.
     */
    public function rujukanKendaraan(JsonObject $body, string $vehicleId): ?string
    {
        if ($body->failed('vehicleId')) {
            return null;
        }
        $pemilik = $this->repository->pemilikKendaraan($vehicleId);
        if ($pemilik === null) {
            $body->fail('vehicleId', FieldCode::UNKNOWN_REFERENCE);
        }

        return $pemilik;
    }

    /**
     * Rujukan mechanicId (MekanikMasukan): tidak ada atau bukan ber-role
     * mechanic → unknown_reference; mekanik nonaktif → inactive_reference.
     * Null tidak dinilai, dan $sekarang (mekanik SPK saat ini, untuk PATCH)
     * juga tidak dinilai lagi, supaya mekanik yang sudah nonaktif tetap boleh
     * tertera di SPK lamanya.
     */
    public function rujukanMekanik(JsonObject $body, ?string $mechanicId, ?string $sekarang = null): void
    {
        if ($mechanicId === null || $body->failed('mechanicId') || $mechanicId === $sekarang) {
            return;
        }
        $staf = $this->repository->staf($mechanicId);
        if ($staf === null || $staf->role !== Peran::Mekanik->value) {
            $body->fail('mechanicId', FieldCode::UNKNOWN_REFERENCE);
        } elseif (! (bool) $staf->is_active) {
            $body->fail('mechanicId', FieldCode::INACTIVE_REFERENCE);
        }
    }

    // --- Membuat SPK --------------------------------------------------------------

    /**
     * POST /api/work-orders. Nomor, SPK, dan baris linimasa pertama ditulis
     * dalam satu transaksi; pesan "SPK dibuat" dikirim sesudah commit.
     *
     * @return array<string, mixed> SpkDetail
     */
    public function buat(SesiStaf $sesi, SpkBaru $spk): array
    {
        $now = Time::toDb($this->clock->now());
        $id = $this->repository->transaction(fn (): string => $this->simpanBaru($spk, $sesi->staffId, $now));
        $this->kirimOtomatis(JenisPesan::SpkDibuat, $id);

        return $this->detail($id);
    }

    /**
     * Menulis SPK baru di transaksi pemanggil (dipakai juga konversi booking):
     * baris counters dikunci dan dinaikkan, SPK disimpan berstatus QUEUED
     * dengan token lacak baru (disimpan apa adanya, keputusan 0a-1), lalu
     * satu baris linimasa null → QUEUED.
     *
     * @return string work_order_id
     */
    public function simpanBaru(SpkBaru $spk, string $staffId, string $now): string
    {
        $number = NomorSpk::dari($this->repository->nomorBaru());
        $id = Uuid::new();
        [$token] = SecretToken::new();
        $this->repository->simpanSpk($id, $number, $token, $spk, $staffId, $now);
        $this->repository->catatLinimasa($id, null, StatusSpk::Antre->value, $staffId, '', $now);

        return $id;
    }

    /**
     * Pesan otomatis sesudah commit. Galat apa pun (menyusun, mengirim, atau
     * mencatat) hanya dicatat di log; balasan tetap 2xx karena transaksinya
     * sudah tersimpan.
     */
    public function kirimOtomatis(JenisPesan $jenis, string $workOrderId): void
    {
        $this->wa->kirimOtomatis($jenis, $workOrderId, fn (): array => $this->pesan->susun($jenis, $workOrderId));
    }

    // --- Mengubah SPK -------------------------------------------------------------

    /**
     * PATCH /api/work-orders/{number}. Baris dikunci, kepemilikan mekanik dan
     * status diperiksa ulang sesudah dikunci, lalu hanya kolom yang dikirim
     * yang di-UPDATE. {} tetap diperiksa terhadap status (SPK terkunci → 409),
     * tetapi tidak menulis apa pun. Tidak menulis linimasa dan tidak
     * mengirim WhatsApp.
     *
     * @return array<string, mixed> SpkDetail
     */
    public function ubah(SesiStaf $sesi, DasarSpk $dasar, PerubahanSpk $perubahan): array
    {
        $this->repository->transaction(function () use ($sesi, $dasar, $perubahan): void {
            $spk = $this->kunci($dasar->id);
            BatasMekanik::bolehBuka($sesi, $spk->mechanicId);
            AturanSpk::ubahData($spk->status);
            if (! $perubahan->kosong()) {
                $this->repository->ubah($dasar->id, $perubahan->kolom, Time::toDb($this->clock->now()));
            }
        });

        return $this->detail($dasar->id);
    }

    /**
     * POST /api/work-orders/{number}/status. Sesudah 422: 403 (mekanik ke
     * PICKED_UP) → 409 transisi → 409 work_order_empty / not_paid_off
     * (AturanSpk::ubahStatus). Status dan linimasa ditulis dalam satu
     * transaksi yang mengunci baris SPK, jadi dua permintaan serentak untuk
     * langkah yang sama menghasilkan satu 200 dan satu 409. Menjadi DONE
     * mengirim "siap diambil" sesudah commit. Stok tidak pernah disentuh.
     *
     * @return array<string, mixed> SpkDetail
     */
    public function ubahStatus(SesiStaf $sesi, DasarSpk $dasar, StatusSpk $ke, string $note): array
    {
        $this->repository->transaction(function () use ($sesi, $dasar, $ke, $note): void {
            $spk = $this->kunci($dasar->id);
            // Mekanik SPK bisa diganti kasir di antara pemeriksaan awal dan kunci.
            BatasMekanik::bolehBuka($sesi, $spk->mechanicId);
            AturanSpk::ubahStatus($spk->status, $ke, $sesi->peran, $this->repository->jumlahItem($dasar->id), $spk->sisa());
            $now = Time::toDb($this->clock->now());
            $this->repository->ubah($dasar->id, ['status' => $ke->value], $now);
            $this->repository->catatLinimasa($dasar->id, $spk->status->value, $ke->value, $sesi->staffId, $note, $now);
        });
        if ($ke === StatusSpk::Selesai) {
            $this->kirimOtomatis(JenisPesan::SiapDiambil, $dasar->id);
        }

        return $this->detail($dasar->id);
    }

    /**
     * POST /api/work-orders/{number}/cancel. Urutan kunci baris SPK → baris
     * sparepart (part_id naik, sama dengan semua transaksi lain yang
     * mengunci sparepart), supaya tidak saling kunci. Setiap sparepart yang
     * masih tertahan di SPK kembali ke stok sebesar jumlah item part-nya yang
     * masih ada, dengan satu kartu RETURNED per sparepart; item tetap
     * tercatat untuk dilihat. Tidak ada pesan WhatsApp.
     *
     * @return array<string, mixed> SpkDetail
     */
    public function batal(SesiStaf $sesi, DasarSpk $dasar, string $reason): array
    {
        $this->repository->transaction(function () use ($sesi, $dasar, $reason): void {
            $spk = $this->kunci($dasar->id);
            AturanSpk::batal($spk->status, $spk->paidAmount);
            $now = Time::toDb($this->clock->now());
            foreach ($this->repository->partTertahan($dasar->id) as $partId => $jumlah) {
                // Sparepart yang sudah nonaktif tetap menerima stoknya kembali.
                $this->repository->part($partId, kunci: true);
                $this->repository->geserStok($partId, $jumlah, $dasar->id, $sesi->staffId, $now);
            }
            $this->repository->ubah($dasar->id, ['status' => StatusSpk::Dibatalkan->value, 'cancel_reason' => $reason], $now);
            $this->repository->catatLinimasa($dasar->id, $spk->status->value, StatusSpk::Dibatalkan->value, $sesi->staffId, $reason, $now);
        });

        return $this->detail($dasar->id);
    }

    /** Baris SPK terkunci; SPK tidak pernah dihapus, jadi null berarti kesalahan pemrograman. */
    public function kunci(string $workOrderId): SpkTerkunci
    {
        return $this->repository->kunci($workOrderId) ?? throw new LogicException('SPK '.$workOrderId.' hilang');
    }
}
