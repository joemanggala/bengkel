// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Sidik gambar yang tidak boleh terbawa ke paket. Aplikasi bengkel berlogo netral, tetapi paket
// jualan tetap tidak boleh memuat berkas yang isinya sama persis dengan gambar di brand kit toko
// (mis. ikon disalin dari proyek toko) atau gambar milik situs klien AHWS. Keduanya OPSIONAL: bila
// folder tidak ada, pemeriksaan gambar itu dilewati dan alat memberi tahu bahwa ia dilewati,
// supaya alat ini tetap bisa dipakai di mesin yang tidak punya folder tersebut. Nama dan teks AHWS
// tetap ditolak tanpa folder ini (lihat POLA_AHWS di lib/aturan.mjs).

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

// Brand kit hanya dibaca. Lokasi lain bisa diberikan lewat --brand-kit atau env KEMAS_BRAND_KIT.
export const BRAND_KIT_BAWAAN = 'D:/KODE_BELAJAR/kodecoding-brand-kit'

const GAMBAR = /\.(png|jpe?g|gif|webp|svg|ico|icns)$/i

export const sha256 = (isi) => createHash('sha256').update(isi).digest('hex')

// Folder brand kit: pilihan eksplisit lebih dulu (flag, lalu env), baru lokasi bawaan.
export function tentukanFolderBrandKit(flag, env = process.env) {
    const eksplisit = flag?.trim() || env.KEMAS_BRAND_KIT?.trim()
    return { folder: eksplisit || BRAND_KIT_BAWAAN, eksplisit: Boolean(eksplisit), label: 'brand kit' }
}

// Folder gambar situs klien AHWS: hanya bila disebut (flag, lalu env KEMAS_GAMBAR_AHWS). Tidak
// ada lokasi bawaan, karena proyek klien itu tidak boleh disentuh alat produk ini tanpa diminta.
export function tentukanFolderAhws(flag, env = process.env) {
    const eksplisit = flag?.trim() || env.KEMAS_GAMBAR_AHWS?.trim()
    return eksplisit ? { folder: eksplisit, eksplisit: true, label: 'gambar AHWS' } : null
}

// Map sha256 → asal gambar, atau null bila folder bawaan tidak ada (atau sumbernya null). Folder
// yang disebut secara eksplisit tetapi tidak ada menghentikan alat: permintaan memeriksa yang
// diam-diam tidak memeriksa apa pun lebih berbahaya daripada berhenti.
export function kumpulkanHashMerek(sumber) {
    if (!sumber) return null
    const { folder, eksplisit, label = 'brand kit' } = sumber
    if (!existsSync(folder)) {
        if (eksplisit) throw new Error(`${label} tidak ditemukan di ${folder}`)
        return null
    }
    const hasil = new Map()
    for (const d of readdirSync(folder, { recursive: true, withFileTypes: true })) {
        if (!d.isFile() || !GAMBAR.test(d.name)) continue
        const lengkap = join(d.parentPath, d.name)
        const asal = relative(folder, lengkap).split('\\').join('/')
        hasil.set(sha256(readFileSync(lengkap)), `${label} ${asal}`)
    }
    if (hasil.size === 0) throw new Error(`${label} di ${folder} tidak berisi gambar`)
    return hasil
}

// Gabungan beberapa sumber gambar terlarang. Mengembalikan { hash, dilewati }: hash = Map
// gabungan atau null bila tidak ada satu pun yang diperiksa; dilewati = label sumber yang tidak
// ditemukan di lokasi bawaannya (untuk diberitahukan ke pemakai).
export function kumpulkanGambarTerlarang(sumber) {
    const hash = new Map()
    const dilewati = []
    for (const s of sumber) {
        if (!s) continue
        const satu = kumpulkanHashMerek(s)
        if (satu === null) dilewati.push(s.label)
        else for (const [k, v] of satu) hash.set(k, v)
    }
    return { hash: hash.size > 0 ? hash : null, dilewati }
}
