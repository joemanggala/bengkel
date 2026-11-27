// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { HasilApi } from './hasil'

// Pengangkut = satu-satunya bagian klien API yang tahu CARA permintaan sampai ke backend. Fungsi
// per operasi (src/klien/buatKlien.ts) hanya tahu rute dan bentuk datanya. Dengan pemisahan ini
// kode yang sama dipakai di tiga tempat:
//   - server Next.js, langsung ke backend dengan token (src/server/pengangkut.ts);
//   - browser lewat BFF staf /bff/staf/* (cookie httpOnly ditambahkan server);
//   - browser lewat BFF publik /bff/public/* (tanpa cookie).
// Tes cukup memakai pengangkut palsu.

export type MetodeHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type OpsiPanggil = {
    metode?: MetodeHttp
    // Badan JSON. Semua rute API bengkel memakai JSON; tidak ada unggahan berkas.
    badan?: unknown
    // Nilai undefined dan string kosong dibuang.
    query?: Record<string, string | number | boolean | undefined>
}

// `rute` adalah path API tanpa awalan /api, selalu berawalan garis miring: "/work-orders",
// "/work-orders/S-0001/status", "/public/services".
export type Pengangkut = (rute: string, opsi?: OpsiPanggil) => Promise<HasilApi<unknown>>

// Query string dari OpsiPanggil.query, dengan tanda tanya di depan bila ada isinya. Memakai
// toString() (bukan URLSearchParams.size) karena browser tablet lama belum tentu mengenal `size`.
export function susunQuery(query: OpsiPanggil['query']): string {
    const params = new URLSearchParams()
    for (const [kunci, nilai] of Object.entries(query ?? {})) {
        if (nilai !== undefined && nilai !== '') params.set(kunci, String(nilai))
    }
    const teks = params.toString()
    return teks ? `?${teks}` : ''
}

// Badan dan header untuk fetch dari OpsiPanggil, dipakai pengangkut server dan browser.
export function susunPermintaan(opsi: OpsiPanggil): {
    headers: Record<string, string>
    body: string | undefined
} {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (opsi.badan === undefined) return { headers, body: undefined }
    headers['Content-Type'] = 'application/json'
    return { headers, body: JSON.stringify(opsi.badan) }
}
