// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Dua huruf awal nama untuk lingkaran avatar: "Siti Aminah" -> "SA", "budi" -> "B".
export const inisial = (nama: string): string =>
    nama
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        // Array.from membaca per code point, jadi huruf di luar BMP tidak terbelah dua.
        .map((kata) => Array.from(kata)[0]?.toLocaleUpperCase('id-ID') ?? '')
        .join('')
