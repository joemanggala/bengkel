// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import DaftarBooking from '@/components/booking/DaftarBooking'
import { wajibKasir } from '@/server/sesi'

export const metadata: Metadata = { title: 'Booking' }

// Booking dari website (pemilik dan kasir).
export default async function HalamanBooking() {
    await wajibKasir()
    return <DaftarBooking />
}
