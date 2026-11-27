// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState, type ReactNode } from 'react'
import Dialog from './Dialog'
import Tombol from './Tombol'

type Props = {
    terbuka: boolean
    judul: string
    // Penjelasan akibat aksinya, mis. "SPK S-0007 akan dibatalkan dan tidak bisa dibuka lagi."
    deskripsi: ReactNode
    labelKonfirmasi: string
    // true untuk aksi yang sulit dibatalkan (membatalkan SPK, membuat ulang tautan lacak): tombolnya merah.
    berbahaya?: boolean
    // Dijalankan saat konfirmasi ditekan. Dialog tertutup sendiri bila hasilnya tidak melempar
    // galat; pemanggil menutupnya lewat onTutup setelah menampilkan hasilnya (toast, dsb.).
    onKonfirmasi: () => Promise<void> | void
    onTutup: () => void
}

// Dialog konfirmasi dua tombol (Batal dan aksi). Tombol aksi terkunci selama proses berjalan, jadi
// ketukan ganda di layar sentuh tidak mengirim aksi dua kali.
export default function DialogKonfirmasi({
    terbuka,
    judul,
    deskripsi,
    labelKonfirmasi,
    berbahaya,
    onKonfirmasi,
    onTutup,
}: Props) {
    const [sibuk, setSibuk] = useState(false)

    const konfirmasi = async () => {
        setSibuk(true)
        try {
            await onKonfirmasi()
        } finally {
            setSibuk(false)
        }
    }

    return (
        <Dialog
            terbuka={terbuka}
            judul={judul}
            deskripsi={deskripsi}
            sibuk={sibuk}
            onTutup={onTutup}
        >
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Tombol varian="sekunder" onClick={onTutup} disabled={sibuk}>
                    Batal
                </Tombol>
                <Tombol varian={berbahaya ? 'bahaya' : 'primer'} sibuk={sibuk} onClick={konfirmasi}>
                    {labelKonfirmasi}
                </Tombol>
            </div>
        </Dialog>
    )
}
