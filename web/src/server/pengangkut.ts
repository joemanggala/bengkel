// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { GALAT_TAK_TERHUBUNG, bacaBalasanApi } from '@/klien/balasan'
import { buatKlien } from '@/klien/buatKlien'
import type { KlienApi } from '@/klien/antarmuka'
import type { HasilApi } from '@/klien/hasil'
import { susunPermintaan, susunQuery, type OpsiPanggil, type Pengangkut } from '@/klien/pengangkut'
import { BATAS_WAKTU_MS, GALAT_TANPA_API_URL, alamatApi } from './api'

// Pengangkut untuk kode server: langsung ke backend, dengan token staf bila ada. Dipakai server
// component (profil outlet, sesi, halaman publik), server action (masuk, setup, keluar).
// Middleware punya fetch sendiri yang ringan (lihat src/server/peran.ts).
export function pengangkutServer(token?: string | null): Pengangkut {
    return async (rute: string, opsi: OpsiPanggil = {}): Promise<HasilApi<unknown>> => {
        const dasar = alamatApi()
        // Dikembalikan sebagai galat, bukan dilempar, supaya halaman bisa menampilkan pesannya.
        if (!dasar) return { ok: false, status: 0, galat: GALAT_TANPA_API_URL }

        const { headers, body } = susunPermintaan(opsi)
        if (token) headers.Authorization = `Bearer ${token}`

        let balasan: Response
        try {
            balasan = await fetch(`${dasar}/api${rute}${susunQuery(opsi.query)}`, {
                method: opsi.metode ?? 'GET',
                headers,
                body,
                // Data bengkel selalu milik satu sesi dan cepat berubah, jadi tidak pernah di-cache.
                cache: 'no-store',
                signal: AbortSignal.timeout(BATAS_WAKTU_MS),
            })
        } catch {
            return { ok: false, status: 0, galat: GALAT_TAK_TERHUBUNG }
        }
        return bacaBalasanApi(balasan)
    }
}

// Klien API untuk kode server. `token` kosong = tanpa Authorization (rute publik).
export const klienServer = (token?: string | null): KlienApi => buatKlien(pengangkutServer(token))
