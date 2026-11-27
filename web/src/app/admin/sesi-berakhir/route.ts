// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { NextRequest } from 'next/server'
import { alihkan } from '@/server/alihkan'
import { NAMA_COOKIE_SESI, alamatMasukLagi } from '@/utils/sesi'

// Server component tidak boleh mengubah cookie, jadi saat API membalas 401 halaman diarahkan
// ke sini: cookie yang sudah tidak berlaku dihapus, lalu staf dibawa ke halaman masuk. ?ke=
// (halaman asal) diteruskan hanya bila menunjuk halaman panel, supaya setelah masuk lagi staf
// kembali ke halaman yang tadi dibuka.
export function GET(request: NextRequest) {
    const ke = request.nextUrl.searchParams.get('ke')
    const balasan = alihkan(request, alamatMasukLagi(ke))
    balasan.cookies.delete({ name: NAMA_COOKIE_SESI, path: '/' })
    return balasan
}
