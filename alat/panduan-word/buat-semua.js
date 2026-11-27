// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Membuat semua panduan Word di docs/panduan/, mengisi daftar isinya lewat Microsoft Word, lalu
// mengganti nama pengubah terakhir yang ditulis Word dengan nama toko.
//
//   node buat-semua.js                 empat panduan, daftar isi diisi lewat Word (Windows)
//   node buat-semua.js --tanpa-word    tanpa Word; daftar isi diisi nanti (Update Field)
//   node buat-semua.js --hanya=1       hanya panduan bernomor itu (1 sampai 4)

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const JSZip = require('jszip')

process.chdir(path.resolve(__dirname, '..', '..'))

// Nama berkas mengikuti produk lain (Panduan-Pemakai-Aplikasi-<produk>.docx dan seterusnya), dan
// harus sama dengan daftar panduan wajib di pengemas paket.
const PANDUAN = [
    ['./panduan-pemakai', 'docs/panduan/Panduan-Pemakai-Aplikasi-Bengkel.docx'],
    ['./menjalankan-laptop', 'docs/panduan/Panduan-Menjalankan-di-Laptop.docx'],
    ['./upload-vps', 'docs/panduan/Panduan-Upload-ke-VPS.docx'],
    ['./arsitektur-teknologi', 'docs/panduan/Panduan-Arsitektur-dan-Teknologi.docx'],
]

async function bersihkanMetadata(berkas) {
    const zip = await JSZip.loadAsync(fs.readFileSync(berkas))
    const core = await zip.file('docProps/core.xml').async('string')
    zip.file('docProps/core.xml', core.replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy>KodeCoding</cp:lastModifiedBy>'))
    fs.writeFileSync(berkas, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
}

async function utama() {
    const hanya = process.argv.find((a) => a.startsWith('--hanya='))?.slice('--hanya='.length)
    const terpilih = PANDUAN.filter((_, i) => !hanya || String(i + 1) === hanya)
    if (terpilih.length === 0) throw new Error(`panduan "${hanya}" tidak ada; pilih 1 sampai ${PANDUAN.length}`)
    fs.mkdirSync('docs/panduan', { recursive: true })
    for (const [modul, keluar] of terpilih) await require(modul)(keluar)
    const berkas = terpilih.map(([, b]) => b)
    if (process.platform === 'win32' && !process.argv.includes('--tanpa-word')) {
        execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'perbarui.ps1'), ...berkas], { stdio: 'inherit' })
    } else {
        console.log('daftar isi belum terisi: buka di Word, klik kanan daftar isi, Update Field')
    }
    for (const b of berkas) await bersihkanMetadata(b)
}

utama().catch((e) => {
    console.error(e)
    process.exit(1)
})
