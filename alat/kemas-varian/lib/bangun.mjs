// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Inti pengemas: dari daftar berkas git dan templat menjadi satu ZIP (satu varian, satu jenis
// paket), lalu diperiksa.
// Dipisah dari kemas.mjs (yang mengurus argumen, git, dan penulisan berkas) supaya bisa dites
// dengan repo git sementara tanpa menjalankan proses baru.

import { lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AKAR_MOBILE, BERKAS_TEMPLAT, BERKAS_VERSI_PAKET, JENIS, namaPaket } from './aturan.mjs'
import { periksaPaket } from './periksa.mjs'
import { pilihBerkas } from './pilih.mjs'
import { KATA_PENANDA, buangBlokInternal, gantiPortEnvWeb, gantiPortSpec, isiTemplat, normalisasiEol, nilaiTemplat, periksaSinkronCompose } from './ubah.mjs'
import { WAKTU_TETAP, bacaZip, buatZip } from './zip.mjs'

// Membaca semua templat sekali: { 'README.md': teks, ... } dengan kunci path tujuan di paket.
export function muatTemplat(folder, baca = (p) => readFileSync(p, 'utf8')) {
    return Object.fromEntries(Object.entries(BERKAS_TEMPLAT).map(([tujuan, sumber]) => [tujuan, baca(join(folder, sumber))]))
}

// Izin eksekusi ditentukan dari path saja, bukan dari mode di mesin pembangun: Windows tidak
// punya bit eksekusi, dan hasil yang bergantung pada mesin akan merusak determinisme.
export const bisaDieksekusi = (path) => path.endsWith('.sh') || /(^|\/)artisan$/.test(path)

// Ringkasan isi paket per kelompok teratas (backend-laravel/, web/, ...) untuk laporan.
export function ringkasIsi(daftar) {
    const kelompok = new Map()
    for (const { path, ukuran } of daftar) {
        const [pertama, ...sisa] = path.split('/')
        const kunci = sisa.length > 0 ? `${pertama}/` : '(akar)'
        const k = kelompok.get(kunci) ?? { berkas: 0, bytes: 0 }
        k.berkas++
        k.bytes += ukuran
        kelompok.set(kunci, k)
    }
    return [...kelompok].sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

// Membangun satu paket di memori. Mengembalikan { nama, jenis, zip, galat, dibuang, hilang,
// ringkasan, jumlahBerkas }. `galat` gabungan galat pengemasan (templat atau compose tidak
// sinkron) dan galat pemeriksa; ZIP tetap dikembalikan walau galat tidak kosong supaya ukurannya
// bisa dilaporkan, tetapi pemanggil tidak boleh menulisnya. Hal yang membuat pengemas tidak bisa
// melanjutkan (spec atau web/.env.example berubah bentuk) dilempar sebagai Error.
export function bangunPaket({ akar, semua, varian, versi, jenis = JENIS.web, templat, hashMerek = null, tanpaPanduan = false, waktu = WAKTU_TETAP }) {
    const nama = namaPaket(varian, versi, jenis)
    const galat = []
    const { dipilih, dibuang } = pilihBerkas(semua, varian, jenis)
    const berkas = new Map()
    const hilang = []

    for (const path of dipilih) {
        const asal = join(akar, path)
        let info
        try {
            info = lstatSync(asal)
        } catch {
            // Terhapus di working tree tetapi masih tercatat di index git.
            hilang.push(path)
            continue
        }
        if (!info.isFile()) {
            dibuang.push({ path, alasan: 'bukan berkas biasa (tautan atau folder)' })
            continue
        }
        const isi = normalisasiEol(path, readFileSync(asal))
        berkas.set(path, isi)
        // Blok bertanda kemas:abaikan dibuang dari berkas teks. Galat penandanya dikumpulkan, bukan
        // dilempar, supaya semua berkas yang salah pasang terlihat sekaligus.
        if (isi.includes(KATA_PENANDA) && !isi.subarray(0, 8000).includes(0)) {
            try {
                berkas.set(path, Buffer.from(buangBlokInternal(path, isi.toString('utf8'))))
            } catch (e) {
                galat.push(e.message)
            }
        }
    }

    if (berkas.has('web/.env.example')) {
        berkas.set('web/.env.example', Buffer.from(gantiPortEnvWeb(berkas.get('web/.env.example').toString('utf8'), varian.port)))
    }

    if (berkas.has('spec/openapi.yaml')) {
        berkas.set('spec/openapi.yaml', Buffer.from(gantiPortSpec(berkas.get('spec/openapi.yaml').toString('utf8'), varian.port)))
    }

    // Paket web tidak memuat apa pun di mobile/ (dijaga akarVarian); dicek lagi di sini supaya
    // kesalahan aturan terlihat sebelum ZIP dibuat.
    if (!jenis.mobile && [...berkas.keys()].some((p) => p.startsWith(AKAR_MOBILE))) {
        throw new Error(`paket web memuat berkas di ${AKAR_MOBILE}; periksa akarVarian di lib/aturan.mjs`)
    }

    // VERSION dibuat dari versi paket, bukan disalin, supaya selalu sama dengan nama ZIP.
    berkas.set(BERKAS_VERSI_PAKET, Buffer.from(`${versi}
`))

    const nilai = nilaiTemplat(varian, versi, jenis)
    for (const [tujuan, teks] of Object.entries(templat)) {
        berkas.set(tujuan, Buffer.from(isiTemplat(teks, nilai, `templat untuk ${tujuan}`)))
    }

    const composeRepo = semua.includes('docker-compose.yml') ? bacaAtauNull(join(akar, 'docker-compose.yml')) : null
    if (composeRepo !== null) galat.push(...periksaSinkronCompose(composeRepo, berkas.get('docker-compose.yml').toString('utf8')))

    const entri = [...berkas].map(([path, isi]) => ({ nama: `${nama}/${path}`, isi, eksekusi: bisaDieksekusi(path) }))
    const zip = buatZip(entri, waktu)
    galat.push(...periksaPaket(bacaZip(zip), { varian, versi, jenis, tanpaPanduan, hashMerek }))
    const ringkasan = ringkasIsi([...berkas].map(([path, isi]) => ({ path, ukuran: isi.length })))
    return { nama, jenis, zip, galat, dibuang, hilang, ringkasan, jumlahBerkas: berkas.size }
}

function bacaAtauNull(path) {
    try {
        return readFileSync(path, 'utf8')
    } catch {
        return null
    }
}
