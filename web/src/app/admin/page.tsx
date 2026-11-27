// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { redirect } from 'next/navigation'
import { PATH_BERANDA } from '@/constants/menu'

// /admin langsung membuka Papan servis. Tanpa cookie sesi, middleware sudah lebih dulu mengarahkan ke
// halaman masuk (dan dari sana ke pemasangan awal bila aplikasi belum punya pemilik).
export default function HalamanAdmin() {
    redirect(PATH_BERANDA)
}
