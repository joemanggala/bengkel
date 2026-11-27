// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import KelolaJasa from '@/components/jasa/KelolaJasa'
import { wajibPemilik } from '@/server/sesi'

export const metadata: Metadata = { title: 'Jasa' }

// Katalog jasa (khusus pemilik).
export default async function HalamanKelolaJasa() {
    await wajibPemilik()
    return <KelolaJasa />
}
