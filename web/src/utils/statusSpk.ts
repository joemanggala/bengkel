// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { KodeGalat } from '@/skema/galat'
import type { StatusBayar, StatusSpk, StatusTujuanSpk } from '@/skema/spk'
import type { PeranStaf } from '@/skema/staf'

// Aturan status SPK dari spec ("Status SPK"), untuk menentukan tombol
// mana yang tampil di layar. Backend tetap penentu akhirnya (409 bila tidak sah); aturan yang
// sama di web hanya mencegah staf menekan tombol yang pasti ditolak.
//
//   QUEUED -> IN_PROGRESS <-> WAITING_PARTS;  IN_PROGRESS -> DONE -> PICKED_UP
//   QUEUED, IN_PROGRESS, WAITING_PARTS -> CANCELLED (lewat rute cancel, bukan rute status)
//
// WAITING_PARTS tidak bisa langsung DONE: pekerjaan dilanjutkan dulu sesudah part datang.

export const TRANSISI_SPK: Readonly<Record<StatusSpk, readonly StatusTujuanSpk[]>> = {
    QUEUED: ['IN_PROGRESS'],
    IN_PROGRESS: ['WAITING_PARTS', 'DONE'],
    WAITING_PARTS: ['IN_PROGRESS'],
    DONE: ['PICKED_UP'],
    PICKED_UP: [],
    CANCELLED: [],
}

// Mekanik hanya boleh memindahkan SPK miliknya ke tiga status ini (PICKED_UP -> 403).
const TUJUAN_MEKANIK: readonly StatusTujuanSpk[] = ['IN_PROGRESS', 'WAITING_PARTS', 'DONE']

// Status selama SPK masih bisa diubah: item, data SPK (PATCH), dan pembatalan. Sejak DONE nilai
// SPK tetap, supaya rekap tanggal yang sudah lewat tidak berubah.
export const STATUS_TERBUKA: readonly StatusSpk[] = ['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS']

// scope=active di daftar SPK: masih di bengkel, termasuk DONE yang belum diambil.
export const STATUS_AKTIF: readonly StatusSpk[] = ['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE']

// Status tujuan yang sah dari `status` untuk peran itu, urut seperti di TRANSISI_SPK.
export const statusTujuanSpk = (status: StatusSpk, peran: PeranStaf): StatusTujuanSpk[] =>
    TRANSISI_SPK[status].filter((t) => peran !== 'mechanic' || TUJUAN_MEKANIK.includes(t))

export type KeadaanSpk = { status: StatusSpk; jumlahItem: number; sisa: number }

// Kode galat yang PASTI dibalas backend untuk perpindahan ini, atau null bila sah. Dipakai untuk
// menonaktifkan tombol dengan penjelasan (mis. "Tambahkan item dulu"), bukan menunggu 409.
export function cekTransisiSpk(spk: KeadaanSpk, tujuan: StatusTujuanSpk): KodeGalat | null {
    if (!TRANSISI_SPK[spk.status].includes(tujuan)) return 'status_transition_invalid'
    if (tujuan === 'DONE' && spk.jumlahItem === 0) return 'work_order_empty'
    if (tujuan === 'PICKED_UP' && spk.sisa > 0) return 'not_paid_off'
    return null
}

export const spkTerbuka = (status: StatusSpk): boolean => STATUS_TERBUKA.includes(status)

// Pembatalan: hanya pemilik dan kasir, hanya selama SPK terbuka, dan hanya bila belum ada
// pembayaran sama sekali (tidak ada void atau refund).
export function cekBatalSpk(
    spk: { status: StatusSpk; paidAmount: number },
    peran: PeranStaf,
): KodeGalat | null {
    if (peran === 'mechanic') return 'forbidden'
    if (!spkTerbuka(spk.status)) return 'status_transition_invalid'
    if (spk.paidAmount > 0) return 'has_payments'
    return null
}

// Pembayaran boleh sejak SPK dibuat (uang muka), selama SPK tidak batal atau sudah diambil, dan
// masih ada sisa tagihan.
export function cekBayarSpk(spk: { status: StatusSpk; sisa: number }): KodeGalat | null {
    if (spk.status === 'CANCELLED') return 'work_order_cancelled'
    if (spk.status === 'PICKED_UP') return 'already_picked_up'
    if (spk.sisa <= 0) return 'validation_failed'
    return null
}

// Status bayar turunan, rumus yang sama dengan backend: lunas bila terbayar = total (termasuk SPK
// bertotal 0: tidak ada yang perlu dibayar), sebagian bila sudah ada pembayaran, selain itu belum bayar.
export const statusBayar = (total: number, terbayar: number): StatusBayar => {
    if (terbayar === total) return 'paid'
    return terbayar > 0 ? 'partial' : 'unpaid'
}

// Sisa tagihan, tidak pernah negatif.
export const sisaTagihan = (total: number, terbayar: number): number =>
    Math.max(0, total - terbayar)

// Uang kembalian hanya dihitung di layar kasir: uang diterima dikurangi jumlah yang dicatat.
// null bila uangnya kurang.
export const kembalian = (diterima: number, dibayar: number): number | null =>
    diterima >= dibayar ? diterima - dibayar : null
