// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import KotakPesan from '@/components/ui/KotakPesan'
import Tombol from '@/components/ui/Tombol'
import type { GalatApi } from '@/skema/galat'
import { pesanGalat } from '@/utils/galat'

// Galat memuat daftar di komponen klien (mis. backend mati saat memuat ulang berkala). Data lama,
// bila ada, tetap tampil di bawahnya; tombol mencoba lagi tanpa memuat ulang seluruh halaman.
export default function GalatDaftar({
    galat,
    onCobaLagi,
}: {
    galat: GalatApi
    onCobaLagi: () => void
}) {
    return (
        <div className="mb-5">
            <KotakPesan
                jenis="galat"
                judul="Data belum bisa dimuat"
                aksi={
                    <Tombol varian="sekunder" onClick={onCobaLagi}>
                        Coba lagi
                    </Tombol>
                }
            >
                {pesanGalat(galat)}
            </KotakPesan>
        </div>
    )
}
