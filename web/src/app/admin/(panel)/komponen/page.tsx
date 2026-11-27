// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import GaleriKomponen from '@/components/panel/GaleriKomponen'
import { wajibStaf } from '@/server/sesi'

export const metadata: Metadata = { title: 'Komponen' }

// Galeri komponen dasar, tidak ada di menu (lihat GaleriKomponen).
export default async function HalamanKomponen() {
    await wajibStaf()
    return <GaleriKomponen />
}
