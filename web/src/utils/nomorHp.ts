// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Aturan nomor HP Indonesia persis seperti spec (NomorHpMasukan), supaya form di browser menolak
// isian yang sama dengan yang akan ditolak backend, dengan kode galat yang sama. Backend tetap
// memeriksa ulang; yang dikirim ke API tetap teks ketikan pengguna.
//
// Urutan pemeriksaan sengaja berbeda dari prioritas umum KodeField (format sebelum panjang),
// karena panjang baru bisa dihitung setelah awalannya dikenali.

export type HasilNomorHp =
    | { ok: true; seragam: string }
    | { ok: false; kode: 'required' | 'invalid_format' | 'too_short' | 'too_long' }

// Langkah 2 di spec: pangkas spasi, tab, CR, LF di awal dan akhir, lalu buang semua spasi dan
// tanda hubung di mana pun.
const bersihkan = (teks: string): string =>
    teks.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').replace(/[ -]/g, '')

export function normalkanNomorHp(teks: string): HasilNomorHp {
    const bersih = bersihkan(teks)
    if (bersih === '') return { ok: false, kode: 'required' }
    if (!/^(\+62|62|0)8[0-9]*$/.test(bersih)) return { ok: false, kode: 'invalid_format' }
    const sisa = bersih.startsWith('+62')
        ? bersih.slice(3)
        : bersih.startsWith('62')
          ? bersih.slice(2)
          : bersih.slice(1)
    const seragam = `62${sisa}`
    if (seragam.length < 10) return { ok: false, kode: 'too_short' }
    if (seragam.length > 15) return { ok: false, kode: 'too_long' }
    return { ok: true, seragam }
}

// Tautan wa.me untuk tombol WhatsApp di website. Nomor outlet di API sudah berbentuk seragam
// 628..., yang memang diminta wa.me (tanpa +, tanpa 0 di depan).
export const tautanWhatsApp = (nomorSeragam: string, pesan?: string): string => {
    const dasar = `https://wa.me/${nomorSeragam}`
    return pesan ? `${dasar}?text=${encodeURIComponent(pesan)}` : dasar
}
