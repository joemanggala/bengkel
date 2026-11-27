// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'
import Ikon, { type NamaIkon } from './Ikon'
import Petunjuk from './Petunjuk'

type Props = {
    judul?: string
    deskripsi?: ReactNode
    // Penjelasan kartu di balik tombol "?" di sebelah judul. Butuh judul.
    petunjuk?: ReactNode
    // Tombol di kanan judul, mis. "Ubah" atau "Cetak struk".
    aksi?: ReactNode
    children: ReactNode
    className?: string
    // Isi tanpa bantalan, mis. tabel yang menempel ke tepi kartu.
    rapat?: boolean
}

export default function Kartu({
    judul,
    deskripsi,
    petunjuk,
    aksi,
    children,
    className = '',
    rapat,
}: Props) {
    return (
        <section
            className={`overflow-hidden rounded-2xl border border-garis bg-permukaan ${className}`}
        >
            {(judul || aksi) && (
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-garis px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                        {judul && (
                            <div className="flex items-center gap-1">
                                <h2 className="text-lg font-bold leading-snug">{judul}</h2>
                                {petunjuk && (
                                    <Petunjuk label={`Penjelasan ${judul}`}>{petunjuk}</Petunjuk>
                                )}
                            </div>
                        )}
                        {deskripsi && (
                            <div className="mt-0.5 text-[15px] leading-relaxed text-redup">
                                {deskripsi}
                            </div>
                        )}
                    </div>
                    {aksi && <div className="flex shrink-0 flex-wrap gap-2">{aksi}</div>}
                </header>
            )}
            <div className={rapat ? undefined : 'p-5 sm:p-6'}>{children}</div>
        </section>
    )
}

type PropsAngka = {
    label: string
    nilai: string
    keterangan?: ReactNode
    ikon?: NamaIkon
    // Angka terpenting halaman, dibuat berlatar warna utama supaya terbaca lebih dulu.
    sorot?: boolean
}

// Kartu satu angka untuk ringkasan (rekap harian, jumlah SPK per status). Kelas dua nada
// dipisah (bukan ditumpuk) karena latar dan warna teksnya saling bertentangan.
export function KartuAngka({ label, nilai, keterangan, ikon, sorot }: PropsAngka) {
    return (
        <div
            className={`rounded-2xl border p-5 ${
                sorot ? 'border-utama-tua bg-utama text-white' : 'border-garis bg-permukaan'
            }`}
        >
            <div
                className={`flex items-center gap-2 text-[15px] font-semibold ${
                    sorot ? 'text-white/90' : 'text-redup'
                }`}
            >
                {ikon && (
                    <Ikon
                        nama={ikon}
                        className={`h-5 w-5 shrink-0 ${sorot ? 'text-white' : 'text-utama'}`}
                    />
                )}
                <span>{label}</span>
            </div>
            <p className="angka mt-2 text-[1.75rem] font-bold leading-tight">{nilai}</p>
            {keterangan && (
                <div className={`mt-1 text-sm ${sorot ? 'text-white/85' : 'text-redup'}`}>
                    {keterangan}
                </div>
            )}
        </div>
    )
}
