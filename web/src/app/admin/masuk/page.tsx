// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import FormMasuk from '@/components/auth/FormMasuk'
import KerangkaAuth from '@/components/auth/KerangkaAuth'
import KotakPesan from '@/components/ui/KotakPesan'
import { namaOutlet, statusSetup } from '@/server/outlet'
import { bacaSesi } from '@/server/sesi'
import { PESAN_GALAT_WEB, pesanGalat } from '@/utils/galat'
import { PATH_SETUP, amankanTujuan, tujuanSetelahMasuk } from '@/utils/sesi'

export const metadata: Metadata = { title: 'Masuk' }

// Status pemasangan dan nama bengkel dibaca setiap kali halaman dibuka.
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ ke?: string | string[]; sesi?: string | string[] }> }

export default async function HalamanMasuk({ searchParams }: Props) {
    const { ke, sesi } = await searchParams
    // ?ke= dari middleware dibersihkan di sini juga, supaya alamat luar tidak ikut ke form.
    const tujuan = amankanTujuan(ke) ?? undefined
    // Saat form dikirim, server action memasang cookie lalu merender ulang halaman ini dalam
    // permintaan yang sama. Pada render itu cookie baru sudah terbaca, padahal browser belum tentu
    // menyimpannya (mis. cookie Secure lewat http). Pengalihan setelah masuk diserahkan ke form,
    // yang lebih dulu memastikan cookie tersimpan; dua pengalihan sekaligus juga saling balapan.
    const sedangAksi = (await headers()).has('next-action')
    const [setup, sesiSekarang, nama] = await Promise.all([
        statusSetup(),
        sedangAksi ? null : bacaSesi(),
        namaOutlet(),
    ])
    // Server yang baru dipasang belum punya akun sama sekali: buat pemilik pertama dulu.
    if (setup.ok && setup.data.needsSetup) redirect(PATH_SETUP)
    // Staf yang masih masuk (mis. membuka halaman ini dari riwayat browser) langsung diteruskan.
    if (sesiSekarang?.status === 'masuk') {
        redirect(tujuanSetelahMasuk(sesiSekarang.staf.role, tujuan))
    }

    const pesanAwal = sesi === 'berakhir' ? PESAN_GALAT_WEB.unauthenticated : undefined
    return (
        <KerangkaAuth
            namaOutlet={nama}
            judul="Masuk"
            deskripsi="Untuk pemilik, kasir, dan mekanik. Akun kasir dan mekanik dibuat oleh pemilik."
        >
            {!setup.ok && (
                <div className="mb-5">
                    <KotakPesan jenis="galat" judul="Server belum bisa dihubungi">
                        {pesanGalat(setup.galat)}
                    </KotakPesan>
                </div>
            )}
            <FormMasuk ke={tujuan} pesanAwal={pesanAwal} />
        </KerangkaAuth>
    )
}
