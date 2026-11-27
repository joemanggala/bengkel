// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import KelolaSparepart from '@/components/sparepart/KelolaSparepart'
import { wajibPemilik } from '@/server/sesi'

export const metadata: Metadata = { title: 'Sparepart' }

// Sparepart dan stok (khusus pemilik; harga beli rahasia pemilik).
export default async function HalamanKelolaSparepart() {
    await wajibPemilik()
    return <KelolaSparepart />
}
