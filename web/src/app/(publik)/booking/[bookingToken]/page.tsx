// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import GalatMuatPublik from '@/components/publik/GalatMuatPublik'
import KerangkaPublik from '@/components/publik/KerangkaPublik'
import StatusBookingPublik from '@/components/publik/StatusBookingPublik'
import TokenTidakBerlaku from '@/components/publik/TokenTidakBerlaku'
import { NAMA_OUTLET_BAWAAN } from '@/constants/outlet'
import { POLA_TOKEN } from '@/skema/umum'
import { profilOutlet } from '@/server/outlet'
import { klienServer } from '@/server/pengangkut'

// Alamat bertoken bersifat pribadi: tidak untuk mesin pencari.
export const metadata: Metadata = {
    title: 'Status booking',
    robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ bookingToken: string }> }

// Status satu booking untuk pelanggan pemegang tokennya. Token yang bentuknya salah pasti tidak
// dikenal (spec: 404), jadi tidak perlu bertanya ke backend.
export default async function HalamanStatusBooking({ params }: Props) {
    const { bookingToken } = await params
    const [outlet, booking] = await Promise.all([
        profilOutlet(),
        POLA_TOKEN.test(bookingToken) ? klienServer().detailBookingPublik(bookingToken) : null,
    ])
    const nama = outlet.ok ? outlet.data.name : NAMA_OUTLET_BAWAAN
    return (
        <KerangkaPublik namaOutlet={nama} outlet={outlet.ok ? outlet.data : null}>
            {booking === null || (!booking.ok && booking.status === 404) ? (
                <TokenTidakBerlaku jenis="booking" />
            ) : !booking.ok ? (
                <GalatMuatPublik galat={booking.galat} judul="Status booking belum bisa dimuat" />
            ) : (
                <StatusBookingPublik token={bookingToken} awal={booking.data} />
            )}
        </KerangkaPublik>
    )
}
