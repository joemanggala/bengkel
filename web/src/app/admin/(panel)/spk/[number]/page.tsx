// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import GalatMuat from '@/components/panel/GalatMuat'
import RincianSpk from '@/components/spk/RincianSpk'
import { POLA_NOMOR_SPK } from '@/skema/umum'
import { profilOutlet } from '@/server/outlet'
import { klienServer } from '@/server/pengangkut'
import { arahkanBilaDitolak, wajibStaf } from '@/server/sesi'

type Props = { params: Promise<{ number: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { number } = await params
    return { title: POLA_NOMOR_SPK.test(number) ? `SPK ${number}` : 'SPK' }
}

// Rincian SPK untuk semua peran. Mekanik yang membuka SPK bukan miliknya dibalas 403 oleh
// backend dan diarahkan ke Papan servis dengan penjelasan.
export default async function HalamanRincianSpk({ params }: Props) {
    const { staf, token } = await wajibStaf()
    const { number } = await params
    // Nomor yang bentuknya bukan S-0001 pasti tidak ada (spec: 404), jadi tidak perlu bertanya.
    if (!POLA_NOMOR_SPK.test(number)) notFound()
    const [hasil, outlet] = await Promise.all([
        klienServer(token).detailSpk(number),
        profilOutlet(),
    ])
    await arahkanBilaDitolak(hasil)
    if (!hasil.ok && hasil.status === 404) notFound()
    if (!hasil.ok) return <GalatMuat galat={hasil.galat} judul="SPK belum bisa dimuat" />
    return (
        <RincianSpk awal={hasil.data} peran={staf.role} outlet={outlet.ok ? outlet.data : null} />
    )
}
