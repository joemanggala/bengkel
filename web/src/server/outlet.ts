// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { cache } from 'react'
import { NAMA_OUTLET_BAWAAN } from '@/constants/outlet'
import type { HasilApi } from '@/klien/hasil'
import type { Outlet } from '@/skema/outlet'
import { klienServer } from './pengangkut'

// GET /api/outlet publik (tanpa token), dipakai halaman depan website, halaman masuk, dan kerangka
// panel. cache() membuat layout dan halaman dalam satu permintaan cukup bertanya sekali.
export const profilOutlet = cache((): Promise<HasilApi<Outlet>> => klienServer().profilOutlet())

// Nama untuk bilah atas dan halaman masuk. Bila backend belum bisa dihubungi, kerangka tetap
// tampil dengan nama bawaan migration; pesan galatnya ditampilkan oleh bagian lain halaman.
export const namaOutlet = async (): Promise<string> => {
    const hasil = await profilOutlet()
    return hasil.ok ? hasil.data.name : NAMA_OUTLET_BAWAAN
}

// Status pemasangan: "perlu setup" selama belum ada akun staf sama sekali.
export const statusSetup = cache(() => klienServer().statusSetup())
