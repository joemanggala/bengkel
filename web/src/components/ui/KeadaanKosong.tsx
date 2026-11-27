// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'
import Ikon, { type NamaIkon } from './Ikon'

type Props = {
    judul: string
    children?: ReactNode
    ikon?: NamaIkon
    // Tombol atau tautan tindak lanjut, mis. "Tambah jasa".
    aksi?: ReactNode
}

// Pengganti daftar yang kosong atau halaman yang belum punya isi. Selalu berisi kalimat yang
// menjelaskan keadaannya dan, bila ada, langkah berikutnya, bukan ruang kosong.
export default function KeadaanKosong({ judul, children, ikon = 'info', aksi }: Props) {
    return (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-garis-kuat bg-permukaan px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-utama-pucat text-utama-tua">
                <Ikon nama={ikon} className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-bold">{judul}</h2>
            {children && (
                <div className="mt-1.5 max-w-md leading-relaxed text-redup">{children}</div>
            )}
            {aksi && <div className="mt-5 flex flex-wrap justify-center gap-2">{aksi}</div>}
        </div>
    )
}
