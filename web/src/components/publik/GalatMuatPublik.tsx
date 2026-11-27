// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import TombolMuatUlang from '@/components/panel/TombolMuatUlang'
import KotakPesan from '@/components/ui/KotakPesan'
import type { GalatApi } from '@/skema/galat'
import { pesanGalat } from '@/utils/galat'

// Pengganti isi halaman publik saat data dari server gagal dimuat (mis. backend mati atau sinyal
// hilang). Menjelaskan apa yang terjadi dan memberi jalan keluar, bukan layar kosong.
export default function GalatMuatPublik({ galat, judul }: { galat: GalatApi; judul: string }) {
    return (
        <KotakPesan jenis="galat" judul={judul} aksi={<TombolMuatUlang />}>
            {pesanGalat(galat)} Kalau tetap gagal, hubungi bengkel lewat WhatsApp.
        </KotakPesan>
    )
}
