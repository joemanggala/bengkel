// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useRouter } from 'next/navigation'
import { TOMBOL_SEKUNDER } from '@/components/ui/gaya'

// Meminta ulang data halaman dari server tanpa memuat ulang seluruh aplikasi.
export default function TombolMuatUlang({ className = '' }: { className?: string }) {
    const router = useRouter()
    return (
        <button
            type="button"
            onClick={() => router.refresh()}
            className={`${TOMBOL_SEKUNDER} ${className}`}
        >
            Coba lagi
        </button>
    )
}
