<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Servis;

/**
 * Status SPK (StatusSpk di spec). Nilainya sama dengan kolom
 * work_orders.status dan field status di JSON.
 *
 *   QUEUED → IN_PROGRESS ⇄ WAITING_PARTS;  IN_PROGRESS → DONE → PICKED_UP
 *   QUEUED, IN_PROGRESS, WAITING_PARTS → CANCELLED (lewat rute /cancel)
 *
 * Status tidak sekadar maju satu langkah: di bengkel pekerjaan sering
 * berhenti menunggu part lalu dilanjutkan lagi, jadi Dikerjakan dan Menunggu
 * part boleh bolak-balik (keputusan rancangan nomor 6). Aturan yang sama dijaga CHECK work_order_status_logs_transisi_sah
 * di database.
 */
enum StatusSpk: string
{
    case Antre = 'QUEUED';

    case Dikerjakan = 'IN_PROGRESS';

    case MenungguPart = 'WAITING_PARTS';

    /** Siap diambil; pesan WhatsApp work_order_done dikirim saat masuk status ini. */
    case Selesai = 'DONE';

    /** Kendaraan diserahkan; hanya bila lunas. */
    case Diambil = 'PICKED_UP';

    case Dibatalkan = 'CANCELLED';

    /** Label Indonesia (x-label StatusSpk), juga dipakai di nota WhatsApp. */
    public function label(): string
    {
        return match ($this) {
            self::Antre => 'Antre',
            self::Dikerjakan => 'Dikerjakan',
            self::MenungguPart => 'Menunggu part',
            self::Selesai => 'Selesai',
            self::Diambil => 'Diambil',
            self::Dibatalkan => 'Dibatalkan',
        };
    }

    /**
     * Perpindahan lewat rute POST /api/work-orders/{number}/status. Hanya
     * lima yang sah; selain itu (termasuk ke status yang sama, dari status
     * akhir, WAITING_PARTS langsung ke DONE, dan menuju CANCELLED) ditolak.
     * Menuju CANCELLED sengaja tidak lewat sini: pembatalan punya rute sendiri
     * dengan syarat alasan dan tanpa pembayaran.
     */
    public function bolehKe(self $tujuan): bool
    {
        return match ($this) {
            self::Antre => $tujuan === self::Dikerjakan,
            self::Dikerjakan => $tujuan === self::MenungguPart || $tujuan === self::Selesai,
            self::MenungguPart => $tujuan === self::Dikerjakan,
            self::Selesai => $tujuan === self::Diambil,
            self::Diambil, self::Dibatalkan => false,
        };
    }

    /**
     * SPK yang masih dikerjakan bengkel: item boleh ditambah atau dihapus dan
     * datanya boleh diubah (PATCH). Sejak DONE nilai SPK dan mekaniknya
     * tetap, jadi rekap hari yang sudah lewat tidak pernah berubah
     * (keputusan 0a-5). Selain status ini → 409 work_order_locked.
     */
    public function terbuka(): bool
    {
        return $this === self::Antre || $this === self::Dikerjakan || $this === self::MenungguPart;
    }

    /** Pembatalan hanya dari status terbuka; DONE, PICKED_UP, dan CANCELLED → status_transition_invalid. */
    public function bolehDibatalkan(): bool
    {
        return $this->terbuka();
    }

    /**
     * Status tujuan yang boleh ditulis di badan rute ubah status
     * (UbahStatusSpkRequest); QUEUED dan CANCELLED → 422 invalid_format.
     *
     * @return list<string>
     */
    public static function tujuanRuteStatus(): array
    {
        return [self::Dikerjakan->value, self::MenungguPart->value, self::Selesai->value, self::Diambil->value];
    }

    /**
     * Status yang boleh dituju mekanik untuk SPK miliknya. PICKED_UP
     * (menyerahkan kendaraan, terkait uang) hanya pemilik dan kasir.
     */
    public function bolehDitujuMekanik(): bool
    {
        return $this === self::Dikerjakan || $this === self::MenungguPart || $this === self::Selesai;
    }

    /**
     * Status untuk filter ?scope= (LingkupSpk): `active` = masih di bengkel
     * (termasuk DONE yang belum diambil), `history` = PICKED_UP dan
     * CANCELLED. Null bila nilainya bukan salah satu dari keduanya.
     *
     * @return list<self>|null
     */
    public static function untukLingkup(string $scope): ?array
    {
        return match ($scope) {
            'active' => [self::Antre, self::Dikerjakan, self::MenungguPart, self::Selesai],
            'history' => [self::Diambil, self::Dibatalkan],
            default => null,
        };
    }
}
