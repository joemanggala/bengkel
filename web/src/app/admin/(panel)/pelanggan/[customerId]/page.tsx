// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import GalatMuat from '@/components/panel/GalatMuat'
import RincianPelanggan from '@/components/pelanggan/RincianPelanggan'
import { POLA_UUID } from '@/skema/umum'
import { klienServer } from '@/server/pengangkut'
import { arahkanBilaDitolak, wajibKasir } from '@/server/sesi'

export const metadata: Metadata = { title: 'Rincian pelanggan' }

type Props = { params: Promise<{ customerId: string }> }

// Pelanggan beserta kendaraan dan riwayat servisnya (pemilik dan kasir).
export default async function HalamanRincianPelanggan({ params }: Props) {
    const { token } = await wajibKasir()
    const { customerId } = await params
    if (!POLA_UUID.test(customerId)) notFound()
    const hasil = await klienServer(token).detailPelanggan(customerId)
    await arahkanBilaDitolak(hasil)
    if (!hasil.ok && hasil.status === 404) notFound()
    if (!hasil.ok) return <GalatMuat galat={hasil.galat} judul="Pelanggan belum bisa dimuat" />
    return <RincianPelanggan awal={hasil.data} />
}
