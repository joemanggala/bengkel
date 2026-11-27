// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pemeriksa paket jualan yang sudah jadi (ZIP atau folder hasil ekstrak), mis. sebelum diunggah
// ke toko atau bila paket dibuat tanpa kemas.mjs. Aturannya sama persis dengan pemeriksaan
// otomatis di kemas.mjs. Varian, jenis paket, dan versi dibaca dari nama folder akar
// (bengkel-<varian>-web-<versi>).
//
//   node alat/kemas-varian/periksa.mjs dist/paket/bengkel-laravel-web-0.1.0.zip [paket lain ...] [--tanpa-panduan]

import { basename } from 'node:path'
import { PEMAKAIAN_PERIKSA, bacaArgumenPeriksa } from './lib/argumen.mjs'
import { bacaSasaran } from './lib/baca.mjs'
import { kumpulkanGambarTerlarang, tentukanFolderAhws, tentukanFolderBrandKit } from './lib/merek.mjs'
import { periksaPaket } from './lib/periksa.mjs'

function utama() {
    let arg
    try {
        arg = bacaArgumenPeriksa(process.argv.slice(2))
    } catch (e) {
        console.error(`${e.message}\n${PEMAKAIAN_PERIKSA}`)
        return 2
    }
    let gambar
    try {
        gambar = kumpulkanGambarTerlarang([tentukanFolderBrandKit(arg.brandKit), tentukanFolderAhws(arg.gambarAhws)])
    } catch (e) {
        console.error(`GAGAL: ${e.message}`)
        return 1
    }
    const hashMerek = gambar.hash
    for (const label of gambar.dilewati) console.log(`pemeriksaan ${label} dilewati: folder bawaannya tidak ditemukan (isi --brand-kit untuk mengaktifkan)`)
    if (arg.tanpaPanduan) console.warn('PERHATIAN: --tanpa-panduan, empat panduan Word tidak diwajibkan; jangan dipakai untuk paket yang dijual')

    let gagal = 0
    for (const sasaran of arg.sasaran) {
        let jumlah = 0
        let galat
        try {
            const paket = bacaSasaran(sasaran, { varian: arg.varian, jenis: arg.jenis, versi: arg.versi })
            jumlah = paket.entri.length
            galat = periksaPaket(paket.entri, { varian: paket.varian, jenis: paket.jenis, versi: paket.versi, tanpaPanduan: arg.tanpaPanduan, hashMerek })
        } catch (e) {
            galat = [e.message]
        }
        if (galat.length === 0) {
            console.log(`lolos  ${basename(sasaran)}: ${jumlah} berkas`)
        } else {
            gagal++
            console.error(`GAGAL  ${basename(sasaran)}: ${galat.length} galat\n    ${galat.join('\n    ')}`)
        }
    }
    return gagal > 0 ? 1 : 0
}

process.exitCode = utama()
