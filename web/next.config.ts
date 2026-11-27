// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { NextConfig } from 'next'

// Header keamanan untuk semua halaman. Aplikasi ini tidak memakai iframe sama sekali, jadi
// halamannya tidak boleh dibingkai situs lain (clickjacking). Referrer hanya dikirim ke situs
// sendiri: alamat pelacak pelanggan memuat token rahasia dan tidak boleh bocor lewat Referer ke
// situs luar. Sengaja "same-origin", bukan "no-referrer": yang terakhir membuat sebagian browser
// mengirim "Origin: null" pada form POST biasa, yang ditolak pemeriksaan asal di BFF.
// HSTS dipasang di Nginx sesudah HTTPS terbukti stabil (lihat panduan upload ke VPS).
const HEADER_KEAMANAN = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    { key: 'Referrer-Policy', value: 'same-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
    poweredByHeader: false,
    devIndicators: false,
    async headers() {
        return [{ source: '/:path*', headers: HEADER_KEAMANAN }]
    },
}

export default nextConfig
