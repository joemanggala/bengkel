// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Aturan plat nomor persis seperti spec (PlatMasukan): kunci untuk keunikan dan pencarian (huruf
// besar tanpa spasi, B1234XYZ) dan tampilan (B 1234 XYZ). Kasir mengetik plat dalam berbagai
// bentuk; tanpa normalisasi yang sama dengan backend, form bisa menerima plat yang lalu ditolak.

export type HasilPlat =
    | { ok: true; kunci: string; tampilan: string }
    | { ok: false; kode: 'required' | 'invalid_format' | 'too_short' | 'too_long' }

// Langkah 2 di spec: pangkas spasi, tab, CR, LF di awal dan akhir, buang semua spasi, tanda
// hubung, dan titik di mana pun, lalu ubah huruf a-z menjadi A-Z (huruf lain tidak disentuh).
export const kunciPlatMentah = (teks: string): string =>
    teks
        .replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '')
        .replace(/[ .-]/g, '')
        .replace(/[a-z]/g, (h) => h.toUpperCase())

// Tampilan dari kunci: huruf depan, angka, huruf belakang (boleh kosong) dipisah satu spasi; kunci
// yang tidak mengikuti pola itu ditampilkan apa adanya (keputusan Bagian 0a nomor 0a-12).
export const tampilanPlat = (kunci: string): string => {
    const cocok = /^([A-Z]+)([0-9]+)([A-Z]*)$/.exec(kunci)
    if (!cocok) return kunci
    return [cocok[1], cocok[2], cocok[3]].filter((b) => b !== '').join(' ')
}

export function normalkanPlat(teks: string): HasilPlat {
    const kunci = kunciPlatMentah(teks)
    if (kunci === '') return { ok: false, kode: 'required' }
    if (!/^[A-Z][A-Z0-9]*$/.test(kunci)) return { ok: false, kode: 'invalid_format' }
    if (kunci.length < 2) return { ok: false, kode: 'too_short' }
    if (kunci.length > 12) return { ok: false, kode: 'too_long' }
    return { ok: true, kunci, tampilan: tampilanPlat(kunci) }
}
