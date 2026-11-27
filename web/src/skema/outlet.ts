// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import { skemaNomorHp } from './umum'

// Spec: spec/components/schemas/outlet.yaml. Profil satu-satunya outlet, dipakai halaman depan
// website, layar masuk staf, nota, halaman lacak servis, dan pesan WhatsApp. Setelah migration
// pertama: name "Nama Bengkel", phone null, field teks lain string kosong.
export const skemaOutlet = z.object({
    name: z.string(),
    // Kalimat pendek di bawah nama di halaman depan. Boleh kosong.
    tagline: z.string(),
    address: z.string(),
    // Nomor WhatsApp outlet (tombol WhatsApp di website), atau null bila belum diisi.
    phone: skemaNomorHp.nullable(),
    // Teks bebas, boleh berisi pergantian baris.
    openingHours: z.string(),
    // Tautan peta, atau string kosong. Bila terisi selalu diawali http:// atau https://.
    mapsUrl: z.string(),
    receiptFooter: z.string(),
})
export type Outlet = z.infer<typeof skemaOutlet>

// PUT /api/outlet mengganti seluruh profil, jadi semua field wajib dikirim. `phone` diketik
// pengguna dan dinormalkan backend (08..., +628..., 628...), atau null = belum punya nomor.
export type UbahOutletRequest = {
    name: string
    tagline: string
    address: string
    phone: string | null
    openingHours: string
    mapsUrl: string
    receiptFooter: string
}
