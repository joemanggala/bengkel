// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import DaftarPelanggan from '@/components/pelanggan/DaftarPelanggan'
import { wajibKasir } from '@/server/sesi'

export const metadata: Metadata = { title: 'Pelanggan' }

// Pelanggan dan kendaraan (pemilik dan kasir).
export default async function HalamanPelanggan() {
    await wajibKasir()
    return <DaftarPelanggan />
}
