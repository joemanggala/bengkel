// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { MAKS_HARI_BOOKING } from './statusBooking'

// Tanggal WIB (UTC+7 tetap, tanpa musim panas) dihitung dengan menggeser jam, bukan lewat zona
// waktu browser, supaya HP pelanggan yang zonanya salah pun mendapat batas tanggal yang sama
// dengan backend.

const GESER_WIB_MS = 7 * 60 * 60 * 1000
const SEHARI_MS = 24 * 60 * 60 * 1000

const duaDigit = (n: number): string => String(n).padStart(2, '0')

// Tanggal WIB YYYY-MM-DD untuk saat `waktu` (bawaan: sekarang).
export const tanggalWib = (waktu: Date = new Date()): string => {
    const w = new Date(waktu.getTime() + GESER_WIB_MS)
    return `${w.getUTCFullYear()}-${duaDigit(w.getUTCMonth() + 1)}-${duaDigit(w.getUTCDate())}`
}

// Tanggal YYYY-MM-DD ditambah `hari` hari kalender.
export const tambahHari = (tanggal: string, hari: number): string => {
    const [t, b, h] = tanggal.split('-').map(Number)
    const w = new Date(Date.UTC(t, b - 1, h) + hari * SEHARI_MS)
    return `${w.getUTCFullYear()}-${duaDigit(w.getUTCMonth() + 1)}-${duaDigit(w.getUTCDate())}`
}

// Apakah teks YYYY-MM-DD benar-benar ada di kalender (2026-02-30 tidak).
export const tanggalSah = (tanggal: string): boolean => {
    const cocok = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(tanggal)
    if (!cocok) return false
    const [t, b, h] = [Number(cocok[1]), Number(cocok[2]), Number(cocok[3])]
    const w = new Date(Date.UTC(t, b - 1, h))
    return w.getUTCFullYear() === t && w.getUTCMonth() === b - 1 && w.getUTCDate() === h
}

// Rentang tanggal datang booking yang sah: hari ini sampai 30 hari ke depan (WIB).
export const rentangTanggalBooking = (sekarang: Date = new Date()) => {
    const awal = tanggalWib(sekarang)
    return { awal, akhir: tambahHari(awal, MAKS_HARI_BOOKING) }
}
