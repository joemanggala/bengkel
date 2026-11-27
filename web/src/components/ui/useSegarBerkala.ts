// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useRef } from 'react'

export type HasilSiklus = 'ok' | 'gagal' | 'henti'

// Jeda sebelum siklus berikutnya: normal sesudah berhasil; sesudah gagal beruntun digandakan
// tiap kali sampai batas, supaya backend yang sedang mati tidak dihujani permintaan dari tiap
// tablet yang membuka halaman.
export const jedaBerikutnya = (
    jedaMs: number,
    gagalBeruntun: number,
    maksMs: number = jedaMs * 4,
): number => (gagalBeruntun <= 0 ? jedaMs : Math.min(jedaMs * 2 ** gagalBeruntun, maksMs))

type Opsi = { jedaMs: number; aktif: boolean }

// Memuat ulang diam-diam secara berkala untuk halaman yang datanya bisa diubah orang lain
// (papan servis, rincian SPK, daftar booking, halaman lacak). Aturannya:
//  - setTimeout berantai, bukan setInterval: siklus berikutnya baru dijadwalkan SETELAH siklus
//    ini selesai, jadi backend yang lambat tidak menumpuk permintaan;
//  - tab yang tersembunyi tidak memuat apa pun; saat tab tampak lagi, dimuat langsung;
//  - kembali online juga memuat langsung, tanpa menunggu jeda mundur yang mungkin sudah panjang;
//  - siklus yang mengembalikan 'henti' (sesi habis, SPK tidak ada lagi) menghentikan semuanya.
// `jalankan` boleh berganti identitas di tiap render; yang dipanggil selalu yang terbaru.
export function useSegarBerkala(
    jalankan: () => Promise<HasilSiklus>,
    { jedaMs, aktif }: Opsi,
): void {
    const terbaru = useRef(jalankan)
    useEffect(() => {
        terbaru.current = jalankan
    })

    useEffect(() => {
        if (!aktif) return
        let timer: number | undefined
        let berhenti = false
        let berjalan = false
        let gagalBeruntun = 0

        const tampak = () => document.visibilityState === 'visible'

        const jadwalkan = () => {
            window.clearTimeout(timer)
            timer = window.setTimeout(() => void siklus(), jedaBerikutnya(jedaMs, gagalBeruntun))
        }

        async function siklus(): Promise<void> {
            // Tab tersembunyi: tidak menjadwalkan apa-apa; saatTampak() yang membangunkan lagi.
            if (berhenti || berjalan || !tampak()) return
            berjalan = true
            let hasil: HasilSiklus
            try {
                hasil = await terbaru.current()
            } catch {
                hasil = 'gagal'
            }
            berjalan = false
            if (berhenti || hasil === 'henti') return
            gagalBeruntun = hasil === 'ok' ? 0 : gagalBeruntun + 1
            if (tampak()) jadwalkan()
        }

        const saatTampak = () => {
            if (!tampak() || berjalan) return
            window.clearTimeout(timer)
            void siklus()
        }

        document.addEventListener('visibilitychange', saatTampak)
        window.addEventListener('online', saatTampak)
        jadwalkan()
        return () => {
            berhenti = true
            window.clearTimeout(timer)
            document.removeEventListener('visibilitychange', saatTampak)
            window.removeEventListener('online', saatTampak)
        }
    }, [aktif, jedaMs])
}
