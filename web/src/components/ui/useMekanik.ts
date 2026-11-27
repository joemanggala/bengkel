// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useState } from 'react'
import { klienStaf } from '@/klien/peramban'
import type { StafRingkas } from '@/skema/staf'
import type { OpsiPilihan } from './Pilihan'

// Mekanik aktif untuk pilihan penugasan, dari GET /api/mechanics (pemilik dan kasir; keputusan
// Bagian 0a nomor 0a-2, karena GET /api/staff khusus pemilik). `aktif` false = tidak memuat,
// mis. untuk mekanik yang memang tidak boleh memanggil rute ini.
export function useMekanik(aktif = true): StafRingkas[] {
    const [mekanik, setMekanik] = useState<StafRingkas[]>([])
    useEffect(() => {
        if (!aktif) return
        let batal = false
        void klienStaf()
            .daftarMekanik()
            .then((hasil) => {
                if (!batal && hasil.ok) setMekanik(hasil.data)
            })
        return () => {
            batal = true
        }
    }, [aktif])
    return mekanik
}

// Opsi pilihan mekanik. Mekanik yang sedang tertera di SPK tetapi sudah nonaktif (tidak ada di
// daftar) tetap dimunculkan supaya pilihannya tidak tiba-tiba kosong.
export const opsiMekanik = (
    mekanik: readonly StafRingkas[],
    sekarang?: StafRingkas | null,
): OpsiPilihan[] => {
    const opsi = mekanik.map((m) => ({ nilai: m.staffId, label: m.name }))
    if (sekarang && !mekanik.some((m) => m.staffId === sekarang.staffId)) {
        opsi.push({ nilai: sekarang.staffId, label: `${sekarang.name} (nonaktif)` })
    }
    return opsi
}
