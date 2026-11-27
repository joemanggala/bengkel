// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Kelas Tailwind bersama untuk form dan tombol. Dipakai sebagai string supaya bisa ditempel ke
// <button>, <Link>, maupun <a> tanpa membungkus ulang (komponen Tombol, Input, Select, dan
// Textarea hanyalah pembungkus tipis di atas kelas yang sama).
//
// Ukuran mengikuti layar sentuh tablet: tombol dan kotak isian setinggi 48 px, tombol kecil
// 44 px, dan teks isian 16 px supaya Safari di iPad tidak memperbesar halaman saat mengetik.

export const LABEL = 'mb-2 block text-[15px] font-semibold text-tinta'

export const INPUT =
    'block min-h-12 w-full rounded-lg border border-garis-kuat bg-permukaan px-3.5 py-2.5 text-base text-tinta placeholder:text-redup transition-colors focus:border-fokus focus:outline-none focus:ring-[3px] focus:ring-fokus/25 disabled:cursor-not-allowed disabled:bg-latar disabled:opacity-70 aria-[invalid=true]:border-bahaya aria-[invalid=true]:focus:ring-bahaya/20'

// Textarea memakai kotak isian yang sama, tetapi tinggi mengikuti baris dan bisa ditarik ke bawah.
export const TEXTAREA = `${INPUT} min-h-24 resize-y leading-relaxed`

const TOMBOL_DASAR =
    'inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

export const TOMBOL_PRIMER = `${TOMBOL_DASAR} bg-utama text-white hover:bg-utama-tua active:bg-utama-tua`

export const TOMBOL_SEKUNDER = `${TOMBOL_DASAR} border border-garis-kuat bg-permukaan text-tinta hover:bg-latar active:bg-garis`

export const TOMBOL_BAHAYA = `${TOMBOL_DASAR} bg-bahaya text-white hover:bg-bahaya-tua active:bg-bahaya-tua`

// Tombol tanpa bingkai untuk aksi pelengkap (mis. "Batal" di samping tombol utama).
export const TOMBOL_HANTU = `${TOMBOL_DASAR} text-utama-tua hover:bg-utama-pucat active:bg-utama-pucat`

// Tombol di baris tabel dan kartu; tetap 44 px supaya mudah diketuk.
export const TOMBOL_KECIL =
    'inline-flex min-h-11 select-none items-center justify-center gap-1.5 rounded-lg border border-garis-kuat bg-permukaan px-3.5 py-2 text-[15px] font-semibold text-tinta transition-colors hover:bg-latar disabled:cursor-not-allowed disabled:opacity-60'

// Tautan di dalam kalimat diberi garis bawah, supaya tidak dibedakan dari teks hanya oleh warna.
export const TAUTAN =
    'font-semibold text-utama-tua underline decoration-2 underline-offset-4 hover:decoration-utama'
