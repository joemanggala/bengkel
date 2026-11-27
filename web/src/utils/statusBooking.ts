// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { StatusBooking } from '@/skema/booking'

// Aturan status booking dari spec ("Status booking") dan keputusan 0a-10:
//
//   PENDING -> CONFIRMED -> CONVERTED;  PENDING -> CONVERTED (pelanggan datang sebelum dikonfirmasi)
//   PENDING, CONFIRMED -> REJECTED (staf, wajib alasan)
//   PENDING -> CANCELLED (pelanggan sendiri, dari halaman booking)
//
// CONVERTED, REJECTED, dan CANCELLED adalah akhir. Backend tetap penentu akhirnya (409
// booking_transition_invalid); di web aturan ini memilih tombol yang tampil.

export type AksiBooking = 'konfirmasi' | 'tolak' | 'jadikanSpk' | 'batalPelanggan'

const AKSI: Readonly<Record<AksiBooking, readonly StatusBooking[]>> = {
    konfirmasi: ['PENDING'],
    tolak: ['PENDING', 'CONFIRMED'],
    jadikanSpk: ['PENDING', 'CONFIRMED'],
    batalPelanggan: ['PENDING'],
}

export const bolehAksiBooking = (status: StatusBooking, aksi: AksiBooking): boolean =>
    AKSI[aksi].includes(status)

// Aksi staf yang tersedia untuk status itu (tanpa pembatalan pelanggan).
export const aksiStafBooking = (status: StatusBooking): AksiBooking[] =>
    (['konfirmasi', 'jadikanSpk', 'tolak'] as const).filter((a) => bolehAksiBooking(status, a))

export const STATUS_AKHIR_BOOKING: readonly StatusBooking[] = ['CONVERTED', 'REJECTED', 'CANCELLED']

export const bookingSelesai = (status: StatusBooking): boolean =>
    STATUS_AKHIR_BOOKING.includes(status)

// Paling banyak 3 booking menunggu per nomor HP (409 too_many_pending_bookings).
export const MAKS_BOOKING_MENUNGGU = 3

// Tanggal datang: hari ini sampai 30 hari ke depan menurut tanggal WIB.
export const MAKS_HARI_BOOKING = 30
