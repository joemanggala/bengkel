// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { GalatApi } from '@/skema/galat'

// Pengaturan koneksi ke backend, hanya untuk kode server (server component, server action, route
// handler, middleware).

// Alamat bawaan backend Laravel saat pengembangan (lihat tabel port di docs/menjalankan.md).
export const ALAMAT_API_BAWAAN = 'http://localhost:8802'

// Cukup longgar untuk bcrypt cost 12 di server yang sedang sibuk, tetapi tetap ada batasnya
// supaya halaman tidak menggantung tanpa akhir bila backend macet.
export const BATAS_WAKTU_MS = 15_000

export const GALAT_TANPA_API_URL: GalatApi = {
    code: 'internal_error',
    message: 'API_URL belum diisi. Salin web/.env.example ke .env.local lalu isi alamat backend.',
}

// API_URL sengaja tanpa awalan NEXT_PUBLIC_: alamat backend dan token hanya dipakai di server
// Next.js, jadi browser tidak pernah berbicara langsung dengan backend. Selama pengembangan,
// env yang kosong jatuh ke backend lokal; di produksi wajib diisi supaya salah konfigurasi
// terlihat sebagai galat, bukan diam-diam memanggil localhost.
export const alamatApi = (): string | null => {
    const dariEnv = process.env.API_URL?.trim().replace(/\/+$/, '')
    if (dariEnv) return dariEnv
    return process.env.NODE_ENV === 'production' ? null : ALAMAT_API_BAWAAN
}
