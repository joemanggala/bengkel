// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useRef, useState } from 'react'
import TombolKeluar from '@/components/auth/TombolKeluar'
import Ikon from '@/components/ui/Ikon'
import { LABEL_PERAN, type Staf } from '@/skema/staf'
import { inisial } from '@/utils/teks'

// Menu akun di kanan bilah atas: nama, email, peran, dan Keluar. Peran selalu terlihat di
// tombolnya (layar lebar), supaya staf yang berbagi tablet tahu akun siapa yang aktif.
export default function MenuPengguna({ staf }: { staf: Staf }) {
    const [terbuka, setTerbuka] = useState(false)
    const wadah = useRef<HTMLDivElement>(null)
    const tombol = useRef<HTMLButtonElement>(null)
    // Id tetap (bukan useId): menu ini hanya ada satu per halaman, dan id tetap kebal dari
    // perbedaan urutan render server/klien saat hidrasi.
    const idMenu = 'menu-pengguna'
    const peran = LABEL_PERAN[staf.role]

    useEffect(() => {
        if (!terbuka) return
        // pointerdown, bukan mousedown, supaya ketukan jari di luar menu juga menutupnya.
        const ketukLuar = (e: PointerEvent) => {
            if (!wadah.current?.contains(e.target as Node)) setTerbuka(false)
        }
        const tekan = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            setTerbuka(false)
            tombol.current?.focus()
        }
        document.addEventListener('pointerdown', ketukLuar)
        document.addEventListener('keydown', tekan)
        return () => {
            document.removeEventListener('pointerdown', ketukLuar)
            document.removeEventListener('keydown', tekan)
        }
    }, [terbuka])

    return (
        <div ref={wadah} className="relative">
            <button
                ref={tombol}
                type="button"
                aria-expanded={terbuka}
                aria-controls={idMenu}
                onClick={() => setTerbuka((nilai) => !nilai)}
                className="flex min-h-11 items-center gap-2.5 rounded-full p-1 pr-2 text-left transition-colors hover:bg-latar sm:pr-3"
            >
                <span
                    aria-hidden="true"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tinta text-[15px] font-bold text-white"
                >
                    {inisial(staf.name)}
                </span>
                <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-44 truncate text-[15px] font-semibold leading-tight">
                        {staf.name}
                    </span>
                    <span className="block text-sm leading-tight text-redup">{peran}</span>
                </span>
                <span className="sr-only sm:hidden">
                    Menu akun {staf.name}, {peran}
                </span>
                <Ikon nama="bawah" className="hidden h-5 w-5 text-redup sm:block" />
            </button>
            {terbuka && (
                <div
                    id={idMenu}
                    className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-garis bg-permukaan shadow-[0_18px_36px_-18px_rgba(31,27,22,0.45)]"
                >
                    <div className="border-b border-garis px-4 py-3.5">
                        <p className="truncate font-bold">{staf.name}</p>
                        <p className="truncate text-[15px] text-redup">{staf.email}</p>
                        <p className="mt-2 inline-flex rounded-full bg-utama-pucat px-2.5 py-0.5 text-sm font-semibold text-utama-tua">
                            {peran}
                        </p>
                    </div>
                    <div className="p-2">
                        <TombolKeluar className="flex min-h-12 w-full items-center gap-2.5 rounded-lg px-3 text-left text-base font-semibold text-bahaya-tua transition-colors hover:bg-bahaya-pucat disabled:opacity-60" />
                    </div>
                </div>
            )}
        </div>
    )
}
