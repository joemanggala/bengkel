// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'
import Logo from '@/components/panel/Logo'
import Ikon, { type NamaIkon } from '@/components/ui/Ikon'

type Props = {
    namaOutlet: string
    judul: string
    deskripsi?: ReactNode
    children: ReactNode
    bawah?: ReactNode
}

const POIN: readonly { ikon: NamaIkon; teks: string }[] = [
    { ikon: 'kalender', teks: 'Terima booking servis dari website' },
    { ikon: 'papan', teks: 'Pantau SPK dari antre sampai kendaraan diambil' },
    { ikon: 'cetak', teks: 'Cetak nota 58 mm atau kirim lewat WhatsApp' },
]

// Halaman masuk dan pemasangan awal. Layar lebar (>= 1024 px) dibagi dua: panel merek di kiri
// berisi nama bengkel dan tiga kegunaan aplikasi, form polos di kanan. Di layar sempit panel
// menjadi spanduk tipis berisi nama bengkel, dan kartu form menimpa tepinya. Kartu dibatasi
// 28 rem supaya baris isian tidak terlalu panjang.
export default function KerangkaAuth({ namaOutlet, judul, deskripsi, children, bawah }: Props) {
    return (
        <main id="konten" className="min-h-screen bg-latar lg:grid lg:grid-cols-2">
            <div className="bg-utama px-6 pb-14 pt-8 text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-14">
                <div className="flex items-center gap-3">
                    <span className="rounded-[11px] ring-2 ring-white/80">
                        <Logo className="h-11 w-11" />
                    </span>
                    <span className="text-xl font-bold tracking-tight">{namaOutlet}</span>
                </div>
                <div className="hidden max-w-md lg:block">
                    <p className="text-4xl font-extrabold leading-tight tracking-tight">
                        Servis tercatat rapi, pelanggan tahu kabar kendaraannya.
                    </p>
                    <ul className="mt-10 space-y-5">
                        {POIN.map((p) => (
                            <li
                                key={p.teks}
                                className="flex items-center gap-4 text-lg text-white/90"
                            >
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
                                    <Ikon nama={p.ikon} className="h-6 w-6" />
                                </span>
                                {p.teks}
                            </li>
                        ))}
                    </ul>
                </div>
                <div aria-hidden="true" className="hidden lg:block" />
            </div>
            <div className="relative z-10 -mt-6 flex flex-col items-center px-4 pb-10 lg:mt-0 lg:justify-center lg:bg-permukaan lg:px-14 lg:py-14">
                <div className="w-full max-w-md rounded-2xl border border-garis bg-permukaan p-6 shadow-[0_24px_48px_-32px_rgba(31,27,22,0.5)] sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
                    <h1 className="text-2xl font-bold leading-tight tracking-tight">{judul}</h1>
                    {deskripsi && (
                        <div className="mt-2 leading-relaxed text-redup">{deskripsi}</div>
                    )}
                    <div className="mt-7">{children}</div>
                </div>
                {bawah && (
                    <div className="mt-6 max-w-md text-center text-[15px] text-redup">{bawah}</div>
                )}
            </div>
        </main>
    )
}
