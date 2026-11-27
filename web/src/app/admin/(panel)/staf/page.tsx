// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import KelolaStaf from '@/components/staf/KelolaStaf'
import { wajibPemilik } from '@/server/sesi'

export const metadata: Metadata = { title: 'Staf' }

// Akun staf (khusus pemilik).
export default async function HalamanStaf() {
    const { staf } = await wajibPemilik()
    return <KelolaStaf staffIdSaya={staf.staffId} />
}
