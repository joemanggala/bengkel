// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { AsalWebPublik } from '@/utils/tautanLacak'

// PUBLIC_WEB_URL web: alamat website yang dibuka pelanggan, sama dengan PUBLIC_WEB_URL backend
// (lihat src/utils/tautanLacak.ts). Hanya dibaca server, saat permintaan (bukan saat build), lalu
// diteruskan ke komponen klien lewat props; sengaja tanpa awalan NEXT_PUBLIC_ supaya satu hasil
// build bisa dipakai untuk domain mana pun, sama seperti API_URL.

export const GALAT_PUBLIC_WEB_URL_KOSONG =
    'PUBLIC_WEB_URL web belum diisi, jadi tautan lacak tidak bisa disusun. Isi env PUBLIC_WEB_URL server web dengan alamat website yang sama dengan PUBLIC_WEB_URL backend, mis. https://bengkelku.id.'

export const GALAT_PUBLIC_WEB_URL_TIDAK_SAH =
    'PUBLIC_WEB_URL web harus diawali http:// atau https:// tanpa spasi, mis. https://bengkelku.id.'

// Aturan sama dengan backend (spec "Env bersama backend", Settings::publicWebUrl): dipangkas
// (spasi, tab, CR, LF), garis miring akhir dibuang, wajib diawali http:// atau https:// lalu
// alamat, dan tanpa spasi di mana pun. Kosong saat pengembangan jatuh ke alamat browser; kosong di
// produksi adalah galat yang menyebut PUBLIC_WEB_URL, bukan diam-diam memakai alamat browser kasir
// (yang bisa saja localhost) di nota pelanggan.
export function bacaAsalWebPublik(
    nilai: string | undefined = process.env.PUBLIC_WEB_URL,
    produksi: boolean = process.env.NODE_ENV === 'production',
): AsalWebPublik {
    const asal = (nilai ?? '').replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').replace(/\/+$/, '')
    if (asal === '') {
        return produksi
            ? { sumber: 'galat', pesan: GALAT_PUBLIC_WEB_URL_KOSONG }
            : { sumber: 'peramban' }
    }
    if (!/^https?:\/\/[^/\s]/.test(asal) || /\s/.test(asal)) {
        return { sumber: 'galat', pesan: GALAT_PUBLIC_WEB_URL_TIDAK_SAH }
    }
    return { sumber: 'env', asal }
}
