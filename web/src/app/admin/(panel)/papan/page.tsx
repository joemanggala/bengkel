// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import PapanServis from '@/components/papan/PapanServis'
import KotakPesan from '@/components/ui/KotakPesan'
import { LABEL_PERAN } from '@/skema/staf'
import { wajibStaf } from '@/server/sesi'

export const metadata: Metadata = { title: 'Papan servis' }

type Props = { searchParams: Promise<{ akses?: string | string[] }> }

// Papan servis untuk semua peran. Halaman ini juga tujuan staf yang membuka halaman di luar
// perannya (?akses=ditolak), jadi penjelasannya tampil di sini.
export default async function HalamanPapan({ searchParams }: Props) {
    const { staf } = await wajibStaf()
    const { akses } = await searchParams
    const pesan =
        akses === 'ditolak' ? (
            <KotakPesan jenis="peringatan" judul="Halaman tadi tidak tersedia untuk peranmu">
                Kamu masuk sebagai {LABEL_PERAN[staf.role]}. Menu di samping hanya berisi halaman
                yang bisa kamu buka. Minta pemilik bila kamu butuh akses lain.
            </KotakPesan>
        ) : undefined
    return <PapanServis peran={staf.role} pesan={pesan} />
}
