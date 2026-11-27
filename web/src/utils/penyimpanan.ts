// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { POLA_NOMOR_BOOKING, POLA_TOKEN } from '@/skema/umum'

// Tautan booking yang pernah dibuat dari browser ini. bookingToken hanya dikirim backend SEKALI
// (database hanya menyimpan hash-nya), jadi selain di alamat halaman, token disimpan juga di
// penyimpanan lokal supaya pelanggan bisa membuka booking-nya lagi dari halaman depan.
//
// Penyimpanan lokal bisa diblokir (mode privat, setelan browser) atau penuh; setiap akses
// dibungkus try/catch dan kegagalannya diabaikan: booking tetap tercatat di server, hanya daftar
// "booking kamu" yang tidak muncul.

export const KUNCI_BOOKING = 'bengkel-booking'

// Cukup beberapa yang terakhir; booking lama sudah selesai dan hanya memenuhi layar.
export const MAKS_BOOKING_TERSIMPAN = 5

export type BookingTersimpan = { token: string; nomor: string; dibuat: string }

type Penyimpanan = Pick<Storage, 'getItem' | 'setItem'>

const penyimpananBawaan = (): Penyimpanan | null => {
    try {
        return typeof window === 'undefined' ? null : window.localStorage
    } catch {
        return null
    }
}

const sah = (b: unknown): b is BookingTersimpan => {
    if (typeof b !== 'object' || b === null) return false
    const x = b as Record<string, unknown>
    return (
        typeof x.token === 'string' &&
        POLA_TOKEN.test(x.token) &&
        typeof x.nomor === 'string' &&
        POLA_NOMOR_BOOKING.test(x.nomor) &&
        typeof x.dibuat === 'string'
    )
}

// Isi yang rusak atau diubah tangan dibuang diam-diam, bukan membuat halaman galat.
export function bacaBookingTersimpan(
    simpan: Penyimpanan | null = penyimpananBawaan(),
): BookingTersimpan[] {
    try {
        const isi: unknown = JSON.parse(simpan?.getItem(KUNCI_BOOKING) ?? '[]')
        return Array.isArray(isi) ? isi.filter(sah).slice(0, MAKS_BOOKING_TERSIMPAN) : []
    } catch {
        return []
    }
}

// Booking terbaru di depan; token yang sama tidak dicatat dua kali.
export function simpanBooking(
    booking: BookingTersimpan,
    simpan: Penyimpanan | null = penyimpananBawaan(),
): void {
    if (!sah(booking)) return
    const lain = bacaBookingTersimpan(simpan).filter((b) => b.token !== booking.token)
    try {
        simpan?.setItem(
            KUNCI_BOOKING,
            JSON.stringify([booking, ...lain].slice(0, MAKS_BOOKING_TERSIMPAN)),
        )
    } catch {
        // Diblokir atau penuh: lihat penjelasan di atas.
    }
}
