// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import { pesanKodeField, type AturanField } from '@/utils/galat'

// Pembangun aturan zod untuk form di browser. Kalimat galatnya sama dengan yang dipakai saat API
// menolak data (pesanKodeField), jadi pengguna membaca teks yang sama dari mana pun galatnya
// datang. Backend tetap memeriksa ulang semuanya; validasi di browser hanya mempercepat umpan
// balik.

// "Dipangkas" di spec hanya membuang spasi, tab, CR, dan LF; trim() bawaan JavaScript juga
// membuang spasi lain (mis. NBSP) sehingga hasilnya bisa berbeda dengan backend.
export const pangkas = (teks: string): string => teks.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '')

// Panjang teks dihitung dalam code point, bukan unit UTF-16 seperti String.length, sehingga
// emoji dihitung satu.
export const panjangKarakter = (teks: string): number => [...teks].length

export const panjangByte = (teks: string): number => new TextEncoder().encode(teks).length

const kecilkanAsciiSaja = (teks: string): string =>
    teks.replace(/[A-Z]/g, (huruf) => huruf.toLowerCase())

export type OpsiTeks = AturanField & {
    dipangkas?: boolean
    // Email: hanya A-Z yang dikecilkan, huruf lain dibiarkan.
    kecilkanAscii?: boolean
    pola?: RegExp
}

const rapikan = (nilai: string, opsi: OpsiTeks): string => {
    const hasil = opsi.dipangkas ? pangkas(nilai) : nilai
    return opsi.kecilkanAscii ? kecilkanAsciiSaja(hasil) : hasil
}

// Satu field hanya diberi satu galat, dengan prioritas yang sama seperti backend:
// kosong -> panjang -> format.
export const kodeGalatTeks = (nilai: string, opsi: OpsiTeks): string | null => {
    const rapi = rapikan(nilai, opsi)
    if (rapi === '') return 'required'
    const panjang = opsi.satuan === 'byte' ? panjangByte(rapi) : panjangKarakter(rapi)
    if (opsi.min !== undefined && panjang < opsi.min) return 'too_short'
    if (opsi.maks !== undefined && panjang > opsi.maks) return 'too_long'
    if (opsi.pola && !opsi.pola.test(rapi)) return 'invalid_format'
    return null
}

export const teksWajib = (opsi: OpsiTeks) =>
    z
        .string({ error: pesanKodeField('required', opsi) })
        .superRefine((nilai, ctx) => {
            const kode = kodeGalatTeks(nilai, opsi)
            if (kode) ctx.addIssue({ code: 'custom', message: pesanKodeField(kode, opsi) })
        })
        .transform((nilai) => rapikan(nilai, opsi))

// Galat zod (pertama per field) diubah ke bentuk yang sama dengan pesan field dari API. Jalur
// bersarang ditulis bertitik (`items.0.quantity`), sama seperti `fields` dari API.
export const pesanDariZod = (galat: z.ZodError): Record<string, string> => {
    const hasil: Record<string, string> = {}
    for (const isu of galat.issues) {
        const nama = isu.path.map(String).join('.')
        if (nama && !(nama in hasil)) hasil[nama] = isu.message
    }
    return hasil
}
