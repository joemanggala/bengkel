// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState, type InputHTMLAttributes, type Ref } from 'react'
import { INPUT } from './gaya'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    ref?: Ref<HTMLInputElement>
}

// Tombol tampilkan membantu staf memeriksa sandi yang diketik di layar sentuh, tempat salah
// ketik lebih sering terjadi.
export default function InputSandi({ ref, ...props }: Props) {
    const [terlihat, setTerlihat] = useState(false)
    return (
        <div className="relative">
            <input
                ref={ref}
                {...props}
                type={terlihat ? 'text' : 'password'}
                className={`${INPUT} pr-32`}
            />
            <button
                type="button"
                onClick={() => setTerlihat((nilai) => !nilai)}
                aria-controls={props.id}
                className="absolute inset-y-0.5 right-0.5 min-w-11 rounded-md px-3 text-[15px] font-semibold text-utama-tua transition-colors hover:bg-utama-pucat"
            >
                {terlihat ? 'Sembunyikan' : 'Tampilkan'}
            </button>
        </div>
    )
}
