// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useId, useState } from 'react'
import Ikon from './Ikon'
import { INPUT } from './gaya'

type Props = {
    // Teks cari yang sedang dipakai daftar.
    nilai: string
    onCari: (teks: string) => void
    label: string
    placeholder?: string
    // Jeda sebelum mencari selagi mengetik.
    jedaMs?: number
}

// Kotak cari daftar: mencari sendiri setelah berhenti mengetik sebentar (tanpa perlu menekan
// tombol), dan langsung saat Enter ditekan. Label tetap ada untuk pembaca layar.
export default function KotakCari({ nilai, onCari, label, placeholder, jedaMs = 350 }: Props) {
    const [teks, setTeks] = useState(nilai)
    const id = useId()

    useEffect(() => {
        if (teks.trim() === nilai.trim()) return
        const jeda = window.setTimeout(() => onCari(teks.trim()), jedaMs)
        return () => window.clearTimeout(jeda)
    }, [teks, nilai, onCari, jedaMs])

    return (
        <form
            role="search"
            onSubmit={(e) => {
                e.preventDefault()
                onCari(teks.trim())
            }}
            className="relative w-full sm:max-w-sm"
        >
            <label className="sr-only" htmlFor={id}>
                {label}
            </label>
            <Ikon
                nama="cari"
                className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-redup"
            />
            <input
                id={id}
                type="search"
                value={teks}
                onChange={(e) => setTeks(e.target.value)}
                placeholder={placeholder ?? label}
                autoComplete="off"
                className={`${INPUT} pl-11`}
            />
        </form>
    )
}
