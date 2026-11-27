// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Rumus kontras WCAG 2.x, dipakai tes untuk memeriksa token warna di globals.css. Teks biasa
// butuh minimal 4,5:1 (AA); tepi kotak isian dan cincin fokus minimal 3:1.

const kanal = (nilai: number): number => {
    const s = nilai / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export const luminansi = (hex: string): number => {
    const cocok = /^#([0-9a-f]{6})$/i.exec(hex)
    if (!cocok) throw new Error(`Warna harus berbentuk #rrggbb: ${hex}`)
    const n = parseInt(cocok[1], 16)
    return (
        0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255)
    )
}

export const rasioKontras = (a: string, b: string): number => {
    const [terang, gelap] = [luminansi(a), luminansi(b)].sort((x, y) => y - x)
    return (terang + 0.05) / (gelap + 0.05)
}

// Membaca "--color-nama: #rrggbb;" dari CSS menjadi { nama: '#rrggbb' }.
export const bacaTokenWarna = (css: string): Record<string, string> => {
    const hasil: Record<string, string> = {}
    for (const [, nama, nilai] of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
        hasil[nama] = nilai.toLowerCase()
    }
    return hasil
}
