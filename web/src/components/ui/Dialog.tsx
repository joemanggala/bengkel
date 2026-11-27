// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Ikon from './Ikon'
import Petunjuk from './Petunjuk'

type Props = {
    terbuka: boolean
    judul: string
    deskripsi?: ReactNode
    // Penjelasan tambahan di balik tombol "?" di sebelah judul.
    petunjuk?: ReactNode
    // Selama proses berjalan, klik di luar dan tombol Esc diabaikan, supaya dialog tidak
    // tertutup diam-diam sementara hasilnya belum diketahui.
    sibuk?: boolean
    // Dialog lebar untuk isi yang butuh dua kolom. Bawaannya sempit, cukup untuk satu form pendek.
    lebar?: boolean
    onTutup: () => void
    children: ReactNode
}

const BISA_FOKUS =
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Dialog modal untuk aksi yang butuh isian tambahan atau konfirmasi, mis. menolak booking
// dengan alasan. Fokus dikurung di dalam dialog dan dikembalikan ke tombol pembukanya saat ditutup.
export default function Dialog({
    terbuka,
    judul,
    deskripsi,
    petunjuk,
    sibuk,
    lebar,
    onTutup,
    children,
}: Props) {
    const idJudul = useId()
    const idIsi = useId()
    const panel = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!terbuka) return
        const fokusSebelumnya = document.activeElement as HTMLElement | null
        const overflowLama = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        // Fokus pertama ke isian atau tombol pertama di dalam dialog.
        panel.current?.querySelector<HTMLElement>(BISA_FOKUS)?.focus()
        return () => {
            document.body.style.overflow = overflowLama
            fokusSebelumnya?.focus?.()
        }
    }, [terbuka])

    if (!terbuka) return null

    const tutupBilaBoleh = () => {
        if (!sibuk) onTutup()
    }

    const tekanTombol = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault()
            tutupBilaBoleh()
            return
        }
        if (e.key !== 'Tab' || !panel.current) return
        const fokus = Array.from(panel.current.querySelectorAll<HTMLElement>(BISA_FOKUS))
        if (fokus.length === 0) return
        const pertama = fokus[0]
        const terakhir = fokus[fokus.length - 1]
        if (e.shiftKey && document.activeElement === pertama) {
            e.preventDefault()
            terakhir.focus()
        } else if (!e.shiftKey && document.activeElement === terakhir) {
            e.preventDefault()
            pertama.focus()
        }
    }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/55 p-4 sm:items-center"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) tutupBilaBoleh()
            }}
        >
            <div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={idJudul}
                aria-describedby={deskripsi ? idIsi : undefined}
                aria-busy={sibuk}
                onKeyDown={tekanTombol}
                className={`max-h-[90dvh] w-full overflow-y-auto rounded-2xl bg-permukaan p-6 shadow-[0_24px_48px_-20px_rgba(31,27,22,0.5)] sm:p-7 ${
                    lebar ? 'max-w-5xl' : 'max-w-lg'
                }`}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-1">
                        <h2 id={idJudul} className="text-xl font-bold leading-snug">
                            {judul}
                        </h2>
                        {petunjuk && <Petunjuk label={`Penjelasan ${judul}`}>{petunjuk}</Petunjuk>}
                    </div>
                    <button
                        type="button"
                        onClick={tutupBilaBoleh}
                        disabled={sibuk}
                        aria-label="Tutup"
                        className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-redup transition-colors hover:bg-latar hover:text-tinta disabled:opacity-50"
                    >
                        <Ikon nama="tutup" className="h-5 w-5" />
                    </button>
                </div>
                {deskripsi && (
                    <div id={idIsi} className="mt-1 leading-relaxed text-redup">
                        {deskripsi}
                    </div>
                )}
                <div className="mt-5">{children}</div>
            </div>
        </div>,
        document.body,
    )
}
