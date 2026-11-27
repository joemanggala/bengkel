// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'
import Ikon, { type NamaIkon } from './Ikon'

export type JenisPesan = 'galat' | 'peringatan' | 'info' | 'berhasil'

const GAYA: Record<JenisPesan, { kelas: string; ikon: NamaIkon }> = {
    galat: { kelas: 'border-bahaya/40 bg-bahaya-pucat text-bahaya-tua', ikon: 'galat' },
    peringatan: {
        kelas: 'border-peringatan/30 bg-peringatan-pucat text-peringatan',
        ikon: 'peringatan',
    },
    info: { kelas: 'border-utama/30 bg-utama-pucat text-utama-tua', ikon: 'info' },
    berhasil: { kelas: 'border-berhasil/30 bg-berhasil-pucat text-berhasil', ikon: 'berhasil' },
}

type Props = { jenis: JenisPesan; judul?: string; children?: ReactNode; aksi?: ReactNode }

// Pesan untuk seluruh form atau halaman. Galat memakai role="alert" supaya langsung dibacakan
// pembaca layar; jenis lain role="status" yang dibacakan tanpa memotong. Ikon ikut menandai
// jenisnya, jadi pesan tidak hanya dibedakan oleh warna.
export default function KotakPesan({ jenis, judul, children, aksi }: Props) {
    const { kelas, ikon } = GAYA[jenis]
    return (
        <div
            role={jenis === 'galat' ? 'alert' : 'status'}
            className={`flex gap-3 rounded-lg border p-4 text-[15px] leading-relaxed ${kelas}`}
        >
            <Ikon nama={ikon} className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
                {judul && <p className="font-bold">{judul}</p>}
                {children && <div className={judul ? 'mt-1' : undefined}>{children}</div>}
                {aksi && <div className="mt-3 flex flex-wrap gap-2">{aksi}</div>}
            </div>
        </div>
    )
}
