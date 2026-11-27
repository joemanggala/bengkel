// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import { skemaHarga, skemaUuid, skemaWaktu } from './umum'

// Spec: spec/components/schemas/jasa.yaml. Jasa tidak pernah dihapus; yang tidak dipakai lagi
// dinonaktifkan. Jasa bertanda isPublic (dan aktif) tampil di website dan bisa dipilih saat booking.

// Perkiraan lama pengerjaan dalam menit (1..1440), atau null = tidak ditampilkan.
const skemaDurasi = z.number().int().min(1).max(1440).nullable()

export const skemaJasa = z.object({
    serviceId: skemaUuid,
    name: z.string(),
    description: z.string(),
    // Harga katalog; saat ditambahkan ke SPK boleh diganti harga lain.
    price: skemaHarga,
    durationMinutes: skemaDurasi,
    isPublic: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(100_000),
    createdAt: skemaWaktu,
    updatedAt: skemaWaktu,
})
export type Jasa = z.infer<typeof skemaJasa>

// Jasa seperti tampil di website (GET /api/public/services).
export const skemaJasaPublik = z.object({
    serviceId: skemaUuid,
    name: z.string(),
    description: z.string(),
    price: skemaHarga,
    durationMinutes: skemaDurasi,
})
export type JasaPublik = z.infer<typeof skemaJasaPublik>

export type BuatJasaRequest = {
    name: string
    price: number
    description?: string
    durationMinutes?: number | null
    isPublic?: boolean
    isActive?: boolean
    sortOrder?: number
}
// null pada durationMinutes = mengosongkan durasi.
export type UbahJasaRequest = Partial<{
    name: string
    price: number
    description: string
    durationMinutes: number | null
    isPublic: boolean
    isActive: boolean
    sortOrder: number
}>
