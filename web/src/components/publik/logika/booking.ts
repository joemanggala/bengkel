// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { BuatBookingRequest } from '@/skema/booking'
import type { JenisKendaraan } from '@/skema/pelanggan'
import { pangkas } from '@/skema/form/aturan'
import type { AturanField } from '@/utils/galat'
import { pesanKodeField } from '@/utils/galat'
import { tanggalSah } from '@/utils/kalender'
import { periksaNomorHp, periksaPlat, periksaTeks, saringGalat } from '@/utils/validasi'

// Aturan form booking publik dari spec (BuatBookingRequest). Teks bebas dari form publik tidak
// boleh memuat karakter kontrol, pemisah baris Unicode, atau pengatur arah teks, karena teks itu
// tampil di panel staf dan disalin ke SPK. Keluhan boleh berisi tab dan baris baru.

export type IsianBooking = {
    customerName: string
    phone: string
    vehicleType: JenisKendaraan | ''
    plate: string
    vehicleBrand: string
    vehicleModel: string
    serviceId: string
    visitDate: string
    complaint: string
}

export const isianBookingKosong = (): IsianBooking => ({
    customerName: '',
    phone: '',
    vehicleType: '',
    plate: '',
    vehicleBrand: '',
    vehicleModel: '',
    serviceId: '',
    visitDate: '',
    complaint: '',
})

export const ATURAN_BOOKING = {
    customerName: {
        label: 'Nama',
        min: 2,
        maks: 100,
        petunjukFormat: 'Tulis nama dalam satu baris.',
    },
    phone: {
        label: 'Nomor WhatsApp',
        petunjukFormat: 'Gunakan nomor Indonesia, mis. 0812-3456-7890.',
    },
    vehicleType: { label: 'Jenis kendaraan', pilihan: true },
    plate: { label: 'Plat nomor', maks: 12, petunjukFormat: 'Contoh: B 1234 XYZ.' },
    vehicleBrand: { label: 'Merek', maks: 50, petunjukFormat: 'Tulis dalam satu baris.' },
    vehicleModel: { label: 'Tipe', maks: 50, petunjukFormat: 'Tulis dalam satu baris.' },
    serviceId: { label: 'Jasa', pilihan: true },
    visitDate: { label: 'Tanggal datang', pilihan: true },
    complaint: {
        label: 'Keluhan',
        maks: 1000,
        petunjukFormat: 'Hapus karakter khusus yang tidak terlihat.',
    },
} satisfies Record<keyof IsianBooking, AturanField>

// Karakter kontrol C0/C1, U+2028/U+2029, dan pengatur arah teks (spec: "Teks").
const KONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/
// Sama, tetapi tab, LF, dan CR diizinkan (keluhan).
const KONTROL_KELUHAN =
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/

const teksPublik = (
    nilai: string,
    aturan: AturanField & { min?: number; maks?: number },
    pola: RegExp,
    opsional = false,
): string | null => {
    const galat = periksaTeks(nilai, { ...aturan, opsional })
    if (galat) return galat
    return pola.test(pangkas(nilai)) ? pesanKodeField('invalid_format', aturan) : null
}

export type HasilPeriksaBooking =
    { ok: true; badan: BuatBookingRequest } | { ok: false; fields: Record<string, string> }

// `rentang` = tanggal datang yang sah menurut WIB hari ini (rentangTanggalBooking).
export function periksaBooking(
    isian: IsianBooking,
    rentang: { awal: string; akhir: string },
): HasilPeriksaBooking {
    const a = ATURAN_BOOKING
    let galatTanggal: string | null = null
    if (isian.visitDate === '') galatTanggal = pesanKodeField('required', a.visitDate)
    else if (!tanggalSah(isian.visitDate))
        galatTanggal = pesanKodeField('invalid_format', a.visitDate)
    else if (isian.visitDate < rentang.awal || isian.visitDate > rentang.akhir) {
        galatTanggal = 'Tanggal datang bisa hari ini sampai 30 hari ke depan.'
    }
    const fields = saringGalat({
        customerName: teksPublik(isian.customerName, a.customerName, KONTROL),
        phone: periksaNomorHp(isian.phone, a.phone),
        vehicleType: isian.vehicleType === '' ? pesanKodeField('required', a.vehicleType) : null,
        plate: periksaPlat(isian.plate, a.plate),
        vehicleBrand: teksPublik(isian.vehicleBrand, a.vehicleBrand, KONTROL),
        vehicleModel: teksPublik(isian.vehicleModel, a.vehicleModel, KONTROL, true),
        visitDate: galatTanggal,
        complaint: teksPublik(isian.complaint, a.complaint, KONTROL_KELUHAN),
    })
    if (Object.keys(fields).length > 0 || isian.vehicleType === '') return { ok: false, fields }
    // Teks dikirim seperti diketik (dipangkas); nomor HP dan plat dinormalkan backend.
    return {
        ok: true,
        badan: {
            customerName: pangkas(isian.customerName),
            phone: isian.phone,
            vehicleType: isian.vehicleType,
            plate: isian.plate,
            vehicleBrand: pangkas(isian.vehicleBrand),
            vehicleModel: pangkas(isian.vehicleModel),
            serviceId: isian.serviceId === '' ? null : isian.serviceId,
            visitDate: isian.visitDate,
            complaint: pangkas(isian.complaint),
        },
    }
}

// Urutan kolom di layar, untuk memindahkan fokus ke galat pertama.
export const URUTAN_KOLOM_BOOKING: readonly (keyof IsianBooking)[] = [
    'customerName',
    'phone',
    'vehicleType',
    'plate',
    'vehicleBrand',
    'vehicleModel',
    'serviceId',
    'visitDate',
    'complaint',
]
