// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { PATH_BERANDA, bolehMembuka, halamanPanelDikenal } from '@/constants/menu'
import type { PeranStaf } from '@/skema/staf'

// Bagian sesi staf yang tidak bergantung pada Next.js, supaya bisa dipakai middleware, route
// handler, server action, dan tes. Hanya staf (pemilik, kasir, mekanik) yang punya sesi;
// pelanggan memegang token publik (booking, lacak servis) di alamat halaman, bukan cookie.

export const NAMA_COOKIE_SESI = 'sesi_staf'

// Sama dengan umur sesi staf di backend (30 hari bergeser). Middleware menulis ulang cookie
// setiap kali halaman panel dibuka, jadi cookie ikut bergeser selama staf aktif.
export const UMUR_SESI_DETIK = 30 * 24 * 60 * 60

export const PATH_MASUK = '/admin/masuk'
export const PATH_SETUP = '/admin/setup'
export const PATH_SESI_BERAKHIR = '/admin/sesi-berakhir'
export const PATH_MASUK_SESI_BERAKHIR = `${PATH_MASUK}?sesi=berakhir`

// Header yang dipasang middleware berisi path halaman yang sedang dibuka, supaya server component
// bisa membawa staf kembali ke halaman itu setelah sesinya habis (?ke=).
export const HEADER_PATH = 'x-bengkel-path'

// Setelah pemasangan awal, pemilik dibawa ke profil outlet: nama bengkel masih "Nama Bengkel",
// dan alamat, nomor WhatsApp, serta jam buka di website masih kosong.
export const PATH_SETELAH_SETUP = '/admin/outlet'

export type OpsiCookieSesi = {
    httpOnly: true
    sameSite: 'lax'
    secure: boolean
    path: '/'
    maxAge: number
}

// httpOnly menjauhkan token dari JavaScript halaman; SameSite=Lax menolak cookie ikut terkirim
// dari form situs lain, tetapi tetap terkirim saat staf membuka tautan ke aplikasi ini.
export const opsiCookieSesi = (aman: boolean): OpsiCookieSesi => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: aman,
    path: '/',
    maxAge: UMUR_SESI_DETIK,
})

// Atribut Secure mengikuti protokol permintaan, bukan NODE_ENV: browser menolak menyimpan cookie
// Secure yang diterima lewat http://, sehingga build produksi yang dibuka tablet di jaringan lokal
// (http://192.168.x.x:3800) tidak akan pernah bisa masuk. Protokol dibaca dari x-forwarded-proto
// (diisi reverse proxy, atau oleh Next.js sendiri bila tanpa proxy). Env COOKIE_SECURE=true/false
// memaksa nilainya, mis. bila proxy HTTPS tidak meneruskan header itu. Di produksi yang memakai
// HTTPS, hasilnya Secure.
export const cookieAman = (protokol: string | null | undefined, paksa?: string): boolean => {
    const env = paksa?.trim().toLowerCase()
    if (env === 'true') return true
    if (env === 'false') return false
    return (protokol ?? '').split(',')[0].trim().toLowerCase().replace(/:$/, '') === 'https'
}

// ?ke= hanya boleh menunjuk halaman panel (menu dan turunannya). Halaman lain (penghapus
// cookie, /bff/..., halaman masuk dan setup) dan bentuk yang bisa ditafsirkan browser sebagai
// alamat situs lain (//x, /\x, /.//x, %2F) ditolak, supaya tautan masuk tidak bisa dipakai
// mengalihkan staf ke situs lain.
export const amankanTujuan = (ke: unknown): string | null => {
    if (typeof ke !== 'string' || ke.length > 500) return null
    for (const huruf of ke) if (huruf.charCodeAt(0) < 0x20 || huruf === '\\') return null
    const path = ke.split(/[?#]/)[0]
    // Segmen path panel hanya huruf, angka, dan tanda hubung (UUID, nomor SPK S-0001).
    if (!/^(\/[A-Za-z0-9-]+)+$/.test(path)) return null
    return halamanPanelDikenal(path) ? ke : null
}

// Tujuan setelah masuk: ?ke= bila aman dan boleh dibuka peran itu. Kasir yang diarahkan ke
// halaman pemilik, atau mekanik ke halaman kasir, langsung ke Papan servis (dari sana pun mereka
// akan dipentalkan lagi).
export const tujuanSetelahMasuk = (peran: PeranStaf, ke?: unknown): string => {
    const aman = amankanTujuan(ke)
    if (!aman) return PATH_BERANDA
    return bolehMembuka(peran, aman.split(/[?#]/)[0]) ? aman : PATH_BERANDA
}

// Alamat penghapus cookie untuk sesi yang habis, membawa halaman asal bila aman.
export const alamatSesiBerakhir = (asal: string | null | undefined): string => {
    const aman = amankanTujuan(asal)
    return aman ? `${PATH_SESI_BERAKHIR}?ke=${encodeURIComponent(aman)}` : PATH_SESI_BERAKHIR
}

// Alamat halaman masuk setelah sesi habis, membawa halaman asal bila aman.
export const alamatMasukLagi = (asal: string | null | undefined): string => {
    const aman = amankanTujuan(asal)
    return aman
        ? `${PATH_MASUK_SESI_BERAKHIR}&ke=${encodeURIComponent(aman)}`
        : PATH_MASUK_SESI_BERAKHIR
}

// Alamat halaman masuk untuk staf yang belum punya sesi sama sekali.
export const alamatMasuk = (asal: string | null | undefined): string => {
    const aman = amankanTujuan(asal)
    return aman ? `${PATH_MASUK}?ke=${encodeURIComponent(aman)}` : PATH_MASUK
}
