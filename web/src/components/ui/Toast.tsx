// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Ikon from './Ikon'

type JenisToast = 'berhasil' | 'galat'

type Toast = { id: number; pesan: string; jenis: JenisToast }

type NilaiToast = { tampilkanToast: (pesan: string, jenis?: JenisToast) => void }

const KonteksToast = createContext<NilaiToast | null>(null)

// Cukup lama untuk dibaca kasir yang sedang melayani pelanggan; galat sedikit lebih lama karena
// biasanya butuh tindakan (mis. kirim ulang WhatsApp).
export const LAMA_TAMPIL_MS: Record<JenisToast, number> = { berhasil: 5000, galat: 8000 }

// Penyedia toast dipasang di kerangka panel, yang tetap hidup saat pindah halaman, jadi toast
// "SPK disimpan" masih terlihat setelah form mengarahkan ke halaman rincian.
//
// Hanya satu toast yang tampil, di tengah bilah atas. Bagian itu kosong di tablet dan laptop
// (logo di kiri, menu akun di kanan), sehingga toast tidak pernah menutupi form atau tombol di
// halaman, di posisi gulir mana pun. Toast baru mengganti yang lama, jadi menekan "maju" tiga kali
// berturut-turut tidak menumpuk tiga kotak.
export function PenyediaToast({ children }: { children: ReactNode }) {
    const [toast, setToast] = useState<Toast | null>(null)
    const nomor = useRef(0)

    const tutup = useCallback((id: number) => {
        setToast((lama) => (lama?.id === id ? null : lama))
    }, [])

    const tampilkanToast = useCallback((pesan: string, jenis: JenisToast = 'berhasil') => {
        nomor.current += 1
        setToast({ id: nomor.current, pesan, jenis })
    }, [])

    return (
        <KonteksToast.Provider value={{ tampilkanToast }}>
            {children}
            {/* Dua wilayah langsung: galat dibacakan segera, berhasil menunggu jeda. Wadahnya
                selalu ada di DOM, karena wilayah yang baru dibuat sering tidak dibacakan. z-[60]:
                di atas Dialog (z-50), supaya toast dari aksi di dalam dialog tetap terbaca. */}
            <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex justify-center px-4">
                <div className="w-full max-w-md md:max-w-[22rem] lg:max-w-lg">
                    <div aria-live="assertive">
                        {toast?.jenis === 'galat' && (
                            <ItemToast key={toast.id} toast={toast} onTutup={tutup} />
                        )}
                    </div>
                    <div aria-live="polite">
                        {toast?.jenis === 'berhasil' && (
                            <ItemToast key={toast.id} toast={toast} onTutup={tutup} />
                        )}
                    </div>
                </div>
            </div>
        </KonteksToast.Provider>
    )
}

function ItemToast({ toast, onTutup }: { toast: Toast; onTutup: (id: number) => void }) {
    // Hitungan mundur berhenti selama kursor atau fokus ada di toast, supaya pesan sempat dibaca.
    const [ditahan, setDitahan] = useState(false)

    useEffect(() => {
        if (ditahan) return
        const jeda = window.setTimeout(() => onTutup(toast.id), LAMA_TAMPIL_MS[toast.jenis])
        return () => window.clearTimeout(jeda)
    }, [toast.id, toast.jenis, onTutup, ditahan])

    const galat = toast.jenis === 'galat'
    return (
        <div
            data-toast={toast.jenis}
            onMouseEnter={() => setDitahan(true)}
            onMouseLeave={() => setDitahan(false)}
            onFocus={() => setDitahan(true)}
            onBlur={() => setDitahan(false)}
            className={`pointer-events-auto flex w-full items-center gap-3 rounded-xl border bg-permukaan py-1 pl-3 pr-1 text-tinta shadow-[0_12px_28px_-12px_rgba(31,27,22,0.5)] ${
                galat ? 'border-bahaya/50' : 'border-garis-kuat'
            }`}
        >
            <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    galat ? 'bg-bahaya-pucat text-bahaya-tua' : 'bg-berhasil-pucat text-berhasil'
                }`}
            >
                <Ikon nama={galat ? 'galat' : 'berhasil'} />
            </span>
            <p className="min-w-0 flex-1 py-1.5 text-[15px] font-semibold leading-snug">
                {toast.pesan}
            </p>
            <button
                type="button"
                onClick={() => onTutup(toast.id)}
                aria-label="Tutup pemberitahuan"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-redup transition-colors hover:bg-latar hover:text-tinta"
            >
                <Ikon nama="tutup" className="h-5 w-5" />
            </button>
        </div>
    )
}

export function useToast(): NilaiToast {
    const nilai = useContext(KonteksToast)
    if (!nilai) throw new Error('useToast dipakai di luar PenyediaToast')
    return nilai
}
