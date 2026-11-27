// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import KotakPesan from '@/components/ui/KotakPesan'
import { TOMBOL_SEKUNDER } from '@/components/ui/gaya'

// Galat tak terduga di satu halaman panel (mis. backend mati di tengah jalan) ditampilkan di
// dalam kerangka, sehingga menu tetap bisa dipakai untuk pindah halaman.
export default function GalatPanel({ reset }: { error: Error; reset: () => void }) {
    const router = useRouter()
    // reset() saja hanya merender ulang bagian klien dengan data server yang sama (yang tadi gagal),
    // jadi halaman tetap galat walau backend sudah hidup. router.refresh() meminta ulang data dari
    // server; keduanya dijalankan dalam satu transition supaya galat baru hilang setelah data baru
    // tiba.
    const cobaLagi = () =>
        startTransition(() => {
            router.refresh()
            reset()
        })
    return (
        <KotakPesan
            jenis="galat"
            judul="Halaman ini belum bisa dimuat"
            aksi={
                <button type="button" onClick={cobaLagi} className={TOMBOL_SEKUNDER}>
                    Coba lagi
                </button>
            }
        >
            Periksa koneksi ke server, lalu coba lagi.
        </KotakPesan>
    )
}
