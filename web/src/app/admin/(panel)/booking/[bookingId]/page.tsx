// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import RincianBooking from '@/components/booking/RincianBooking'
import GalatMuat from '@/components/panel/GalatMuat'
import { POLA_UUID } from '@/skema/umum'
import { klienServer } from '@/server/pengangkut'
import { arahkanBilaDitolak, wajibKasir } from '@/server/sesi'

export const metadata: Metadata = { title: 'Rincian booking' }

type Props = { params: Promise<{ bookingId: string }> }

// Rincian booking (pemilik dan kasir). Id yang bukan UUID kanonik pasti tidak ada (spec: 404).
export default async function HalamanRincianBooking({ params }: Props) {
    const { token } = await wajibKasir()
    const { bookingId } = await params
    if (!POLA_UUID.test(bookingId)) notFound()
    const hasil = await klienServer(token).detailBooking(bookingId)
    await arahkanBilaDitolak(hasil)
    if (!hasil.ok && hasil.status === 404) notFound()
    if (!hasil.ok) return <GalatMuat galat={hasil.galat} judul="Booking belum bisa dimuat" />
    return <RincianBooking awal={hasil.data} />
}
