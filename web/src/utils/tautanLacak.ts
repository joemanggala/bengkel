// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { alamatLacakServis } from '@/constants/publik'

// Alamat website publik untuk tautan yang dibagikan ke pelanggan (tautan lacak di nota cetak,
// tombol Salin, dan Buka). Backend merangkai tautan di pesan WhatsApp dari PUBLIC_WEB_URL miliknya
// ({PUBLIC_WEB_URL}/servis/<token>, spec/whatsapp.md). Web membaca env dengan nama yang sama
// (src/server/webPublik.ts) supaya tautan di kertas dan di ponsel pelanggan sama persis. Alamat
// browser staf tidak bisa dipakai: kasir sering membuka panel lewat http://localhost:3800 atau IP
// jaringan lokal, yang tidak bisa dibuka HP pelanggan.
//
//   env      PUBLIC_WEB_URL diisi dan sah: dipakai apa adanya (garis miring akhir sudah dibuang).
//   peramban hanya saat pengembangan, bila env kosong: memakai alamat browser, dengan catatan.
//   galat    env tidak sah, atau kosong di produksi: tautan tidak ditampilkan, galatnya ya.
export type AsalWebPublik =
    { sumber: 'env'; asal: string } | { sumber: 'peramban' } | { sumber: 'galat'; pesan: string }

export type TautanLacak = {
    // null selama belum bisa disusun (galat, atau alamat browser belum terbaca).
    tautan: string | null
    // Catatan untuk staf saat tautan memakai alamat browser (hanya pengembangan).
    catatan: string | null
    galat: string | null
}

export const CATATAN_ALAMAT_PERAMBAN =
    'PUBLIC_WEB_URL web belum diisi, jadi tautan ini memakai alamat browser dan bisa berbeda dengan tautan di pesan WhatsApp. Isi PUBLIC_WEB_URL di web/.env.local sama dengan milik backend.'

// `asalPeramban` = window.location.origin, atau '' bila belum terbaca (render server dan render
// pertama di browser harus sama, jadi alamat browser baru dibaca sesudah tampil).
export function susunTautanLacak(
    asal: AsalWebPublik,
    trackingToken: string,
    asalPeramban: string,
): TautanLacak {
    const jalur = alamatLacakServis(trackingToken)
    if (asal.sumber === 'galat') return { tautan: null, catatan: null, galat: asal.pesan }
    if (asal.sumber === 'env') return { tautan: `${asal.asal}${jalur}`, catatan: null, galat: null }
    return {
        tautan: asalPeramban ? `${asalPeramban}${jalur}` : null,
        catatan: CATATAN_ALAMAT_PERAMBAN,
        galat: null,
    }
}
