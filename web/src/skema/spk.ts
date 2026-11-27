// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import { skemaOutlet } from './outlet'
import {
    skemaKendaraanPublik,
    skemaKendaraanRingkas,
    skemaKendaraanSpk,
    skemaPelangganRingkas,
} from './pelanggan'
import { skemaStafRingkas } from './staf'
import {
    skemaHarga,
    skemaNomorBooking,
    skemaNomorHpSamaran,
    skemaNomorSpk,
    skemaRupiah,
    skemaToken,
    skemaUuid,
    skemaWaktu,
    type Label,
} from './umum'

// Spec: spec/components/schemas/spk.yaml. SPK (surat perintah kerja) servis: status, item jasa
// dan sparepart, pembayaran, linimasa, dan status pesan WhatsApp.

export const STATUS_SPK = [
    'QUEUED',
    'IN_PROGRESS',
    'WAITING_PARTS',
    'DONE',
    'PICKED_UP',
    'CANCELLED',
] as const
export const skemaStatusSpk = z.enum(STATUS_SPK)
export type StatusSpk = z.infer<typeof skemaStatusSpk>

export const LABEL_STATUS_SPK: Label<StatusSpk> = {
    QUEUED: 'Antre',
    IN_PROGRESS: 'Dikerjakan',
    WAITING_PARTS: 'Menunggu part',
    DONE: 'Selesai',
    PICKED_UP: 'Diambil',
    CANCELLED: 'Dibatalkan',
}

// Turunan dari paidAmount dan total (tidak disimpan): paid bila paidAmount = total (termasuk SPK
// bertotal 0), partial bila paidAmount > 0, selain itu unpaid.
export const STATUS_BAYAR = ['unpaid', 'partial', 'paid'] as const
export const skemaStatusBayar = z.enum(STATUS_BAYAR)
export type StatusBayar = z.infer<typeof skemaStatusBayar>

export const LABEL_STATUS_BAYAR: Label<StatusBayar> = {
    unpaid: 'Belum bayar',
    partial: 'Bayar sebagian',
    paid: 'Lunas',
}

export const METODE_BAYAR = ['cash', 'transfer', 'qris'] as const
export const skemaMetodeBayar = z.enum(METODE_BAYAR)
export type MetodeBayar = z.infer<typeof skemaMetodeBayar>

export const LABEL_METODE_BAYAR: Label<MetodeBayar> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
}

export const JENIS_ITEM = ['SERVICE', 'PART'] as const
export const skemaJenisItem = z.enum(JENIS_ITEM)
export type JenisItem = z.infer<typeof skemaJenisItem>

export const LABEL_JENIS_ITEM: Label<JenisItem> = {
    SERVICE: 'Jasa',
    PART: 'Sparepart',
}

export const JENIS_PESAN_WA_SPK = ['work_order_created', 'work_order_done', 'receipt'] as const
export const skemaJenisPesanWaSpk = z.enum(JENIS_PESAN_WA_SPK)
export type JenisPesanWaSpk = z.infer<typeof skemaJenisPesanWaSpk>

export const LABEL_JENIS_PESAN_WA_SPK: Label<JenisPesanWaSpk> = {
    work_order_created: 'SPK dibuat (tautan lacak)',
    work_order_done: 'Siap diambil',
    receipt: 'Nota',
}

// Batas item SPK: jumlah 1..99 per baris, paling banyak 50 baris.
export const MAKS_JUMLAH_ITEM = 99
export const MAKS_BARIS_ITEM = 50

const skemaJumlahItem = z.number().int().min(1).max(MAKS_JUMLAH_ITEM)
const skemaOdometer = z.number().int().min(0).max(9_999_999)

// Salinan jasa atau sparepart saat ditambahkan. Harga beli part ikut disalin di database, tetapi
// tidak pernah ada di respons SPK untuk siapa pun.
export const skemaItemSpk = z.object({
    itemId: skemaUuid,
    type: skemaJenisItem,
    serviceId: skemaUuid.nullable(),
    partId: skemaUuid.nullable(),
    name: z.string(),
    price: skemaHarga,
    quantity: skemaJumlahItem,
    subtotal: skemaRupiah,
    createdAt: skemaWaktu,
})
export type ItemSpk = z.infer<typeof skemaItemSpk>

export const skemaItemSpkPublik = z.object({
    type: skemaJenisItem,
    name: z.string(),
    price: skemaHarga,
    quantity: skemaJumlahItem,
    subtotal: skemaRupiah,
})
export type ItemSpkPublik = z.infer<typeof skemaItemSpkPublik>

export const skemaPembayaran = z.object({
    paymentId: skemaUuid,
    amount: z.number().int().min(1),
    method: skemaMetodeBayar,
    recordedBy: skemaStafRingkas,
    createdAt: skemaWaktu,
})
export type Pembayaran = z.infer<typeof skemaPembayaran>

// Satu perpindahan status; baris pertama null -> QUEUED ditulis saat SPK dibuat.
export const skemaLogStatus = z.object({
    fromStatus: skemaStatusSpk.nullable(),
    toStatus: skemaStatusSpk,
    by: skemaStafRingkas,
    // Catatan staf (untuk CANCELLED berisi alasan batal). Tidak tampil di halaman publik.
    note: z.string(),
    createdAt: skemaWaktu,
})
export type LogStatus = z.infer<typeof skemaLogStatus>

// Linimasa di halaman lacak: tanpa catatan dan nama staf.
export const skemaLogStatusPublik = z.object({
    fromStatus: skemaStatusSpk.nullable(),
    toStatus: skemaStatusSpk,
    createdAt: skemaWaktu,
})
export type LogStatusPublik = z.infer<typeof skemaLogStatusPublik>

// Hasil percobaan kirim terakhir untuk satu jenis pesan.
export const skemaStatusWa = z.object({
    status: z.enum(['sent', 'failed']),
    createdAt: skemaWaktu,
})
export type StatusWa = z.infer<typeof skemaStatusWa>

// Status pesan WhatsApp terakhir per jenis, atau null bila jenis itu belum pernah dicoba.
export const skemaRingkasanWa = z.object({
    workOrderCreated: skemaStatusWa.nullable(),
    workOrderDone: skemaStatusWa.nullable(),
    receipt: skemaStatusWa.nullable(),
})
export type RingkasanWa = z.infer<typeof skemaRingkasanWa>

export const skemaBookingRingkas = z.object({ bookingId: skemaUuid, number: skemaNomorBooking })
export type BookingRingkas = z.infer<typeof skemaBookingRingkas>

// Satu baris di papan servis dan riwayat servis kendaraan.
export const skemaSpkRingkas = z.object({
    number: skemaNomorSpk,
    status: skemaStatusSpk,
    paymentStatus: skemaStatusBayar,
    customer: skemaPelangganRingkas,
    vehicle: skemaKendaraanRingkas,
    // Mekanik yang ditugaskan, atau null. Mekanik nonaktif tetap ditampilkan.
    mechanic: skemaStafRingkas.nullable(),
    complaint: z.string(),
    // Jumlah baris item (bukan jumlah quantity).
    itemCount: z.number().int().min(0).max(MAKS_BARIS_ITEM),
    total: skemaRupiah,
    paidAmount: skemaRupiah,
    estimatedDoneAt: skemaWaktu.nullable(),
    createdAt: skemaWaktu,
    // Berubah setiap kali SPK berubah; dipakai untuk mendeteksi perubahan saat memuat berkala.
    updatedAt: skemaWaktu,
})
export type SpkRingkas = z.infer<typeof skemaSpkRingkas>

// SPK lengkap untuk staf, termasuk trackingToken halaman lacak /servis/{trackingToken}.
export const skemaSpkDetail = z.object({
    number: skemaNomorSpk,
    status: skemaStatusSpk,
    paymentStatus: skemaStatusBayar,
    customer: skemaPelangganRingkas,
    vehicle: skemaKendaraanSpk,
    // Booking asal bila SPK dibuat dari booking.
    booking: skemaBookingRingkas.nullable(),
    mechanic: skemaStafRingkas.nullable(),
    complaint: z.string(),
    // Diagnosis mekanik; tidak tampil di halaman publik.
    diagnosis: z.string(),
    odometer: skemaOdometer.nullable(),
    estimatedDoneAt: skemaWaktu.nullable(),
    serviceSubtotal: skemaRupiah,
    partSubtotal: skemaRupiah,
    total: skemaRupiah,
    paidAmount: skemaRupiah,
    remainingAmount: skemaRupiah,
    cancelReason: z.string().nullable(),
    trackingToken: skemaToken,
    createdBy: skemaStafRingkas,
    createdAt: skemaWaktu,
    updatedAt: skemaWaktu,
    items: z.array(skemaItemSpk).max(MAKS_BARIS_ITEM),
    payments: z.array(skemaPembayaran),
    timeline: z.array(skemaLogStatus).min(1),
    wa: skemaRingkasanWa,
})
export type SpkDetail = z.infer<typeof skemaSpkDetail>

// SPK di halaman lacak, sekaligus nota online: tanpa nama mekanik, diagnosis, data staf,
// pembayaran per baris, status WhatsApp, maupun token. Nomor HP disamarkan.
export const skemaSpkPublik = z.object({
    outlet: skemaOutlet,
    number: skemaNomorSpk,
    status: skemaStatusSpk,
    paymentStatus: skemaStatusBayar,
    customerName: z.string(),
    customerPhone: skemaNomorHpSamaran,
    vehicle: skemaKendaraanPublik,
    complaint: z.string(),
    estimatedDoneAt: skemaWaktu.nullable(),
    serviceSubtotal: skemaRupiah,
    partSubtotal: skemaRupiah,
    total: skemaRupiah,
    paidAmount: skemaRupiah,
    remainingAmount: skemaRupiah,
    // Alasan batal (terlihat pelanggan), atau null.
    cancelReason: z.string().nullable(),
    createdAt: skemaWaktu,
    items: z.array(skemaItemSpkPublik).max(MAKS_BARIS_ITEM),
    timeline: z.array(skemaLogStatusPublik).min(1),
})
export type SpkPublik = z.infer<typeof skemaSpkPublik>

// Badan permintaan. Waktu estimasi dalam RFC 3339 dengan zona (WaktuMasukan).
export type BuatSpkRequest = {
    vehicleId: string
    complaint: string
    odometer?: number | null
    estimatedDoneAt?: string | null
    mechanicId?: string | null
}
// Pemilik dan kasir boleh mengubah kelima field; mekanik hanya diagnosis (kunci lain -> 403).
export type UbahSpkRequest = Partial<{
    mechanicId: string | null
    complaint: string
    diagnosis: string
    odometer: number | null
    estimatedDoneAt: string | null
}>
// Status tujuan lewat rute status; pembatalan lewat rute cancel.
export type StatusTujuanSpk = Exclude<StatusSpk, 'QUEUED' | 'CANCELLED'>
export type UbahStatusSpkRequest = { status: StatusTujuanSpk; note?: string }
export type BatalSpkRequest = { reason: string }
// price hanya untuk SERVICE (harga lain untuk item ini); untuk PART selalu harga katalog.
export type TambahItemRequest =
    | { type: 'SERVICE'; serviceId: string; quantity: number; price?: number }
    | { type: 'PART'; partId: string; quantity: number }
export type BayarRequest = { amount: number; method: MetodeBayar }
// phone opsional: nomor tujuan hanya untuk pengiriman ini.
export type KirimWaRequest = { type: JenisPesanWaSpk; phone?: string | null }
