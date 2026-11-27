// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
    // Nama tombol untuk pembaca layar, mis. "Penjelasan halaman Jasa".
    label: string
    children: ReactNode
    className?: string
}

// Jarak minimal kotak penjelasan dari tepi layar, dalam piksel.
const JARAK_TEPI = 16

// Tombol "?" kecil yang menyimpan penjelasan supaya halaman tidak dipenuhi tulisan panjang.
// Penjelasannya muncul saat tombol disorot tetikus atau difokus papan ketik, dan tetap terbuka
// bila tombol diklik atau diketuk (cara satu-satunya di layar sentuh) sampai diklik lagi, Esc
// ditekan, atau pengguna menekan di luar.
//
// Teks penjelasan selalu ada di DOM dan dirujuk aria-describedby, jadi pembaca layar
// membacakannya bersama nama tombol walau kotaknya sedang tersembunyi.
export default function Petunjuk({ label, children, className = '' }: Props) {
    const id = useId()
    const wadah = useRef<HTMLSpanElement>(null)
    const kotak = useRef<HTMLSpanElement>(null)
    // disorot: tetikus di atas tombol atau tombol difokus. disematkan: dibuka lewat klik/ketuk.
    const [disorot, setDisorot] = useState(false)
    const [disematkan, setDisematkan] = useState(false)
    const [geser, setGeser] = useState(0)
    const buka = disorot || disematkan

    // Kotak berawal dari kiri tombol; bila tombolnya dekat tepi kanan (mis. di sebelah tombol
    // Tambah), kotaknya digeser ke kiri supaya tidak terpotong layar.
    useLayoutEffect(() => {
        if (!buka || !wadah.current || !kotak.current) return
        const kiri = wadah.current.getBoundingClientRect().left
        const lebar = kotak.current.offsetWidth
        const ruang = document.documentElement.clientWidth
        let g = Math.min(0, ruang - JARAK_TEPI - (kiri + lebar))
        g = Math.max(g, JARAK_TEPI - kiri)
        setGeser(g)
    }, [buka])

    useEffect(() => {
        if (!buka) return
        const tekanLuar = (e: PointerEvent) => {
            if (wadah.current && !wadah.current.contains(e.target as Node)) {
                setDisematkan(false)
                setDisorot(false)
            }
        }
        const tekanTombol = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setDisematkan(false)
                setDisorot(false)
            }
        }
        document.addEventListener('pointerdown', tekanLuar)
        document.addEventListener('keydown', tekanTombol)
        return () => {
            document.removeEventListener('pointerdown', tekanLuar)
            document.removeEventListener('keydown', tekanTombol)
        }
    }, [buka])

    return (
        <span
            ref={wadah}
            className={`relative inline-flex shrink-0 align-middle ${className}`}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setDisorot(true)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setDisorot(false)}
            // Esc saat penjelasan terbuka hanya menutup penjelasan, bukan dialog di sekitarnya.
            onKeyDown={(e) => {
                if (e.key === 'Escape' && buka) {
                    e.stopPropagation()
                    setDisematkan(false)
                    setDisorot(false)
                }
            }}
        >
            <button
                type="button"
                aria-label={label}
                aria-describedby={id}
                aria-expanded={buka}
                onClick={() => {
                    if (disematkan) {
                        setDisematkan(false)
                        setDisorot(false)
                    } else {
                        setDisematkan(true)
                    }
                }}
                onFocus={() => setDisorot(true)}
                onBlur={() => {
                    setDisorot(false)
                    setDisematkan(false)
                }}
                className="group inline-flex h-9 w-9 items-center justify-center rounded-full"
            >
                <span
                    aria-hidden="true"
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-extrabold leading-none transition-colors ${
                        buka
                            ? 'border-utama bg-utama text-white'
                            : 'border-garis-kuat text-redup group-hover:border-utama group-hover:text-utama-tua'
                    }`}
                >
                    ?
                </span>
            </button>
            <span
                ref={kotak}
                id={id}
                role="tooltip"
                hidden={!buka}
                style={{ left: geser }}
                className="absolute top-full z-40 w-max max-w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-tinta px-4 py-3 text-left text-sm font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg"
            >
                {children}
            </span>
        </span>
    )
}
