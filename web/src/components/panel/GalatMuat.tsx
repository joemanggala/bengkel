// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import KotakPesan from '@/components/ui/KotakPesan'
import type { GalatApi } from '@/skema/galat'
import { pesanGalat } from '@/utils/galat'
import TombolMuatUlang from './TombolMuatUlang'

// Pengganti isi halaman saat data dari API gagal dimuat (mis. backend mati). Sesi yang habis
// (401) dan akses di luar peran (403) sudah dialihkan lebih dulu oleh arahkanBilaDitolak().
export default function GalatMuat({
    galat,
    judul = 'Data belum bisa dimuat',
}: {
    galat: GalatApi
    judul?: string
}) {
    return (
        <KotakPesan jenis="galat" judul={judul} aksi={<TombolMuatUlang />}>
            {pesanGalat(galat)}
        </KotakPesan>
    )
}
