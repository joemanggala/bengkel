// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pengemas paket jualan Aplikasi Bengkel: satu ZIP per varian backend dan jenis paket. Saat ini
// satu paket: bengkel-laravel-web-<versi>.zip, berisi backend Laravel + web Next.js + kontrak API
// + migration + WhatsApp palsu + panduan Word. Berkas dipilih dari working tree git TANPA perlu
// commit (lib/pilih.mjs), README dan panduan menjalankan dibuat dari templat/, dan ZIP diperiksa
// (lib/periksa.mjs) sebelum ditulis. Paket yang gagal diperiksa tidak pernah ditulis. Alat ini
// tidak menjalankan git add atau commit.
//
//   node alat/kemas-varian/kemas.mjs [--varian=laravel|semua] [--versi=x.y.z] [--paket=web|semua]
//        [--keluaran=dist/paket] [--tanpa-panduan] [--brand-kit=folder] [--gambar-ahws=folder]

import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PEMAKAIAN_KEMAS, bacaArgumenKemas } from './lib/argumen.mjs'
import { akarVarian, namaPaket } from './lib/aturan.mjs'
import { bangunPaket, muatTemplat } from './lib/bangun.mjs'
import { kumpulkanGambarTerlarang, tentukanFolderAhws, tentukanFolderBrandKit } from './lib/merek.mjs'
import { akarGit, bacaVersiAkar, daftarBerkasGit, jumlahBelumKomit } from './lib/pilih.mjs'
import { waktuPaket } from './lib/zip.mjs'

const FOLDER_ALAT = dirname(fileURLToPath(import.meta.url))

const mb = (n) => (n / 1024 / 1024).toFixed(2)

function kemasSatu(varian, jenis, k) {
    const hasil = bangunPaket({ ...k, varian, jenis })
    const tujuan = join(k.keluaran, `${hasil.nama}.zip`)
    console.log(`\n${hasil.nama} (paket ${jenis.nama})`)
    console.log(`  berkas  ${hasil.jumlahBerkas}, ukuran ${mb(hasil.zip.length)} MB`)
    console.log(`  sha256  ${createHash('sha256').update(hasil.zip).digest('hex')}`)
    for (const [kelompok, { berkas, bytes }] of hasil.ringkasan) {
        console.log(`  isi     ${kelompok.padEnd(18)} ${String(berkas).padStart(5)} berkas, ${mb(bytes)} MB`)
    }
    const alasan = new Map()
    for (const d of hasil.dibuang) alasan.set(d.alasan, (alasan.get(d.alasan) ?? 0) + 1)
    for (const [teks, jumlah] of alasan) console.log(`  ditinggal (${teks}): ${jumlah} berkas`)
    if (hasil.hilang.length > 0) console.warn(`  lewati ${hasil.hilang.length} berkas yang terhapus di working tree tetapi masih tercatat di index git`)
    const belumKomit = jumlahBelumKomit(k.akar, akarVarian(varian, jenis))
    if (belumKomit > 0) console.warn(`  perhatian: ${belumKomit} berkas di akar paket belum dikomit; paket dibangun dari working tree`)

    if (hasil.galat.length > 0) {
        // Paket lama bernama sama dibuang, supaya tidak tertukar dengan hasil yang gagal ini.
        rmSync(tujuan, { force: true })
        console.error(`  GAGAL: ${hasil.galat.length} galat, paket TIDAK ditulis:\n    ${hasil.galat.join('\n    ')}`)
        return false
    }
    writeFileSync(tujuan, hasil.zip)
    console.log(`  hasil   ${tujuan}`)
    return true
}

function utama() {
    let arg
    try {
        arg = bacaArgumenKemas(process.argv.slice(2))
    } catch (e) {
        console.error(`${e.message}\n${PEMAKAIAN_KEMAS}`)
        return 2
    }
    try {
        const akar = akarGit(arg.akar ? resolve(arg.akar) : FOLDER_ALAT)
        const versi = arg.versi ? { versi: arg.versi, asal: '--versi' } : bacaVersiAkar(akar)
        const { waktu, asal } = waktuPaket()
        const gambar = kumpulkanGambarTerlarang([tentukanFolderBrandKit(arg.brandKit), tentukanFolderAhws(arg.gambarAhws)])
        const k = {
            akar,
            semua: daftarBerkasGit(akar),
            versi: versi.versi,
            keluaran: arg.keluaran ? resolve(arg.keluaran) : join(akar, 'dist', 'paket'),
            templat: muatTemplat(join(FOLDER_ALAT, 'templat')),
            hashMerek: gambar.hash,
            tanpaPanduan: arg.tanpaPanduan,
            waktu,
        }
        console.log(`versi ${k.versi} (${versi.asal}); waktu berkas di ZIP: ${waktu.toISOString()} (${asal})`)
        for (const label of gambar.dilewati) console.log(`pemeriksaan ${label} dilewati: folder bawaannya tidak ditemukan (isi --brand-kit untuk mengaktifkan)`)
        if (!arg.gambarAhws && !process.env.KEMAS_GAMBAR_AHWS) console.log('pemeriksaan gambar AHWS per isi berkas dilewati (isi --gambar-ahws); nama dan teks AHWS tetap ditolak')
        if (k.tanpaPanduan) console.warn('PERHATIAN: --tanpa-panduan, empat panduan Word tidak diwajibkan; jangan dipakai untuk paket yang dijual')
        mkdirSync(k.keluaran, { recursive: true })
        let gagal = 0
        for (const varian of arg.varian) {
            for (const jenis of arg.jenis) {
                try {
                    if (!kemasSatu(varian, jenis, k)) gagal++
                } catch (e) {
                    // Satu paket yang rusak (mis. spec berubah bentuk) tidak boleh menyembunyikan paket lain.
                    gagal++
                    console.error(`\n${namaPaket(varian, k.versi, jenis)}\n${varian.kode}: GAGAL: ${e.message}`)
                    // Paket lama bernama sama dibuang, supaya tidak tertukar dengan hasil yang gagal ini.
                    rmSync(join(k.keluaran, `${namaPaket(varian, k.versi, jenis)}.zip`), { force: true })
                }
            }
        }
        return gagal > 0 ? 1 : 0
    } catch (e) {
        console.error(`GAGAL: ${e.message}`)
        return 1
    }
}

process.exitCode = utama()
