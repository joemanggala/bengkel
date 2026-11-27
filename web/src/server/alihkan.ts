// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { NextResponse } from 'next/server'

// Pengalihan ke halaman lain di situs ini, dengan alamat lengkap yang dibangun dari Host yang
// SEBENARNYA dipakai browser.
//
// Kenapa bukan `NextResponse.redirect(new URL(alamat, request.url))`? Di server produksi
// (`next start`), host di `request.url` adalah milik server itu sendiri (mis. localhost:3800),
// bukan alamat yang dibuka browser. Hasilnya: di belakang Nginx staf yang sesinya habis dilempar
// ke https://localhost:3800/..., dan tablet kasir yang membuka http://192.168.1.20:3800 dilempar
// ke localhost juga. Tes E2E tidak menangkapnya karena selalu berjalan di localhost.
//
// Kenapa bukan Location relatif? Middleware Next.js memproses header Location dengan `new URL()`
// tanpa basis dan menjawab 500 bila nilainya relatif.
const POLA_HOST = /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:.]+\])(?::[0-9]{1,5})?$/i

const pertama = (nilai: string | null): string => nilai?.split(',')[0]?.trim() ?? ''

// Asal (skema + host) permintaan: Host (atau X-Forwarded-Host dari proxy) dan skema dari
// X-Forwarded-Proto bila ada. Host yang bentuknya bukan nama host sah (mis. berisi "/", "@", atau
// spasi) tidak dipercaya; `cadangan` dipakai sebagai gantinya.
export function asalPermintaan(
    headers: Headers,
    protokolCadangan: string,
    cadangan: string,
): string {
    const host = pertama(headers.get('x-forwarded-host')) || pertama(headers.get('host'))
    if (!POLA_HOST.test(host)) return cadangan
    const skema = pertama(headers.get('x-forwarded-proto')).toLowerCase() || protokolCadangan
    if (skema !== 'http' && skema !== 'https') return cadangan
    return `${skema}://${host}`
}

// Hanya path dalam situs ini yang boleh: diawali satu "/" dan bukan "//" (alamat tanpa skema ke
// situs lain) atau "/\" (diperlakukan browser sama dengan "//"). Dengan begitu `alamat` tidak bisa
// mengganti asal yang sudah dipilih di atas.
export function alihkan(
    request: { headers: Headers; nextUrl: { protocol: string; origin: string } },
    alamat: string,
    status: 307 | 303 = 307,
): NextResponse {
    if (!alamat.startsWith('/') || alamat.startsWith('//') || alamat.startsWith('/\\')) {
        throw new Error(`pengalihan hanya ke path dalam situs ini, bukan "${alamat}"`)
    }
    const asal = asalPermintaan(
        request.headers,
        request.nextUrl.protocol.replace(/:$/, ''),
        request.nextUrl.origin,
    )
    return NextResponse.redirect(new URL(alamat, asal), status)
}
