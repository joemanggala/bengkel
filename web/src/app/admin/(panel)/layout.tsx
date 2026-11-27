// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import KerangkaAuth from '@/components/auth/KerangkaAuth'
import KerangkaPanel from '@/components/panel/KerangkaPanel'
import TombolMuatUlang from '@/components/panel/TombolMuatUlang'
import KotakPesan from '@/components/ui/KotakPesan'
import { namaOutlet } from '@/server/outlet'
import { bacaSesi } from '@/server/sesi'
import { pesanGalat } from '@/utils/galat'
import { HEADER_PATH, PATH_MASUK, alamatSesiBerakhir } from '@/utils/sesi'

// Nama bengkel dan sesi dibaca setiap kali halaman panel dibuka.
export const dynamic = 'force-dynamic'

// Semua halaman panel staf ada di grup (panel). Layout memeriksa sesi sekali untuk kerangkanya
// (nama bengkel, nama staf, menu sesuai peran); halaman tetap memanggil wajibStaf()/wajibPeran()
// sendiri (lihat src/server/sesi.ts), karena berpindah antarhalaman bisa merender halaman tanpa
// merender ulang layout ini.
export default async function LayoutPanel({ children }: { children: ReactNode }) {
    const [sesi, nama] = await Promise.all([bacaSesi(), namaOutlet()])
    if (sesi.status === 'tamu') redirect(PATH_MASUK)
    if (sesi.status === 'habis') {
        redirect(alamatSesiBerakhir((await headers()).get(HEADER_PATH)))
    }
    if (sesi.status === 'gagal') {
        return (
            <KerangkaAuth namaOutlet={nama} judul="Panel belum bisa dibuka">
                <KotakPesan jenis="galat">{pesanGalat(sesi.galat)}</KotakPesan>
                <TombolMuatUlang className="mt-6 w-full" />
            </KerangkaAuth>
        )
    }
    return (
        <KerangkaPanel staf={sesi.staf} namaOutlet={nama}>
            {children}
        </KerangkaPanel>
    )
}
