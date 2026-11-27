// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import FormSetup from '@/components/auth/FormSetup'
import KerangkaAuth from '@/components/auth/KerangkaAuth'
import KotakPesan from '@/components/ui/KotakPesan'
import { namaOutlet, statusSetup } from '@/server/outlet'
import { pesanGalat } from '@/utils/galat'
import { PATH_MASUK } from '@/utils/sesi'

export const metadata: Metadata = { title: 'Pemasangan awal' }

// Halaman ini tidak membaca cookie, jadi tanpa baris ini Next.js bisa merendernya statis saat
// build dan membekukan jawaban GET /api/setup (atau galat "server belum bisa dihubungi" bila
// backend mati ketika build). Status pemasangan harus dibaca setiap kali halaman dibuka.
export const dynamic = 'force-dynamic'

// Pemasangan awal sekali pakai: membuat akun pemilik pertama selama belum ada akun staf. Form
// hanya tampil bila GET /api/setup membalas needsSetup: true; selain itu staf dialihkan ke halaman
// masuk.
export default async function HalamanSetup() {
    const [setup, nama] = await Promise.all([statusSetup(), namaOutlet()])
    // Setelah server action pemasangan berhasil, halaman ini dirender ulang dalam permintaan yang
    // sama dan pemilik sudah ada; jangan alihkan ke halaman masuk di render itu, karena form
    // sendiri yang memastikan cookie sesi tersimpan lalu membawa pemilik ke halaman Outlet.
    const sedangAksi = (await headers()).has('next-action')
    if (!sedangAksi && setup.ok && !setup.data.needsSetup) redirect(PATH_MASUK)
    return (
        <KerangkaAuth
            namaOutlet={nama}
            judul="Pemasangan awal"
            deskripsi="Buat akun pemilik pertama. Langkah ini hanya sekali; akun kasir dan mekanik dibuat pemilik setelah masuk."
        >
            {!setup.ok && (
                <div className="mb-5">
                    <KotakPesan jenis="galat" judul="Server belum bisa dihubungi">
                        {pesanGalat(setup.galat)}
                    </KotakPesan>
                </div>
            )}
            <FormSetup />
        </KerangkaAuth>
    )
}
