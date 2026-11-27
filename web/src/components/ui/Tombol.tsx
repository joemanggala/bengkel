// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ButtonHTMLAttributes, Ref } from 'react'
import { TOMBOL_BAHAYA, TOMBOL_HANTU, TOMBOL_KECIL, TOMBOL_PRIMER, TOMBOL_SEKUNDER } from './gaya'

export type VarianTombol = 'primer' | 'sekunder' | 'bahaya' | 'hantu' | 'kecil'

const KELAS: Record<VarianTombol, string> = {
    primer: TOMBOL_PRIMER,
    sekunder: TOMBOL_SEKUNDER,
    bahaya: TOMBOL_BAHAYA,
    hantu: TOMBOL_HANTU,
    kecil: TOMBOL_KECIL,
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    varian?: VarianTombol
    // Saat true, tombol terkunci dan menampilkan roda putar. Dipakai selama aksi berjalan supaya
    // pembayaran atau perubahan status tidak terkirim dua kali karena ketukan ganda.
    sibuk?: boolean
    ref?: Ref<HTMLButtonElement>
}

export function RodaPutar() {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 animate-spin motion-reduce:animate-none"
            fill="none"
        >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
        </svg>
    )
}

// Tombol dengan empat varian dan keadaan sibuk. type bawaannya "button" (bukan "submit" seperti
// bawaan HTML), supaya tombol di dalam form tidak mengirim form tanpa sengaja.
export default function Tombol({
    varian = 'primer',
    sibuk,
    type = 'button',
    className = '',
    disabled,
    children,
    ...sisa
}: Props) {
    return (
        <button
            type={type}
            disabled={disabled || sibuk}
            aria-busy={sibuk || undefined}
            className={`${KELAS[varian]} ${className}`}
            {...sisa}
        >
            {sibuk && <RodaPutar />}
            {children}
        </button>
    )
}
