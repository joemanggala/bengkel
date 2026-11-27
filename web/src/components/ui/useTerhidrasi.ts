// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useState } from 'react'

// true setelah komponen terpasang di browser (React selesai hidrasi).
//
// Sebelum itu, form React belum punya penangan submit: menekan tombol atau Enter membuat browser
// mengirim form dengan caranya sendiri (GET ke alamat yang sama), sehingga isian, termasuk kata
// sandi, masuk ke URL, riwayat browser, dan log server. Ini mudah terjadi di tablet yang lambat
// memuat JavaScript. Tombol kirim dinonaktifkan sampai nilai ini true; tanpa tombol kirim yang
// aktif, Enter juga tidak mengirim form.
export function useTerhidrasi(): boolean {
    const [terhidrasi, setTerhidrasi] = useState(false)
    useEffect(() => setTerhidrasi(true), [])
    return terhidrasi
}
