// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pemilihan berkas paket dari daftar git. Semua perintah git di sini hanya MEMBACA: tidak ada
// git add, commit, stash, atau checkout, jadi pengemas aman dijalankan di working tree yang
// sedang dikerjakan orang lain.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
    BERKAS_TEMPLAT,
    BERKAS_VERSI,
    BERKAS_VERSI_PAKET,
    JENIS,
    POLA_BERKAS_INTERNAL,
    POLA_BERKAS_SISA,
    POLA_FOLDER_RUNTIME,
    SEGMEN_TERLARANG,
    TERLARANG,
    VERSI_BAWAAN,
    akarVarian,
    berkasRahasia,
    versiSah,
} from './aturan.mjs'

const git = (akar, args) =>
    execFileSync('git', args, {
        cwd: akar,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
    })

export const akarGit = (dariFolder) => git(dariFolder, ['rev-parse', '--show-toplevel']).trim()

// Berkas yang "dilihat" git di working tree: yang dilacak, ditambah yang belum dilacak tetapi
// tidak diabaikan .gitignore. Dengan begitu paket bisa dibuat SEBELUM ada commit atau git add,
// sementara node_modules, vendor, build, dan .env tidak pernah ikut tanpa daftar pengecualian
// sendiri. -z dipakai supaya nama berkas berkarakter khusus tidak diberi tanda kutip oleh git.
export function daftarBerkasGit(akar) {
    const isi = git(akar, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    return [...new Set(isi.split('\0').filter(Boolean))].sort()
}

// Jumlah berkas di akar paket yang belum tercatat di commit (baru atau berubah). Paket tetap
// dibuat dari working tree; angka ini hanya mengingatkan penjual bahwa isinya belum terkunci di git.
export function jumlahBelumKomit(akar, akarPaket) {
    const isi = git(akar, ['status', '--porcelain', '--untracked-files=all', '--', ...akarPaket])
    return isi.split('\n').filter(Boolean).length
}

// Versi bawaan dari berkas VERSION (atau VERSI) di akar repo: satu baris x.y.z. Berkas yang ada
// tetapi isinya salah menghentikan pengemas, bukan diam-diam jatuh ke 0.1.0, supaya salah ketik
// tidak menghasilkan paket bernomor keliru.
export function bacaVersiAkar(akar) {
    for (const nama of BERKAS_VERSI) {
        const lengkap = join(akar, nama)
        if (!existsSync(lengkap)) continue
        const versi = readFileSync(lengkap, 'utf8').trim()
        if (!versiSah(versi)) throw new Error(`${nama} berisi "${versi}", bukan versi x.y.z`)
        return { versi, asal: nama }
    }
    return { versi: VERSI_BAWAAN, asal: 'bawaan' }
}

const termasukAkar = (path, akar) => akar.some((a) => (a.endsWith('/') ? path.startsWith(a) : path === a))

// Memilih berkas satu varian dan jenis paket dari daftar git. Berkas yang dibuang dicatat beserta
// alasannya, supaya laporan pengemas bisa menunjukkan apa yang sengaja ditinggal. Berkas di luar
// akar paket (backend lain, tests/kontrak, tests/e2e, alat/, docs/eksekusi, mobile/, ...) tidak
// dicatat: jumlahnya besar dan memang bukan bagian paket sejak awal.
export function pilihBerkas(semua, varian, jenis = JENIS.web) {
    const akar = akarVarian(varian, jenis)
    const dipilih = []
    const dibuang = []
    for (const path of semua) {
        if (Object.hasOwn(BERKAS_TEMPLAT, path)) {
            dibuang.push({ path, alasan: 'digantikan templat paket' })
            continue
        }
        if (path === BERKAS_VERSI_PAKET) {
            dibuang.push({ path, alasan: 'dibuat ulang dari versi paket' })
            continue
        }
        if (!termasukAkar(path, akar)) continue
        const folder = path.split('/').slice(0, -1)
        if (TERLARANG.some((t) => path.startsWith(t))) {
            dibuang.push({ path, alasan: 'catatan internal atau alat' })
        } else if (POLA_BERKAS_INTERNAL.some((a) => a.pola.test(path))) {
            dibuang.push({ path, alasan: 'skrip tes kontrak' })
        } else if (folder.some((s) => SEGMEN_TERLARANG.has(s)) || POLA_FOLDER_RUNTIME.test(path)) {
            dibuang.push({ path, alasan: 'hasil build, dependensi, atau data runtime' })
        } else if (berkasRahasia(path)) {
            dibuang.push({ path, alasan: 'berkas rahasia' })
        } else if (POLA_BERKAS_SISA.test(path)) {
            dibuang.push({ path, alasan: 'sisa build atau sistem operasi' })
        } else {
            dipilih.push(path)
        }
    }
    return { dipilih, dibuang }
}
