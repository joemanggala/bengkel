// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import { skemaStafRingkas } from './staf'
import { skemaHarga, skemaNomorSpk, skemaUuid, skemaWaktu, type Label } from './umum'

// Spec: spec/components/schemas/sparepart.yaml. Stok selalu bilangan bulat dalam satuan jualnya,
// tidak pernah negatif, dan hanya berubah lewat kartu stok.

// Dihitung server dari stock dan minStock: out = 0, low = 1..minStock, ok = di atas minStock.
export const LEVEL_STOK = ['ok', 'low', 'out'] as const
export const skemaLevelStok = z.enum(LEVEL_STOK)
export type LevelStok = z.infer<typeof skemaLevelStok>

export const LABEL_LEVEL_STOK: Label<LevelStok> = {
    ok: 'Aman',
    low: 'Menipis',
    out: 'Habis',
}

// Batas jumlah stok di spec (JumlahStok, StokMinimum, initialStock): 100.000.000.
export const MAKS_JUMLAH_STOK = 100_000_000

const POLA_SKU = /^[A-Z0-9][A-Z0-9._/-]{0,39}$/
const skemaStok = z.number().int().min(0)
const skemaStokMinimum = z.number().int().min(0).max(MAKS_JUMLAH_STOK)

const dasarSparepart = {
    partId: skemaUuid,
    sku: z.string().regex(POLA_SKU),
    name: z.string(),
    unit: z.string(),
    // Harga jual per satuan; selalu dipakai apa adanya saat part ditambahkan ke SPK.
    price: skemaHarga,
    stock: skemaStok,
    minStock: skemaStokMinimum,
    stockLevel: skemaLevelStok,
    isActive: z.boolean(),
    createdAt: skemaWaktu,
    updatedAt: skemaWaktu,
}

// Untuk kasir dan mekanik: kunci costPrice TIDAK ADA sama sekali (bukan null, bukan 0). Skema
// ini sengaja strict supaya balasan kasir yang membocorkan harga beli dianggap melanggar kontrak.
export const skemaSparepartStaf = z.strictObject(dasarSparepart)
export type SparepartStaf = z.infer<typeof skemaSparepartStaf>

// Untuk pemilik: dengan harga beli (0 = belum diisi).
export const skemaSparepartPemilik = z.object({ ...dasarSparepart, costPrice: skemaHarga })
export type SparepartPemilik = z.infer<typeof skemaSparepartPemilik>

export type Sparepart = SparepartStaf | SparepartPemilik

// Harga beli hanya ada bila yang meminta pemilik.
export const punyaHargaBeli = (part: Sparepart): part is SparepartPemilik => 'costPrice' in part

// Daftar sparepart: satu respons tidak pernah mencampur bentuk pemilik dan bentuk kasir.
export const skemaDaftarSparepart = z.union([
    z.array(skemaSparepartPemilik),
    z.array(skemaSparepartStaf),
])

export const JENIS_PERGERAKAN = ['IN', 'OUT', 'COUNT', 'USED', 'RETURNED'] as const
export const skemaJenisPergerakan = z.enum(JENIS_PERGERAKAN)
export type JenisPergerakan = z.infer<typeof skemaJenisPergerakan>

export const LABEL_JENIS_PERGERAKAN: Label<JenisPergerakan> = {
    IN: 'Stok masuk',
    OUT: 'Stok keluar',
    COUNT: 'Hitung ulang',
    USED: 'Terpakai SPK',
    RETURNED: 'Dikembalikan dari SPK',
}

// Satu baris kartu stok. Tidak pernah diubah atau dihapus.
export const skemaPergerakanStok = z.object({
    movementId: skemaUuid,
    type: skemaJenisPergerakan,
    // Perubahan stok bertanda (negatif = berkurang).
    quantity: z.number().int(),
    stockAfter: skemaStok,
    note: z.string(),
    // Nomor SPK penyebabnya; hanya terisi untuk USED dan RETURNED.
    workOrderNumber: skemaNomorSpk.nullable(),
    staff: skemaStafRingkas,
    createdAt: skemaWaktu,
})
export type PergerakanStok = z.infer<typeof skemaPergerakanStok>

export type BuatSparepartRequest = {
    sku: string
    name: string
    unit: string
    price: number
    costPrice?: number
    minStock?: number
    initialStock?: number
}
// Stok tidak bisa diubah lewat sini, hanya lewat stock-in, stock-out, stock-count, dan item SPK.
export type UbahSparepartRequest = Partial<{
    sku: string
    name: string
    unit: string
    price: number
    costPrice: number
    minStock: number
    isActive: boolean
}>
export type StokMasukRequest = { quantity: number; costPrice?: number; note?: string }
export type StokKeluarRequest = { quantity: number; note: string }
export type HitungStokRequest = { countedStock: number; note: string }
