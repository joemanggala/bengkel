// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'

// Keterangan paginasi daftar (spec: Meta). `total` = jumlah seluruh baris yang cocok dengan
// filter, bukan jumlah di halaman ini.
export const skemaMeta = z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(50),
    total: z.number().int().min(0),
})

export type Meta = z.infer<typeof skemaMeta>

// Daftar berpaginasi (pelanggan, cari plat, riwayat servis, sparepart, kartu stok, booking, SPK)
// selalu menyertakan meta. Daftar kecil tanpa paginasi (staf, mekanik, jasa, jasa publik)
// membalas {data: [...]} saja.
