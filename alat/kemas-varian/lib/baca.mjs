// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Membaca paket yang sudah jadi untuk diperiksa: sebuah ZIP, atau folder hasil ekstrak. Hasilnya
// seragam, yaitu daftar { nama, isi, sha256 } dengan nama diawali folder akar paket, sehingga
// pemeriksa tidak perlu tahu asalnya.

import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { JENIS, bacaNamaPaket, namaPaket } from './aturan.mjs'
import { kenaliPaket } from './argumen.mjs'
import { bacaZip } from './zip.mjs'

// Semua berkas di bawah `folder` (rekursif), tanpa mengikuti tautan simbolik. Urutan nama tetap
// supaya laporan galat stabil.
function jelajahi(folder, relatif = '') {
    const hasil = []
    const daftar = readdirSync(join(folder, relatif), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))
    for (const d of daftar) {
        const rel = relatif ? `${relatif}/${d.name}` : d.name
        if (d.isSymbolicLink()) continue
        if (d.isDirectory()) hasil.push(...jelajahi(folder, rel))
        else if (d.isFile()) hasil.push(rel)
    }
    return hasil
}

// Mengembalikan { entri, varian, jenis, versi, label } atau melempar galat bila varian tidak bisa
// ditentukan. Untuk folder, nama folder harus bengkel-<varian>-web-<versi>, atau
// --varian/--paket/--versi diberikan; untuk ZIP, nama folder akar di dalamnya yang dipakai.
export function bacaSasaran(sasaran, { varian, jenis, versi } = {}) {
    const lengkap = resolve(sasaran)
    const info = lstatSync(lengkap)
    if (info.isDirectory()) {
        const dikenal = kenaliPaket(basename(lengkap), { varian, jenis, versi })
        if (!dikenal) {
            throw new Error(`folder ${basename(lengkap)} bukan bengkel-<varian>-web-<versi>; sebutkan --varian (dan --paket, --versi)`)
        }
        const akar = namaPaket(dikenal.varian, dikenal.versi, dikenal.jenis)
        const entri = jelajahi(lengkap).map((rel) => {
            const isi = readFileSync(join(lengkap, rel))
            return { nama: `${akar}/${rel}`, isi, sha256: createHash('sha256').update(isi).digest('hex') }
        })
        return { entri, ...dikenal, label: basename(lengkap) }
    }
    const entri = bacaZip(readFileSync(lengkap))
    const akar = entri.map((e) => e.nama.split('/')[0]).find((n) => bacaNamaPaket(n))
    const dikenal = akar ? bacaNamaPaket(akar) : varian ? { varian, jenis: jenis ?? JENIS.web, versi: versi ?? '0.0.0' } : null
    if (!dikenal) throw new Error('isi ZIP tidak berada di folder bengkel-<varian>-web-<versi>/')
    return { entri, ...dikenal, label: basename(lengkap) }
}
