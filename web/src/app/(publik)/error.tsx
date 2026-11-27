// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import Link from 'next/link'
import Logo from '@/components/panel/Logo'
import KotakPesan from '@/components/ui/KotakPesan'
import Tombol from '@/components/ui/Tombol'

// Jaring pengaman untuk galat tak terduga di halaman publik (bukan galat API, yang ditangani
// masing-masing halaman). Layar putih kosong tidak membantu pelanggan, jadi tampilkan penjelasan,
// tombol coba lagi, dan jalan ke halaman depan. Kerangka dibuat langsung di sini karena komponen
// server (nama bengkel) tidak bisa dipakai di dalam error boundary.
export default function GalatHalamanPublik({ reset }: { error: Error; reset: () => void }) {
    return (
        <div className="min-h-screen bg-latar text-tinta">
            <header className="border-b border-garis bg-permukaan">
                <div className="mx-auto flex h-16 w-full max-w-lg items-center px-4">
                    <Link href="/" aria-label="Ke halaman depan" className="rounded-lg">
                        <Logo className="h-9 w-9" />
                    </Link>
                </div>
            </header>
            <main className="mx-auto w-full max-w-lg px-4 py-6">
                <KotakPesan
                    jenis="galat"
                    judul="Halaman ini sedang bermasalah"
                    aksi={
                        <Tombol varian="sekunder" onClick={reset}>
                            Coba lagi
                        </Tombol>
                    }
                >
                    Ada yang tidak berjalan sebagaimana mestinya. Coba lagi sebentar, dan kalau
                    masih gagal, hubungi bengkel lewat WhatsApp.
                </KotakPesan>
            </main>
        </div>
    )
}
