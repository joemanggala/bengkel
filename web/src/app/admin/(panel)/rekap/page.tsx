// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import TampilanRekap from '@/components/rekap/TampilanRekap'
import { wajibPemilik } from '@/server/sesi'

export const metadata: Metadata = { title: 'Rekap' }

// Rekap harian dan laba kotor (khusus pemilik).
export default async function HalamanTampilanRekap() {
    await wajibPemilik()
    return <TampilanRekap />
}
