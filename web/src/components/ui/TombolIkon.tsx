// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import Link from 'next/link'
import type { ButtonHTMLAttributes, Ref } from 'react'
import Ikon, { type NamaIkon } from './Ikon'
import { RodaPutar } from './Tombol'

// Warna tombol menurut maknanya: utama untuk aksi biasa (ubah, resep, cetak), berhasil untuk
// menambah atau mengaktifkan, peringatan untuk mengurangi, bahaya untuk menghapus atau
// menonaktifkan. Ikon di atas latar pucat dengan rona yang sama, kontras ikon minimal 3:1.
export type NadaTombolIkon = 'utama' | 'berhasil' | 'peringatan' | 'bahaya'

const NADA: Record<NadaTombolIkon, string> = {
    utama: 'bg-utama-pucat text-utama-tua hover:bg-utama hover:text-white',
    berhasil: 'bg-berhasil-pucat text-berhasil hover:bg-berhasil hover:text-white',
    peringatan: 'bg-peringatan-pucat text-peringatan hover:bg-peringatan hover:text-white',
    bahaya: 'bg-bahaya-pucat text-bahaya hover:bg-bahaya hover:text-white',
}

// 44 px seperti tombol kecil lain supaya tetap mudah diketuk di tablet.
const DASAR =
    'group relative inline-flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50'

type Dasar = {
    ikon: NamaIkon
    // Nama lengkap untuk pembaca layar, mis. "Ubah jasa Ganti Oli".
    label: string
    // Teks singkat di gelembung saat disorot atau difokus, mis. "Ubah". Bawaannya sama dengan label.
    teks?: string
    nada?: NadaTombolIkon
}

type PropsTombol = Dasar &
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
        sibuk?: boolean
        ref?: Ref<HTMLButtonElement>
    }

type PropsTautan = Dasar & { href: string; className?: string }

// Gelembung nama tombol. Ditaruh rata kanan di atas tombol, karena tombol ikon biasanya ada di
// kolom Aksi paling kanan: gelembungnya tidak keluar dari tabel yang bisa digulir. Tersembunyi
// (display:none) saat tidak disorot supaya tidak menambah lebar area gulir.
function Gelembung({ teks }: { teks: string }) {
    return (
        <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 hidden whitespace-nowrap rounded-md bg-tinta px-2 py-1 text-xs font-semibold text-white shadow-md group-hover:block group-focus-visible:block"
        >
            {teks}
        </span>
    )
}

// Tombol aksi berbentuk ikon untuk baris tabel dan kartu. Nama lengkapnya ada di aria-label;
// gelembung kecil menampilkan nama singkatnya bagi pengguna tetikus dan papan ketik.
export default function TombolIkon({
    ikon,
    label,
    teks = label,
    nada = 'utama',
    sibuk,
    disabled,
    className = '',
    type = 'button',
    ...sisa
}: PropsTombol) {
    return (
        <button
            type={type}
            aria-label={label}
            disabled={disabled || sibuk}
            aria-busy={sibuk || undefined}
            className={`${DASAR} ${NADA[nada]} ${className}`}
            {...sisa}
        >
            {sibuk ? <RodaPutar /> : <Ikon nama={ikon} className="h-5 w-5" />}
            <Gelembung teks={teks} />
        </button>
    )
}

// Sama dengan TombolIkon, tetapi berupa tautan ke halaman lain (mis. Rincian SPK).
export function TautanIkon({
    ikon,
    label,
    teks = label,
    nada = 'utama',
    href,
    className = '',
}: PropsTautan) {
    return (
        <Link href={href} aria-label={label} className={`${DASAR} ${NADA[nada]} ${className}`}>
            <Ikon nama={ikon} className="h-5 w-5" />
            <Gelembung teks={teks} />
        </Link>
    )
}
