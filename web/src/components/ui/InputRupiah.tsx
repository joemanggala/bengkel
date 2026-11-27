// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useRef, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { posisiKursorRupiah, rapikanIsianRupiah } from '@/utils/format'
import Input from './Input'

type Props = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type' | 'inputMode'
> & {
    // Teks isian yang sudah dirapikan ("15.000"), bukan angkanya. Urai dengan bacaBilangan di
    // src/utils/validasi.ts.
    value: string
    onChange: (nilai: string) => void
}

// Kotak isian rupiah: titik ribuan muncul sendiri selagi diketik ("15000" jadi "15.000"), huruf
// dan simbol diabaikan, dan "Rp" tampil di dalam kotak. Kursor tetap di sebelah digit yang sama,
// jadi mengedit angka di tengah tidak melompat ke ujung. Memakai Input yang sama dengan kotak
// isian lain, jadi galat, fokus, dan aksesibilitasnya (atributField) tidak berubah.
export default function InputRupiah({ value, onChange, className = '', ...sisa }: Props) {
    const kotak = useRef<HTMLInputElement>(null)

    function saatBerubah(e: ChangeEvent<HTMLInputElement>) {
        const mentah = e.target.value
        const digitDiKiri = mentah
            .slice(0, e.target.selectionStart ?? mentah.length)
            .replace(/\D/g, '').length
        const rapi = rapikanIsianRupiah(mentah)
        onChange(rapi)
        // React mengembalikan nilai kotak sesudah penangan selesai dan itu memindahkan kursor ke
        // ujung; microtask berikutnya berjalan sesudahnya, jadi kursor dipasang di sini.
        const posisi = posisiKursorRupiah(rapi, digitDiKiri)
        queueMicrotask(() => {
            const el = kotak.current
            if (el && document.activeElement === el) el.setSelectionRange(posisi, posisi)
        })
    }

    return (
        <div className="relative">
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base font-semibold text-redup"
            >
                Rp
            </span>
            <Input
                {...sisa}
                ref={kotak}
                value={value}
                onChange={saatBerubah}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={`angka pl-11 ${className}`}
            />
        </div>
    )
}
