// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import {
    skemaNomorHp,
    skemaPlatKunci,
    skemaPlatTampilan,
    skemaUuid,
    skemaWaktu,
    type Label,
} from './umum'

// Spec: spec/components/schemas/pelanggan.yaml. Pelanggan dan kendaraannya; satu plat hanya milik
// satu kendaraan, dan satu kendaraan hanya milik satu pelanggan.

export const JENIS_KENDARAAN = ['MOTOR', 'CAR'] as const
export const skemaJenisKendaraan = z.enum(JENIS_KENDARAAN)
export type JenisKendaraan = z.infer<typeof skemaJenisKendaraan>

// x-label JenisKendaraan.
export const LABEL_JENIS_KENDARAAN: Label<JenisKendaraan> = {
    MOTOR: 'Motor',
    CAR: 'Mobil',
}

const skemaTahun = z.number().int().min(1900).max(2100).nullable()

export const skemaKendaraan = z.object({
    vehicleId: skemaUuid,
    customerId: skemaUuid,
    type: skemaJenisKendaraan,
    plate: skemaPlatTampilan,
    plateKey: skemaPlatKunci,
    brand: z.string(),
    model: z.string(),
    year: skemaTahun,
    color: z.string(),
    createdAt: skemaWaktu,
    updatedAt: skemaWaktu,
})
export type Kendaraan = z.infer<typeof skemaKendaraan>

// Kendaraan di daftar SPK dan riwayat servis.
export const skemaKendaraanRingkas = z.object({
    vehicleId: skemaUuid,
    type: skemaJenisKendaraan,
    plate: skemaPlatTampilan,
    brand: z.string(),
    model: z.string(),
})
export type KendaraanRingkas = z.infer<typeof skemaKendaraanRingkas>

// Kendaraan di rincian SPK: data kendaraan saat ini, bukan salinan.
export const skemaKendaraanSpk = skemaKendaraanRingkas.extend({
    year: skemaTahun,
    color: z.string(),
})
export type KendaraanSpk = z.infer<typeof skemaKendaraanSpk>

// Kendaraan di halaman lacak servis, tanpa ID.
export const skemaKendaraanPublik = z.object({
    type: skemaJenisKendaraan,
    plate: skemaPlatTampilan,
    brand: z.string(),
    model: z.string(),
})
export type KendaraanPublik = z.infer<typeof skemaKendaraanPublik>

export const skemaPelanggan = z.object({
    customerId: skemaUuid,
    name: z.string(),
    phone: skemaNomorHp,
    address: z.string(),
    // Catatan internal kasir; tidak pernah tampil di halaman publik.
    notes: z.string(),
    vehicles: z.array(skemaKendaraan),
    createdAt: skemaWaktu,
    updatedAt: skemaWaktu,
})
export type Pelanggan = z.infer<typeof skemaPelanggan>

export const skemaPelangganRingkas = z.object({
    customerId: skemaUuid,
    name: z.string(),
    phone: skemaNomorHp,
})
export type PelangganRingkas = z.infer<typeof skemaPelangganRingkas>

// Hasil pencarian plat: kendaraan beserta pemiliknya.
export const skemaKendaraanDenganPemilik = z.object({
    vehicle: skemaKendaraan,
    customer: skemaPelangganRingkas,
})
export type KendaraanDenganPemilik = z.infer<typeof skemaKendaraanDenganPemilik>

// Badan permintaan. Nomor HP dan plat dikirim seperti diketik; backend yang menormalkan.
export type BuatPelangganRequest = {
    name: string
    phone: string
    address?: string
    notes?: string
}
export type UbahPelangganRequest = Partial<Required<BuatPelangganRequest>>

export type BuatKendaraanRequest = {
    type: JenisKendaraan
    plate: string
    brand: string
    model?: string
    year?: number | null
    color?: string
}
// null pada year = mengosongkan tahun. Pemilik kendaraan tidak bisa diganti.
export type UbahKendaraanRequest = Partial<{
    type: JenisKendaraan
    plate: string
    brand: string
    model: string
    year: number | null
    color: string
}>
