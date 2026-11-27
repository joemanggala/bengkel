// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { PERAN_STAF, type PeranStaf } from '@/skema/staf'
import { alamatApi } from './api'

// Pembaca peran untuk middleware. Middleware jalan di runtime Edge, jadi berkas ini tidak boleh
// mengimpor next/headers, React, atau modul Node. Cookie sesi hanya berisi token, bukan peran,
// sehingga untuk halaman yang tidak untuk semua peran middleware bertanya langsung ke backend
// (GET /api/staff/me), sumber peran yang sebenarnya.

// Cukup singkat supaya navigasi tidak menggantung bila backend macet; penjaga di server
// (wajibPeran) tetap memeriksa lagi dan menampilkan galat yang jelas.
export const BATAS_WAKTU_PERAN_MS = 3000

export type HasilPeran =
    // Backend menjawab dan peran terbaca.
    | { status: 'peran'; peran: PeranStaf }
    // Backend menolak token (401): sesi sudah habis.
    | { status: 'habis' }
    // Tidak ada jawaban yang bisa dipakai (backend mati, lambat, atau jawabannya aneh). Middleware
    // membiarkan permintaan lewat; server component yang memutuskan dan menampilkan galatnya.
    | { status: 'tak-terjangkau' }

const peranDikenal = (nilai: unknown): nilai is PeranStaf =>
    (PERAN_STAF as readonly unknown[]).includes(nilai)

export async function bacaPeran(token: string, ambil: typeof fetch = fetch): Promise<HasilPeran> {
    const dasar = alamatApi()
    if (!dasar) return { status: 'tak-terjangkau' }

    // AbortController (bukan AbortSignal.timeout) karena dukungannya di runtime Edge lebih pasti.
    const pengendali = new AbortController()
    const penghitung = setTimeout(() => pengendali.abort(), BATAS_WAKTU_PERAN_MS)
    try {
        const balasan = await ambil(`${dasar}/api/staff/me`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
            cache: 'no-store',
            signal: pengendali.signal,
        })
        if (balasan.status === 401) return { status: 'habis' }
        if (!balasan.ok) return { status: 'tak-terjangkau' }
        const isi: unknown = await balasan.json()
        const peran = (isi as { data?: { role?: unknown } } | null)?.data?.role
        return peranDikenal(peran) ? { status: 'peran', peran } : { status: 'tak-terjangkau' }
    } catch {
        return { status: 'tak-terjangkau' }
    } finally {
        clearTimeout(penghitung)
    }
}
