// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import { skemaToken, skemaUuid, skemaWaktu, type Label } from './umum'

// Spec: spec/components/schemas/staf.yaml. Tiga peran: pemilik, kasir (admin bengkel), dan
// mekanik (hanya melihat dan mengerjakan SPK yang ditugaskan kepadanya).

export const PERAN_STAF = ['owner', 'cashier', 'mechanic'] as const
export const skemaPeranStaf = z.enum(PERAN_STAF)
export type PeranStaf = z.infer<typeof skemaPeranStaf>

// x-label PeranStaf.
export const LABEL_PERAN: Label<PeranStaf> = {
    owner: 'Pemilik',
    cashier: 'Kasir',
    mechanic: 'Mekanik',
}

export const skemaStaf = z.object({
    staffId: skemaUuid,
    name: z.string(),
    // Selalu ASCII huruf kecil.
    email: z.string(),
    role: skemaPeranStaf,
    isActive: z.boolean(),
    createdAt: skemaWaktu,
})
export type Staf = z.infer<typeof skemaStaf>

// Staf yang melakukan sesuatu (membuat SPK, mencatat pembayaran, mengubah status) atau mekanik
// yang ditugaskan. Juga bentuk baris GET /api/mechanics.
export const skemaStafRingkas = z.object({ staffId: skemaUuid, name: z.string() })
export type StafRingkas = z.infer<typeof skemaStafRingkas>

// Balasan setup dan masuk. Token hanya dibaca di server (server action), langsung disimpan ke
// cookie httpOnly, dan tidak pernah dikirim ke JavaScript browser.
export const skemaAuthStaf = z.object({ token: skemaToken, staff: skemaStaf })
export type AuthStaf = z.infer<typeof skemaAuthStaf>

export const skemaStatusSetup = z.object({ needsSetup: z.boolean() })
export type StatusSetup = z.infer<typeof skemaStatusSetup>

// Badan permintaan (SetupRequest, MasukStafRequest, BuatStafRequest, UbahStafRequest).
export type SetupRequest = { token: string; name: string; email: string; password: string }
export type MasukStafRequest = { email: string; password: string }
export type BuatStafRequest = { name: string; email: string; password: string; role: PeranStaf }
// Perubahan sebagian: field yang tidak dikirim tidak berubah.
export type UbahStafRequest = Partial<BuatStafRequest & { isActive: boolean }>
