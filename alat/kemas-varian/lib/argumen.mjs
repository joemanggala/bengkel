// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Argumen baris perintah pengemas (kemas.mjs) dan pemeriksa (periksa.mjs), dipisah supaya bisa
// dites tanpa menjalankan keduanya.

import { parseArgs } from 'node:util'
import { JENIS, VARIAN, VARIAN_TERSEDIA, bacaNamaPaket, versiSah } from './aturan.mjs'

const PILIHAN_VARIAN = VARIAN_TERSEDIA.map((v) => v.kode).join('|')
const PILIHAN_PAKET = Object.keys(JENIS).join('|')

export const PEMAKAIAN_KEMAS = [
    `Pemakaian: node alat/kemas-varian/kemas.mjs [--varian=${PILIHAN_VARIAN}|semua] [--versi=x.y.z]`,
    `                                            [--paket=${PILIHAN_PAKET}|semua] [--keluaran=dist/paket]`,
    '                                            [--tanpa-panduan] [--brand-kit=folder] [--gambar-ahws=folder]',
    '  --varian         varian backend yang dikemas (bawaan: semua varian yang tersedia)',
    '  --paket          jenis paket (bawaan: semua jenis yang tersedia)',
    '                     web      backend + web: bengkel-<varian>-web-<versi>.zip',
    '  --versi          versi paket; bawaan isi berkas VERSION di akar repo, atau 0.1.0',
    '  --keluaran       folder hasil (bawaan: dist/paket/ di akar repo)',
    '  --tanpa-panduan  tidak mewajibkan empat panduan Word di docs/panduan; HANYA untuk tahap pengembangan',
    '  --brand-kit      folder gambar brand toko untuk memeriksa logo yang terbawa (opsional)',
    '  --gambar-ahws    folder gambar milik situs klien yang tidak boleh terbawa (opsional)',
].join('\n')

export const PEMAKAIAN_PERIKSA = [
    'Pemakaian: node alat/kemas-varian/periksa.mjs <paket.zip | folder> [lainnya ...]',
    `                                              [--tanpa-panduan] [--varian=${PILIHAN_VARIAN}]`,
    `                                              [--paket=${PILIHAN_PAKET}] [--versi=x.y.z]`,
    '                                              [--brand-kit=folder] [--gambar-ahws=folder]',
    '  Varian, jenis paket, dan versi dibaca dari nama folder akar (bengkel-<varian>-web-<versi>).',
    '  Untuk folder yang namanya lain, sebutkan --varian (dan --paket, --versi).',
].join('\n')

function cekVarian(kode, bolehSemua) {
    if (bolehSemua && kode === 'semua') return VARIAN_TERSEDIA
    if (Object.hasOwn(VARIAN, kode) && !VARIAN[kode].tersedia) {
        throw new Error(`--varian "${kode}": backend ${VARIAN[kode].nama} belum ada di repo ini; pilih ${PILIHAN_VARIAN}`)
    }
    if (!Object.hasOwn(VARIAN, kode)) {
        throw new Error(`--varian "${kode}" tidak dikenal; pilih ${PILIHAN_VARIAN}${bolehSemua ? '|semua' : ''}`)
    }
    return [VARIAN[kode]]
}

// --paket: satu jenis, atau "semua" bila bolehSemua.
function cekPaket(kode, bolehSemua) {
    if (bolehSemua && kode === 'semua') return Object.values(JENIS)
    if (!Object.hasOwn(JENIS, kode)) {
        throw new Error(`--paket "${kode}" tidak dikenal; pilih ${PILIHAN_PAKET}${bolehSemua ? '|semua' : ''}`)
    }
    return [JENIS[kode]]
}

function cekVersi(versi) {
    if (versi !== undefined && !versiSah(versi)) {
        throw new Error('--versi harus berbentuk x.y.z (mis. 1.0.0), paling banyak 30 karakter, dan tidak diawali "web-" atau "mobile-" (nama paket jadi ambigu); akhiran pra-rilis seperti 1.0.0-rc.1 boleh')
    }
}

// kemas.mjs. Mengembalikan { varian: [...], jenis: [...], versi?, keluaran?, tanpaPanduan, akar?,
// brandKit?, gambarAhws? }. versi dibiarkan kosong bila tidak diberikan; kemas.mjs mengisinya
// dari berkas versi di akar.
export function bacaArgumenKemas(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            varian: { type: 'string' },
            paket: { type: 'string' },
            versi: { type: 'string' },
            keluaran: { type: 'string' },
            'tanpa-panduan': { type: 'boolean' },
            akar: { type: 'string' },
            'brand-kit': { type: 'string' },
            'gambar-ahws': { type: 'string' },
        },
    })
    if (positionals.length > 0) throw new Error(`Argumen "${positionals[0]}" tidak dikenal; varian ditulis --varian=<nama>`)
    cekVersi(values.versi)
    return {
        varian: cekVarian(values.varian ?? 'semua', true),
        jenis: cekPaket(values.paket ?? 'semua', true),
        versi: values.versi,
        keluaran: values.keluaran,
        tanpaPanduan: Boolean(values['tanpa-panduan']),
        akar: values.akar,
        brandKit: values['brand-kit'],
        gambarAhws: values['gambar-ahws'],
    }
}

// periksa.mjs. Mengembalikan { sasaran: [...], tanpaPanduan, varian?, jenis?, versi?, brandKit?,
// gambarAhws? }. varian, jenis, dan versi hanya dipakai untuk folder yang namanya bukan nama paket.
export function bacaArgumenPeriksa(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            'tanpa-panduan': { type: 'boolean' },
            varian: { type: 'string' },
            paket: { type: 'string' },
            versi: { type: 'string' },
            'brand-kit': { type: 'string' },
            'gambar-ahws': { type: 'string' },
        },
    })
    if (positionals.length === 0) throw new Error('Sebutkan paling sedikit satu ZIP atau folder paket')
    cekVersi(values.versi)
    return {
        sasaran: positionals,
        tanpaPanduan: Boolean(values['tanpa-panduan']),
        varian: values.varian === undefined ? undefined : cekVarian(values.varian, false)[0],
        jenis: values.paket === undefined ? undefined : cekPaket(values.paket, false)[0],
        versi: values.versi,
        brandKit: values['brand-kit'],
        gambarAhws: values['gambar-ahws'],
    }
}

// Menentukan varian, jenis, dan versi untuk sebuah paket dari nama folder akarnya; bila namanya
// bukan bentuk paket, dipakai --varian, --paket (bawaan web), dan --versi dari baris perintah.
// Mengembalikan null bila tidak bisa ditentukan.
export function kenaliPaket(namaAkar, { varian, jenis, versi } = {}) {
    const dariNama = bacaNamaPaket(namaAkar)
    if (dariNama) return dariNama
    if (!varian) return null
    return { varian, jenis: jenis ?? JENIS.web, versi: versi ?? '0.0.0' }
}
