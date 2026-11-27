// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import { skemaJenisKendaraan, type JenisKendaraan } from './pelanggan'
import { skemaSpkDetail, skemaStatusWa } from './spk'
import { skemaStafRingkas } from './staf'
import {
    skemaNomorBooking,
    skemaNomorHp,
    skemaNomorHpSamaran,
    skemaNomorSpk,
    skemaPlatKunci,
    skemaPlatTampilan,
    skemaTanggal,
    skemaToken,
    skemaUuid,
    skemaWaktu,
    type Label,
} from './umum'

// Spec: spec/components/schemas/booking.yaml. Booking dari website mulai PENDING dan harus
// diterima staf. Data pemesan dan kendaraan adalah salinan isian form publik.

export const STATUS_BOOKING = [
    'PENDING',
    'CONFIRMED',
    'CONVERTED',
    'REJECTED',
    'CANCELLED',
] as const
export const skemaStatusBooking = z.enum(STATUS_BOOKING)
export type StatusBooking = z.infer<typeof skemaStatusBooking>

export const LABEL_STATUS_BOOKING: Label<StatusBooking> = {
    PENDING: 'Menunggu',
    CONFIRMED: 'Dikonfirmasi',
    CONVERTED: 'Jadi SPK',
    REJECTED: 'Ditolak',
    CANCELLED: 'Dibatalkan',
}

// Jasa yang dipilih saat booking; name adalah salinan nama saat booking dibuat.
export const skemaJasaRingkas = z.object({ serviceId: skemaUuid, name: z.string() })
export type JasaRingkas = z.infer<typeof skemaJasaRingkas>

// Status pesan WhatsApp booking terakhir per jenis. Tidak ada rute kirim ulang: bila gagal, staf
// menghubungi pelanggan sendiri.
export const skemaRingkasanWaBooking = z.object({
    bookingConfirmed: skemaStatusWa.nullable(),
    bookingRejected: skemaStatusWa.nullable(),
})
export type RingkasanWaBooking = z.infer<typeof skemaRingkasanWaBooking>

// Booking seperti dilihat pemilik dan kasir.
export const skemaBooking = z.object({
    bookingId: skemaUuid,
    number: skemaNomorBooking,
    status: skemaStatusBooking,
    customerName: z.string(),
    phone: skemaNomorHp,
    vehicleType: skemaJenisKendaraan,
    plate: skemaPlatTampilan,
    plateKey: skemaPlatKunci,
    vehicleBrand: z.string(),
    vehicleModel: z.string(),
    service: skemaJasaRingkas.nullable(),
    // Tanggal datang (WIB) YYYY-MM-DD.
    visitDate: skemaTanggal,
    complaint: z.string(),
    rejectReason: z.string().nullable(),
    workOrderNumber: skemaNomorSpk.nullable(),
    // Staf yang terakhir mengonfirmasi, menolak, atau menjadikan SPK.
    handledBy: skemaStafRingkas.nullable(),
    wa: skemaRingkasanWaBooking,
    createdAt: skemaWaktu,
    updatedAt: skemaWaktu,
})
export type Booking = z.infer<typeof skemaBooking>

// Booking seperti dilihat pelanggan pemegang bookingToken: tanpa ID, tanpa data staf, tanpa
// status WhatsApp, dan nomor HP disamarkan. Satu-satunya teks staf yang tampil: rejectReason.
export const skemaBookingPublik = z.object({
    number: skemaNomorBooking,
    status: skemaStatusBooking,
    customerName: z.string(),
    phone: skemaNomorHpSamaran,
    vehicleType: skemaJenisKendaraan,
    plate: skemaPlatTampilan,
    vehicleBrand: z.string(),
    vehicleModel: z.string(),
    serviceName: z.string().nullable(),
    visitDate: skemaTanggal,
    complaint: z.string(),
    rejectReason: z.string().nullable(),
    workOrderNumber: skemaNomorSpk.nullable(),
    createdAt: skemaWaktu,
})
export type BookingPublik = z.infer<typeof skemaBookingPublik>

// Balasan pembuatan booking. bookingToken hanya dikirim sekali di sini (database hanya
// menyimpan hash-nya); web menyimpannya di alamat halaman dan penyimpanan lokal browser.
export const skemaBookingDibuat = z.object({
    bookingToken: skemaToken,
    booking: skemaBookingPublik,
})
export type BookingDibuat = z.infer<typeof skemaBookingDibuat>

// Hasil konversi booking menjadi SPK.
export const skemaHasilJadikanSpk = z.object({
    booking: skemaBooking,
    workOrder: skemaSpkDetail,
})
export type HasilJadikanSpk = z.infer<typeof skemaHasilJadikanSpk>

// Badan permintaan.
export type BuatBookingRequest = {
    customerName: string
    phone: string
    vehicleType: JenisKendaraan
    plate: string
    vehicleBrand: string
    vehicleModel?: string
    serviceId?: string | null
    visitDate: string
    complaint: string
}
export type TolakBookingRequest = { reason: string }
export type JadikanSpkRequest = {
    mechanicId?: string | null
    odometer?: number | null
    estimatedDoneAt?: string | null
}
