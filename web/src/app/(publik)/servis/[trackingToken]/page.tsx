// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import GalatMuatPublik from '@/components/publik/GalatMuatPublik'
import KerangkaPublik from '@/components/publik/KerangkaPublik'
import LacakServis from '@/components/publik/LacakServis'
import TokenTidakBerlaku from '@/components/publik/TokenTidakBerlaku'
import { NAMA_OUTLET_BAWAAN } from '@/constants/outlet'
import { POLA_TOKEN } from '@/skema/umum'
import { profilOutlet } from '@/server/outlet'
import { klienServer } from '@/server/pengangkut'

export const metadata: Metadata = {
    title: 'Lacak servis',
    robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ trackingToken: string }> }

// Lacak servis dan nota online. Alamat ini dirangkai backend untuk pesan WhatsApp
// ({PUBLIC_WEB_URL}/servis/<token>). Profil outlet sudah ada di balasan lacak; GET /api/outlet
// hanya dipakai bila tokennya tidak dikenal (untuk kepala dan kaki halaman).
export default async function HalamanLacakServis({ params }: Props) {
    const { trackingToken } = await params
    const spk = POLA_TOKEN.test(trackingToken)
        ? await klienServer().lacakServisPublik(trackingToken)
        : null
    const outlet = spk?.ok ? null : await profilOutlet()
    const profil = spk?.ok ? spk.data.outlet : outlet?.ok ? outlet.data : null
    return (
        <KerangkaPublik namaOutlet={profil?.name ?? NAMA_OUTLET_BAWAAN} outlet={profil}>
            {spk === null || (!spk.ok && spk.status === 404) ? (
                <TokenTidakBerlaku jenis="servis" />
            ) : !spk.ok ? (
                <GalatMuatPublik galat={spk.galat} judul="Status servis belum bisa dimuat" />
            ) : (
                <LacakServis token={trackingToken} awal={spk.data} />
            )}
        </KerangkaPublik>
    )
}
