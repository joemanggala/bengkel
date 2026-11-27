// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import type { Meta } from '@/skema/meta'
import { UKURAN_PILIHAN, jumlahHalaman, rentangTampil } from '@/utils/query'
import Ikon from './Ikon'
import PilihPerHalaman from './PilihPerHalaman'
import Tombol from './Tombol'

type Props = {
    meta: Meta
    onHalaman: (halaman: number) => void
    // Tanpa ini pilihan baris per halaman tidak ditampilkan.
    onUkuran?: (ukuran: number) => void
    // Selama daftar dimuat ulang, tombol dikunci supaya halaman tidak meloncat dua kali.
    disabled?: boolean
}

// Bilah di dasar tabel: keterangan "Menampilkan 21–40 dari 45", pilihan baris per halaman
// (10, 20, 50), dan tombol Sebelumnya/Berikutnya. Sebelumnya/Berikutnya lebih mudah diketuk di
// layar sentuh daripada deretan nomor halaman, dan cukup untuk daftar yang sudah bisa dicari.
// Dipasang lewat properti `bawah` milik Tabel.
export default function Paginasi({ meta, onHalaman, onUkuran, disabled }: Props) {
    const total = jumlahHalaman(meta)
    const adaPilihan = onUkuran !== undefined && meta.total > UKURAN_PILIHAN[0]
    if (total <= 1 && !adaPilihan) return null
    return (
        <nav
            aria-label="Halaman daftar"
            className="flex flex-col gap-3 border-t border-garis bg-permukaan px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
        >
            <p className="text-[15px] text-redup">
                {rentangTampil(meta)}
                {total > 1 && (
                    <span>
                        , halaman {meta.page} dari {total}
                    </span>
                )}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                {adaPilihan && (
                    <PilihPerHalaman nilai={meta.limit} onUbah={onUkuran} disabled={disabled} />
                )}
                {total > 1 && (
                    <div className="flex gap-2">
                        <Tombol
                            varian="kecil"
                            disabled={disabled || meta.page <= 1}
                            onClick={() => onHalaman(meta.page - 1)}
                        >
                            <Ikon nama="kiri" className="h-4 w-4" />
                            Sebelumnya
                        </Tombol>
                        <Tombol
                            varian="kecil"
                            disabled={disabled || meta.page >= total}
                            onClick={() => onHalaman(meta.page + 1)}
                        >
                            Berikutnya
                            <Ikon nama="kanan" className="h-4 w-4" />
                        </Tombol>
                    </div>
                )}
            </div>
        </nav>
    )
}
