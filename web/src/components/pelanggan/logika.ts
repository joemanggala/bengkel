// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { pangkas } from '@/skema/form/aturan'
import type {
    BuatKendaraanRequest,
    BuatPelangganRequest,
    JenisKendaraan,
    Kendaraan,
    Pelanggan,
} from '@/skema/pelanggan'
import type { AturanField } from '@/utils/galat'
import { pesanKodeField } from '@/utils/galat'
import {
    periksaBilangan,
    periksaNomorHp,
    periksaPlat,
    periksaTeks,
    saringGalat,
} from '@/utils/validasi'

// Aturan form pelanggan dan kendaraan dari spec (pelanggan.yaml).

export type IsianPelanggan = { name: string; phone: string; address: string; notes: string }

export const ATURAN_PELANGGAN = {
    name: { label: 'Nama', min: 2, maks: 100 },
    phone: { label: 'Nomor HP', petunjukFormat: 'Gunakan nomor Indonesia, mis. 0812-3456-7890.' },
    address: { label: 'Alamat', maks: 500 },
    notes: { label: 'Catatan', maks: 500 },
} satisfies Record<keyof IsianPelanggan, AturanField>

export const isianPelanggan = (p?: Pelanggan): IsianPelanggan => ({
    name: p?.name ?? '',
    phone: p?.phone ?? '',
    address: p?.address ?? '',
    notes: p?.notes ?? '',
})

export function periksaPelanggan(
    isian: IsianPelanggan,
):
    | { ok: true; badan: Required<BuatPelangganRequest> }
    | { ok: false; fields: Record<string, string> } {
    const a = ATURAN_PELANGGAN
    const fields = saringGalat({
        name: periksaTeks(isian.name, a.name),
        phone: periksaNomorHp(isian.phone, a.phone),
        address: periksaTeks(isian.address, { ...a.address, opsional: true }),
        notes: periksaTeks(isian.notes, { ...a.notes, opsional: true }),
    })
    if (Object.keys(fields).length > 0) return { ok: false, fields }
    return {
        ok: true,
        badan: {
            name: pangkas(isian.name),
            phone: isian.phone,
            address: pangkas(isian.address),
            notes: pangkas(isian.notes),
        },
    }
}

export type IsianKendaraan = {
    type: JenisKendaraan | ''
    plate: string
    brand: string
    model: string
    year: string
    color: string
}

export const ATURAN_KENDARAAN = {
    type: { label: 'Jenis kendaraan', pilihan: true },
    plate: { label: 'Plat nomor', maks: 12, petunjukFormat: 'Contoh: B 1234 XYZ.' },
    brand: { label: 'Merek', maks: 50 },
    model: { label: 'Tipe', maks: 50 },
    year: { label: 'Tahun', min: 1900, maks: 2100, jenis: 'angka tahun' },
    color: { label: 'Warna', maks: 30 },
} satisfies Record<keyof IsianKendaraan, AturanField>

export const isianKendaraan = (k?: Kendaraan): IsianKendaraan => ({
    type: k?.type ?? '',
    plate: k?.plate ?? '',
    brand: k?.brand ?? '',
    model: k?.model ?? '',
    year: k?.year === null || k?.year === undefined ? '' : String(k.year),
    color: k?.color ?? '',
})

export function periksaKendaraan(
    isian: IsianKendaraan,
):
    | { ok: true; badan: Required<BuatKendaraanRequest> }
    | { ok: false; fields: Record<string, string> } {
    const a = ATURAN_KENDARAAN
    const tahun = periksaBilangan(isian.year, { ...a.year, min: 1900, maks: 2100, opsional: true })
    const fields = saringGalat({
        type: isian.type === '' ? pesanKodeField('required', a.type) : null,
        plate: periksaPlat(isian.plate, a.plate),
        brand: periksaTeks(isian.brand, { ...a.brand, min: 1 }),
        model: periksaTeks(isian.model, { ...a.model, opsional: true }),
        year: tahun.ok ? null : tahun.pesan,
        color: periksaTeks(isian.color, { ...a.color, opsional: true }),
    })
    if (Object.keys(fields).length > 0 || isian.type === '' || !tahun.ok)
        return { ok: false, fields }
    return {
        ok: true,
        badan: {
            type: isian.type,
            plate: isian.plate,
            brand: pangkas(isian.brand),
            model: pangkas(isian.model),
            year: tahun.nilai,
            color: pangkas(isian.color),
        },
    }
}
