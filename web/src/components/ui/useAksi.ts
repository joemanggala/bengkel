// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useCallback, useRef, useState } from 'react'
import type { HasilApi } from '@/klien/hasil'
import { PESAN_TIDAK_PASTI, hasilTidakPasti } from '@/klien/peramban'
import { pesanGalat } from '@/utils/galat'
import { useToast } from './Toast'

type OpsiAksi<T> = {
    // Toast sesudah berhasil; kosong = tanpa toast.
    berhasil?: string | ((data: T) => string)
    // Dipanggil sesudah berhasil, mis. memasang data SPK baru ke layar.
    sesudah?: (data: T) => void
    // Dipanggil sesudah hasil tidak pasti (koneksi putus di tengah), mis. memuat ulang data,
    // supaya staf memeriksa dulu sebelum mengulang aksi yang mungkin sudah tercatat.
    muatUlang?: () => void
    // false = galat tidak ditampilkan sebagai toast (pemanggil menampilkannya sendiri di form).
    toastGalat?: boolean
}

// Menjalankan satu aksi tulis dari tombol (ubah status, konfirmasi booking, hapus item):
// tombol dikunci selama berjalan (`sibuk` berisi nama aksinya), hasilnya diumumkan lewat toast,
// dan galat memakai kalimat dari backend (mis. "Stok sparepart tidak cukup: ..."). Satu aksi
// sekaligus: ketukan ganda tidak mengirim dua kali.
export function useAksi() {
    const { tampilkanToast } = useToast()
    const [sibuk, setSibuk] = useState<string | null>(null)
    const berjalan = useRef(false)

    const jalankan = useCallback(
        async <T>(
            nama: string,
            aksi: () => Promise<HasilApi<T>>,
            opsi: OpsiAksi<T> = {},
        ): Promise<HasilApi<T> | null> => {
            if (berjalan.current) return null
            berjalan.current = true
            setSibuk(nama)
            try {
                const hasil = await aksi()
                if (hasil.ok) {
                    opsi.sesudah?.(hasil.data)
                    const pesan =
                        typeof opsi.berhasil === 'function'
                            ? opsi.berhasil(hasil.data)
                            : opsi.berhasil
                    if (pesan) tampilkanToast(pesan)
                } else if (hasilTidakPasti(hasil)) {
                    tampilkanToast(PESAN_TIDAK_PASTI, 'galat')
                    opsi.muatUlang?.()
                } else if (opsi.toastGalat !== false) {
                    tampilkanToast(pesanGalat(hasil.galat), 'galat')
                }
                return hasil
            } finally {
                berjalan.current = false
                setSibuk(null)
            }
        },
        [tampilkanToast],
    )

    return { sibuk, jalankan }
}
