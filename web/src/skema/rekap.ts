// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import { skemaStafRingkas } from './staf'
import { skemaRupiah, skemaTanggal, skemaUuid } from './umum'

// Spec: spec/components/schemas/rekap.yaml. Rekap satu tanggal WIB (khusus pemilik). Nilai,
// modal, laba, dan terlaris dihitung dari SPK yang DONE pada tanggal itu (keputusan 0a-9).

export const skemaJasaTerlaris = z.object({
    serviceId: skemaUuid,
    // Nama jasa saat ini, bukan salinan di item.
    name: z.string(),
    quantity: z.number().int().min(1),
    revenue: skemaRupiah,
})
export type JasaTerlaris = z.infer<typeof skemaJasaTerlaris>

export const skemaPartTerlaris = z.object({
    partId: skemaUuid,
    name: z.string(),
    quantity: z.number().int().min(1),
    revenue: skemaRupiah,
    cost: skemaRupiah,
    // Negatif bila modalnya lebih besar.
    profit: z.number().int(),
})
export type PartTerlaris = z.infer<typeof skemaPartTerlaris>

export const skemaSelesaiPerMekanik = z.object({
    // null = SPK selesai tanpa mekanik (selalu baris terakhir).
    mechanic: skemaStafRingkas.nullable(),
    doneCount: z.number().int().min(1),
})
export type SelesaiPerMekanik = z.infer<typeof skemaSelesaiPerMekanik>

export const skemaRekapHarian = z.object({
    date: skemaTanggal,
    workOrderCount: z.number().int().min(0),
    doneCount: z.number().int().min(0),
    pickedUpCount: z.number().int().min(0),
    cancelledCount: z.number().int().min(0),
    serviceTotal: skemaRupiah,
    partTotal: skemaRupiah,
    salesTotal: skemaRupiah,
    partCostTotal: skemaRupiah,
    grossProfit: z.number().int(),
    // Lebih dari 0 -> tampilkan catatan "Harga beli belum lengkap".
    partItemsWithoutCost: z.number().int().min(0),
    paymentTotal: skemaRupiah,
    paymentsByMethod: z.object({ cash: skemaRupiah, transfer: skemaRupiah, qris: skemaRupiah }),
    topServices: z.array(skemaJasaTerlaris).max(5),
    topParts: z.array(skemaPartTerlaris).max(5),
    doneByMechanic: z.array(skemaSelesaiPerMekanik),
})
export type RekapHarian = z.infer<typeof skemaRekapHarian>
