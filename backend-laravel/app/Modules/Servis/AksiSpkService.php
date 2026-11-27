<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

use App\Modules\Servis\Contracts\ServisRepositoryInterface;
use App\Modules\Sesi\SesiStaf;
use App\Modules\Stok\PesanStokKurang;
use App\Modules\WhatsApp\JenisPesan;
use App\Modules\WhatsApp\PesanWaService;
use App\Support\Http\ApiError;
use App\Support\Security\SecretToken;
use App\Support\Security\Uuid;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use App\Support\Validation\FieldCode;
use App\Support\Validation\JsonObject;

/**
 * Aksi kasir pada SPK: item jasa dan sparepart, pembayaran, kirim ulang
 * WhatsApp, dan membuat ulang tautan lacak. Mekanik sudah ditolak middleware
 * peran sebelum sampai ke sini: uang dan stok hanya disentuh peran yang
 * bertanggung jawab atas kas.
 */
final class AksiSpkService
{
    /** Paling banyak 50 baris item per SPK. */
    public const MAKS_ITEM = 50;

    public function __construct(
        private readonly ServisRepositoryInterface $repository,
        private readonly ServisService $servis,
        private readonly PesanWaService $wa,
        private readonly PesanSpk $pesan,
        private readonly Clock $clock,
    ) {}

    // --- Item -----------------------------------------------------------------------

    /**
     * Rujukan item di langkah 422 (dibaca tanpa kunci): jasa atau sparepart
     * tidak ada → unknown_reference, nonaktif → inactive_reference. Jasa
     * yang tidak tampil di website boleh dipakai.
     */
    public function rujukanItem(JsonObject $body, string $type, string $refId): void
    {
        $field = $type === 'SERVICE' ? 'serviceId' : 'partId';
        if ($body->failed($field)) {
            return;
        }
        $row = $type === 'SERVICE' ? $this->repository->jasa($refId) : $this->repository->part($refId);
        if ($row === null) {
            $body->fail($field, FieldCode::UNKNOWN_REFERENCE);
        } elseif (! (bool) $row->is_active) {
            $body->fail($field, FieldCode::INACTIVE_REFERENCE);
        }
    }

    /**
     * POST /api/work-orders/{number}/items, sesudah 422 badan dan rujukan:
     * di bawah kunci baris SPK, 409 work_order_locked → 422 too_many_items →
     * (PART) baris sparepart dikunci dan dibaca ulang: nonaktif → 422,
     * stok kurang → 409 insufficient_stock. Semua di satu transaksi, jadi
     * bila ditolak tidak ada yang berubah, dan dua kasir yang memakai stok
     * terakhir bersamaan tidak pernah membuat stok negatif.
     *
     * Harga part selalu harga jual katalog saat ini; harga jasa dari katalog
     * kecuali $price dikirim. Nama, harga jual, dan harga beli disalin ke
     * item, sehingga perubahan katalog tidak mengubah SPK lama maupun labanya.
     *
     * @return array<string, mixed> SpkDetail
     */
    public function tambahItem(SesiStaf $sesi, DasarSpk $dasar, string $type, string $refId, int $quantity, ?int $price): array
    {
        $this->repository->transaction(function () use ($sesi, $dasar, $type, $refId, $quantity, $price): void {
            $spk = $this->servis->kunci($dasar->id);
            AturanSpk::ubahData($spk->status);
            if ($this->repository->jumlahItem($dasar->id) >= self::MAKS_ITEM) {
                throw ApiError::validation(['items' => FieldCode::TOO_MANY_ITEMS]);
            }
            $now = Time::toDb($this->clock->now());
            if ($type === 'SERVICE') {
                $jasa = $this->repository->jasa($refId) ?? throw ApiError::validation(['serviceId' => FieldCode::UNKNOWN_REFERENCE]);
                $item = ['type' => 'SERVICE', 'service_id' => $refId, 'part_id' => null, 'item_name' => $jasa->name,
                    'price' => $price ?? (int) $jasa->price, 'cost_price' => 0, 'quantity' => $quantity];
            } else {
                $part = $this->repository->part($refId, kunci: true) ?? throw ApiError::validation(['partId' => FieldCode::UNKNOWN_REFERENCE]);
                if (! (bool) $part->is_active) {
                    throw ApiError::validation(['partId' => FieldCode::INACTIVE_REFERENCE]);
                }
                if ((int) $part->stock < $quantity) {
                    throw PesanStokKurang::galat($part->name, $quantity, $part->unit, (int) $part->stock);
                }
                $item = ['type' => 'PART', 'service_id' => null, 'part_id' => $refId, 'item_name' => $part->name,
                    'price' => (int) $part->price, 'cost_price' => (int) $part->cost_price, 'quantity' => $quantity];
                $this->repository->geserStok($refId, -$quantity, $dasar->id, $sesi->staffId, $now);
            }
            $this->repository->simpanItem($dasar->id, Uuid::new(), $item, $sesi->staffId, $now);
            $this->repository->hitungUlangTotal($dasar->id, $now);
        });

        return $this->servis->detail($dasar->id);
    }

    /**
     * DELETE /api/work-orders/{number}/items/{itemId}: 404 item → 409
     * work_order_locked → 409 total_below_paid. Urutan kunci baris SPK →
     * baris sparepart. Stok part kembali sebesar jumlah item itu (juga bila
     * sparepart sudah nonaktif) dengan kartu RETURNED.
     *
     * @return array<string, mixed> SpkDetail
     */
    public function hapusItem(SesiStaf $sesi, DasarSpk $dasar, string $itemId): array
    {
        $this->cariItem($dasar, $itemId);
        $this->repository->transaction(function () use ($sesi, $dasar, $itemId): void {
            $spk = $this->servis->kunci($dasar->id);
            // Dibaca ulang di bawah kunci: kasir lain mungkin baru saja menghapusnya.
            $item = $this->cariItem($dasar, $itemId);
            AturanSpk::ubahData($spk->status);
            AturanSpk::hapusItem($spk->total(), (int) $item->subtotal, $spk->paidAmount);
            $now = Time::toDb($this->clock->now());
            if ($item->type === 'PART') {
                $this->repository->part($item->part_id, kunci: true);
                $this->repository->geserStok($item->part_id, (int) $item->quantity, $dasar->id, $sesi->staffId, $now);
            }
            $this->repository->hapusItem($itemId);
            $this->repository->hitungUlangTotal($dasar->id, $now);
        });

        return $this->servis->detail($dasar->id);
    }

    /** Item milik SPK ini; bentuk UUID yang salah, tak dikenal, milik SPK lain, atau sudah dihapus → 404. */
    private function cariItem(DasarSpk $dasar, string $itemId): object
    {
        $item = Uuid::valid($itemId) ? $this->repository->itemSpk($dasar->id, $itemId) : null;

        return $item ?? throw ApiError::notFound('Item SPK tidak ditemukan');
    }

    // --- Pembayaran -----------------------------------------------------------------

    /**
     * POST /api/work-orders/{number}/payments, sesudah 422 field: di bawah
     * kunci baris SPK, 409 work_order_cancelled / already_picked_up, lalu
     * jumlah di atas sisa tagihan → 422 amount out_of_range. Baris payments
     * dan paid_amount ditulis di transaksi yang sama, jadi pembayaran
     * bersamaan tidak pernah membuat paid_amount melebihi total. Tidak
     * mengubah status dan tidak mengirim WhatsApp.
     *
     * @return array<string, mixed> SpkDetail
     */
    public function bayar(SesiStaf $sesi, DasarSpk $dasar, int $amount, string $method): array
    {
        $this->repository->transaction(function () use ($sesi, $dasar, $amount, $method): void {
            $spk = $this->servis->kunci($dasar->id);
            AturanSpk::bayar($spk->status);
            if ($amount > $spk->sisa()) {
                throw ApiError::validation(['amount' => FieldCode::OUT_OF_RANGE]);
            }
            $this->repository->simpanPembayaran($dasar->id, $amount, $method, $sesi->staffId, Time::toDb($this->clock->now()));
        });

        return $this->servis->detail($dasar->id);
    }

    // --- WhatsApp kirim ulang -------------------------------------------------------

    /**
     * POST /api/work-orders/{number}/wa, sesudah 422: 409 sesuai status
     * saat ini, lalu pesan disusun dengan data saat ini dan dikirim (tanpa
     * transaksi; penyedia bisa menahan sampai 10 detik). Gagal → 503
     * wa_unavailable, tetapi baris failed tetap tercatat lebih dulu.
     *
     * @param  string|null  $phone  nomor tujuan khusus untuk pengiriman ini saja
     * @return array<string, mixed> SpkDetail
     */
    public function kirimUlangWa(DasarSpk $dasar, JenisPesan $jenis, ?string $phone): array
    {
        AturanSpk::kirimUlangWa($dasar->status, $jenis->value);
        [$tujuan, $isi] = $this->pesan->susun($jenis, $dasar->id, $phone);
        $hasil = $this->wa->kirim($jenis, $tujuan, $isi, $dasar->id);
        if (! $hasil->sent) {
            throw ApiError::waUnavailable();
        }

        return $this->servis->detail($dasar->id);
    }

    // --- Tautan lacak ---------------------------------------------------------------

    /**
     * POST /api/work-orders/{number}/tracking-link: token baru menggantikan
     * token lama di baris SPK yang dikunci, jadi tautan lama langsung mati.
     * Boleh di status apa pun; tidak menulis linimasa dan tidak mengirim
     * WhatsApp.
     *
     * @return array<string, mixed> SpkDetail
     */
    public function buatUlangTautan(DasarSpk $dasar): array
    {
        $this->repository->transaction(function () use ($dasar): void {
            $this->servis->kunci($dasar->id);
            [$token] = SecretToken::new();
            $this->repository->ubah($dasar->id, ['tracking_token' => $token], Time::toDb($this->clock->now()));
        });

        return $this->servis->detail($dasar->id);
    }
}
