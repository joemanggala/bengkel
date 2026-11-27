// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { PATH_BERANDA } from '@/constants/menu'
import Ikon from './Ikon'
import Petunjuk from './Petunjuk'

type Props = {
    judul: string
    // Keterangan singkat yang selalu tampil di bawah judul, mis. status SPK.
    deskripsi?: ReactNode
    // Penjelasan halaman. Disimpan di balik tombol "?" di sebelah judul supaya pita judul tidak
    // dipenuhi tulisan panjang.
    petunjuk?: ReactNode
    // Tombol aksi utama halaman, mis. "SPK baru" atau "Tambah pelanggan".
    aksi?: ReactNode
    // Halaman induk untuk halaman turunan, mis. rincian SPK di bawah Papan servis. Tampil sebagai
    // satu langkah di jejak halaman.
    kembali?: { label: string; href: string }
    // Alat di bawah judul, mis. kotak cari dan tab status.
    children?: ReactNode
}

// Pita judul halaman: judul (dengan tombol "?" berisi penjelasan) dan keterangan di kiri, tombol aksi di kanan, lalu alat cari/filter di
// bawahnya. Dibuat serapat mungkin supaya isi halaman mulai tinggi di layar. Jejak halaman hanya
// tampil di halaman dalam (rincian, cetak); di halaman tingkat atas ia cuma mengulang menu.
//
// Pita ini selalu menjadi anak pertama <main> di KerangkaPanel, yang memberi bantalan
// px-4 sm:px-6 dan py-6. Margin negatif di bawah ini membuat pita membentang sampai tepi area
// kerja, sedangkan isi halaman di bawahnya tetap memakai bantalan itu.
export default function JudulHalaman({
    judul,
    deskripsi,
    petunjuk,
    aksi,
    kembali,
    children,
}: Props) {
    // Papan servis adalah beranda, jadi halaman induk yang menunjuk ke sana tidak diulang.
    const induk = kembali
        ? kembali.href === PATH_BERANDA
            ? [kembali]
            : [{ label: 'Papan servis', href: PATH_BERANDA }, kembali]
        : []
    const jejak = [...induk, { label: judul }]
    return (
        <div className="-mx-4 -mt-6 mb-6 border-b border-garis bg-permukaan px-4 py-4 sm:-mx-6 sm:px-6">
            {induk.length > 0 && (
                <nav aria-label="Jejak halaman" className="mb-1">
                    <ol className="flex flex-wrap items-center gap-x-1 text-sm font-semibold text-redup">
                        {jejak.map((j, i) => (
                            <li key={`${j.label}-${i}`} className="flex items-center gap-1">
                                {i > 0 && <Ikon nama="kanan" className="h-4 w-4 text-garis-kuat" />}
                                {'href' in j ? (
                                    <Link
                                        href={j.href}
                                        className="rounded py-1 hover:text-utama-tua hover:underline"
                                    >
                                        {j.label}
                                    </Link>
                                ) : (
                                    <span aria-current="page" className="py-1 text-tinta">
                                        {j.label}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-1">
                        <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">
                            {judul}
                        </h1>
                        {petunjuk && (
                            <Petunjuk label={`Penjelasan halaman ${judul}`}>{petunjuk}</Petunjuk>
                        )}
                    </div>
                    {deskripsi && (
                        <div className="mt-0.5 max-w-2xl text-sm leading-relaxed text-redup">
                            {deskripsi}
                        </div>
                    )}
                </div>
                {aksi && <div className="flex shrink-0 flex-wrap gap-2">{aksi}</div>}
            </div>
            {children && <div className="mt-3">{children}</div>}
        </div>
    )
}
