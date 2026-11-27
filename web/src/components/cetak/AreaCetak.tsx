// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Ikon from '@/components/ui/Ikon'
import { TOMBOL_SEKUNDER } from '@/components/ui/gaya'

// Isi yang dicetak dipasang langsung di bawah <body>, di luar kerangka panel. Aturan @media print
// di globals.css menyembunyikan semua anak <body> lain, sehingga yang keluar dari printer hanya
// nota, tanpa menu, tombol, atau ruang kosong setinggi halaman.
export default function AreaCetak({ children }: { children: ReactNode }) {
    // Portal baru dipasang setelah halaman berjalan di browser; saat render server belum ada
    // document.body untuk ditempeli.
    const [siap, setSiap] = useState(false)
    useEffect(() => setSiap(true), [])
    if (!siap) return null
    return createPortal(<div id="area-cetak">{children}</div>, document.body)
}

export function TombolCetak({ label = 'Cetak' }: { label?: string }) {
    return (
        <button type="button" onClick={() => window.print()} className={TOMBOL_SEKUNDER}>
            <Ikon nama="cetak" className="h-5 w-5" />
            {label}
        </button>
    )
}
