// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { NextResponse, type NextRequest } from 'next/server'
import { PATH_AKSES_DITOLAK, bolehMembuka, halamanTerbatas } from '@/constants/menu'
import { alihkan } from '@/server/alihkan'
import { bacaPeran } from '@/server/peran'
import {
    HEADER_PATH,
    NAMA_COOKIE_SESI,
    alamatMasuk,
    alamatSesiBerakhir,
    cookieAman,
    opsiCookieSesi,
} from '@/utils/sesi'

// Protokol permintaan: x-forwarded-proto dari reverse proxy (atau dari Next.js sendiri), selain
// itu protokol alamatnya.
const protokolPermintaan = (request: NextRequest): string =>
    request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol

// Penyaring pertama panel staf, dua lapis:
//
// 1. Tanpa cookie sesi, halaman panel tidak dirender sama sekali (ke halaman masuk, dengan ?ke=).
// 2. Untuk halaman yang tidak untuk semua peran (SPK baru, Booking, Pelanggan untuk pemilik dan
//    kasir; Jasa, Sparepart, Staf, Outlet, Rekap khusus pemilik), peran dibaca dari backend dan
//    peran yang tidak berhak dialihkan ke Papan servis dengan penjelasan. Peran tidak disimpan di
//    cookie: cookie yang bisa diubah pemakai tidak boleh menentukan akses, dan peran yang diubah
//    pemilik harus langsung berlaku.
//
// Ini baru lapisan pertama. Penjaga yang sebenarnya ada di server component
// (src/server/sesi.ts: wajibStaf, wajibKasir, wajibPemilik), dan di atas semuanya backend
// menolak peran yang tidak berhak dengan 403 di setiap rute.
//
// Website publik (/, /booking, /servis) tidak lewat sini sama sekali: pelanggan tidak punya sesi.
export async function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl
    const asal = pathname + search
    const token = request.cookies.get(NAMA_COOKIE_SESI)?.value
    if (!token) return alihkan(request, alamatMasuk(asal))

    if (halamanTerbatas(pathname)) {
        const hasil = await bacaPeran(token)
        // Token ditolak backend: lewat penghapus cookie supaya tidak berputar-putar di sini.
        if (hasil.status === 'habis') return alihkan(request, alamatSesiBerakhir(asal))
        if (hasil.status === 'peran' && !bolehMembuka(hasil.peran, pathname)) {
            return alihkan(request, PATH_AKSES_DITOLAK)
        }
    }

    // Path halaman diteruskan ke server component lewat header permintaan, supaya sesi yang
    // ternyata habis bisa dialihkan ke halaman masuk dengan ?ke= halaman ini (lihat server/sesi.ts).
    const header = new Headers(request.headers)
    header.set(HEADER_PATH, asal)
    const lanjut = NextResponse.next({ request: { headers: header } })
    // Sesi di backend bergeser 30 hari setiap dipakai. Cookie ditulis ulang dengan umur penuh
    // supaya staf yang membuka aplikasi setiap hari tidak dikeluarkan pada hari ke-30.
    lanjut.cookies.set(
        NAMA_COOKIE_SESI,
        token,
        opsiCookieSesi(cookieAman(protokolPermintaan(request), process.env.COOKIE_SECURE)),
    )
    return lanjut
}

// Harus berupa literal agar bisa dibaca Next.js saat build. Halaman masuk, setup, dan penghapus
// cookie (/admin/masuk, /admin/setup, /admin/sesi-berakhir) sengaja tidak ada di sini. Tes di
// src/__tests__/middleware.test.ts memastikan setiap menu panel tercakup.
export const config = {
    matcher: [
        '/admin',
        '/admin/papan/:path*',
        '/admin/spk/:path*',
        '/admin/booking/:path*',
        '/admin/pelanggan/:path*',
        '/admin/jasa/:path*',
        '/admin/sparepart/:path*',
        '/admin/staf/:path*',
        '/admin/outlet/:path*',
        '/admin/rekap/:path*',
        '/admin/komponen/:path*',
    ],
}
