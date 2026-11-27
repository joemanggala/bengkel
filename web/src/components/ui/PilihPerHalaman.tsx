// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { useId } from 'react'

// Pilihan baris per halaman untuk daftar berpaginasi. API menerima limit 1-50, jadi 50 adalah
// pilihan terbesar.
export const PILIHAN_PER_HALAMAN = [10, 20, 50] as const

type Props = {
    nilai: number
    onUbah: (perHalaman: number) => void
    disabled?: boolean
}

// Deretan tombol "Per halaman 10 20 50" di bawah daftar. Tombol yang sedang dipakai ditandai
// aria-pressed; menekannya lagi tidak memuat ulang daftar.
export default function PilihPerHalaman({ nilai, onUbah, disabled }: Props) {
    const idLabel = useId()
    return (
        <div role="group" aria-labelledby={idLabel} className="flex items-center gap-1.5">
            <span id={idLabel} className="mr-1 text-sm text-redup">
                Per halaman
            </span>
            {PILIHAN_PER_HALAMAN.map((n) => {
                const aktif = n === nilai
                return (
                    <button
                        key={n}
                        type="button"
                        aria-pressed={aktif}
                        disabled={disabled}
                        onClick={() => {
                            if (!aktif) onUbah(n)
                        }}
                        className={`angka inline-flex min-h-10 min-w-11 items-center justify-center rounded-lg border px-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            aktif
                                ? 'border-utama-tua bg-utama text-white'
                                : 'border-garis-kuat bg-permukaan text-tinta hover:bg-latar'
                        }`}
                    >
                        {n}
                    </button>
                )
            })}
        </div>
    )
}
