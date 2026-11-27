// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import FormOutlet from '@/components/outlet/FormOutlet'
import GalatMuat from '@/components/panel/GalatMuat'
import { profilOutlet } from '@/server/outlet'
import { wajibPemilik } from '@/server/sesi'

export const metadata: Metadata = { title: 'Outlet' }

// Profil outlet (khusus pemilik). Juga tujuan pertama sesudah pemasangan awal.
export default async function HalamanOutlet() {
    await wajibPemilik()
    const outlet = await profilOutlet()
    if (!outlet.ok)
        return <GalatMuat galat={outlet.galat} judul="Profil bengkel belum bisa dimuat" />
    return <FormOutlet awal={outlet.data} />
}
