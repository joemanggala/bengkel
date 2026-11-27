// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Format angka dan waktu ditulis tangan, bukan lewat Intl/toLocaleString, supaya hasilnya sama
// persis dengan templat pesan WhatsApp di backend (spec/whatsapp.md: `Rp35.000`, `27-11-2026`,
// `27-11-2026 14:05 WIB`) dan tidak bergantung pada data locale browser atau Node. Server dan
// browser yang berbeda zona waktunya pun menampilkan angka yang sama, sehingga hidrasi React
// tidak bentrok.

const kelompokRibuan = (angka: number): string =>
    String(angka).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// Rupiah bulat: 12500 -> "Rp12.500", -2000 -> "-Rp2.000". Uang di aplikasi ini selalu integer
// rupiah, jadi pecahan (kalau ada) dibulatkan saja.
export const formatRupiah = (nilai: number): string => {
    const bulat = Math.round(nilai)
    const tanda = bulat < 0 ? '-' : ''
    return `${tanda}Rp${kelompokRibuan(Math.abs(bulat))}`
}

// Angka bulat dengan titik ribuan tanpa "Rp", mis. stok, odometer, atau nilai di kotak isian.
export const formatAngka = (nilai: number): string => {
    const bulat = Math.round(nilai)
    return `${bulat < 0 ? '-' : ''}${kelompokRibuan(Math.abs(bulat))}`
}

// Batas digit isian uang (15 digit): lebih dari itu sudah di luar rentang aman dan toh ditolak
// validasi.
const MAKS_DIGIT_ISIAN_RUPIAH = 15

// Merapikan isian uang sambil diketik: hanya digit yang dipertahankan, nol di depan dibuang, lalu
// diberi titik ribuan. "15000" -> "15.000", "Rp 1a2" -> "12", "007" -> "7", "" -> "". Hasilnya
// tetap terbaca oleh pembaca isian rupiah (yang menerima titik ribuan).
export const rapikanIsianRupiah = (teks: string): string => {
    const digit = teks
        .replace(/\D/g, '')
        .replace(/^0+(?=\d)/, '')
        .slice(0, MAKS_DIGIT_ISIAN_RUPIAH)
    return digit === '' ? '' : kelompokRibuan(Number(digit))
}

// Posisi kursor di isian yang sudah dirapikan, supaya kursor tetap di sebelah digit yang sama
// setelah titik ribuan disisipkan atau dibuang. `digitDiKiri` = banyak digit di kiri kursor
// sebelum dirapikan. Melebihi jumlah digit (mis. nol di depan dibuang) = ujung isian.
export const posisiKursorRupiah = (rapi: string, digitDiKiri: number): number => {
    if (digitDiKiri <= 0) return 0
    let terhitung = 0
    for (let i = 0; i < rapi.length; i++) {
        if (rapi[i] !== '.') terhitung++
        if (terhitung === digitDiKiri) return i + 1
    }
    return rapi.length
}

const duaDigit = (angka: number): string => String(angka).padStart(2, '0')

// WIB = UTC+7 tanpa musim panas, jadi cukup digeser tujuh jam lalu dibaca sebagai UTC.
const GESER_WIB_MS = 7 * 60 * 60 * 1000

// Waktu dari API (ISO UTC) ditampilkan dalam WIB: "31-10-2026 14:05". Detik dan milidetik
// dibuang, bukan dibulatkan (sama dengan templat WhatsApp). Teks yang bukan waktu menghasilkan
// string kosong, bukan "NaN-NaN".
export const formatWaktu = (iso: string): string => {
    const waktu = new Date(iso)
    if (Number.isNaN(waktu.getTime())) return ''
    const w = new Date(waktu.getTime() + GESER_WIB_MS)
    const tanggal = `${duaDigit(w.getUTCDate())}-${duaDigit(w.getUTCMonth() + 1)}-${w.getUTCFullYear()}`
    return `${tanggal} ${duaDigit(w.getUTCHours())}:${duaDigit(w.getUTCMinutes())}`
}

// Sama dengan formatWaktu tetapi dengan zona di belakang ("31-10-2026 14:05 WIB"), untuk nota
// dan tempat lain yang dibaca orang di luar aplikasi.
export const formatWaktuWib = (iso: string): string => {
    const teks = formatWaktu(iso)
    return teks ? `${teks} WIB` : ''
}

// Nomor HP disimpan seragam `628...`; di layar dan nota ditulis seperti yang biasa diketik
// orang: "6281234567890" -> "0812-3456-7890". Bentuk lain dibiarkan apa adanya.
export const formatNomorHp = (nomor: string): string => {
    if (!/^628[0-9]{7,12}$/.test(nomor)) return nomor
    const lokal = `0${nomor.slice(2)}`
    return [lokal.slice(0, 4), lokal.slice(4, 8), lokal.slice(8)].filter(Boolean).join('-')
}

// Tanggal kalender dari API (YYYY-MM-DD, sudah WIB) ditulis seperti di pesan WhatsApp:
// "2026-11-27" -> "27-11-2026". Bentuk lain dibiarkan apa adanya.
export const formatTanggal = (tanggal: string): string => {
    const cocok = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(tanggal)
    return cocok ? `${cocok[3]}-${cocok[2]}-${cocok[1]}` : tanggal
}

// Kendaraan dalam satu baris, sama dengan {kendaraan} di templat WhatsApp:
// "B 1234 XYZ (Honda Vario 125)", atau "D 1 (Toyota)" bila tipe kosong.
export const formatKendaraan = (k: { plate: string; brand: string; model: string }): string => {
    const nama = [k.brand, k.model].filter((t) => t !== '').join(' ')
    return nama ? `${k.plate} (${nama})` : k.plate
}
