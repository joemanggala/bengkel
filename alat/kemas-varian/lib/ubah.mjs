// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Isi berkas yang dibuat atau diubah saat pengemasan. Prinsipnya: sebisa mungkin berkas dibuat
// dari templat/ (README, panduan menjalankan, compose, pembuat database, .gitignore), bukan
// dibongkar dari berkas repo dengan penggantian teks. Dokumen repo ditulis untuk pengembang dan
// akan terus berubah; penggantian teks atas dokumen yang bukan milik alat ini rapuh, dan
// pengemas yang diam-diam melonggarkannya justru menyembunyikan masalah. Rujukan yang tersisa di
// dokumen lain tidak diperbaiki di sini, melainkan ditolak pemeriksa agar pemilik dokumennya
// memperbaikinya di sumber. Dua pengecualian yang disengaja: nilai port (API_URL web dan `servers`
// kontrak API) yang memang berbeda per varian, dan blok yang dibungkus penanda kemas:abaikan oleh
// penulisnya sendiri (lihat buangBlokInternal). Dengan penanda itulah README backend tidak lagi
// menyebut tes kontrak, skrip uji, atau runner migrate-uji di paket.

import { JENIS, PORT_MYSQL, PORT_WA_PALSU, PORT_WEB } from './aturan.mjs'

// Akhir baris paket mengikuti isi repo, yaitu LF. Git di Windows dengan core.autocrlf=true
// menulis CRLF ke working tree, dan skrip shell ber-CRLF gagal dijalankan di Linux dan macOS.
// Berkas biner (ada byte NUL di 8000 byte pertama, aturan yang sama dengan git) tidak disentuh;
// .bat dan .cmd justru dijadikan CRLF karena cmd.exe membutuhkannya. latin1 dipakai karena
// memetakan setiap byte apa adanya, jadi berkas yang bukan UTF-8 pun tidak rusak.
export function normalisasiEol(path, isi) {
    if (isi.subarray(0, 8000).includes(0)) return isi
    const lama = isi.toString('latin1')
    const lf = lama.replace(/\r\n/g, '\n')
    const baru = /\.(bat|cmd)$/i.test(path) ? lf.replace(/\n/g, '\r\n') : lf
    return baru === lama ? isi : Buffer.from(baru, 'latin1')
}

// Web memakai alamat backend Laravel (8802) sebagai bawaan. Di paket varian lain (kelak), bawaannya
// diganti ke port backend varian itu supaya langsung tersambung tanpa pembeli mengubah apa pun.
// Hanya nilainya yang diganti; komentar di sekitarnya dibiarkan. Di paket Laravel isinya tetap,
// tetapi bentuk barisnya tetap diperiksa.
export function gantiPortEnvWeb(teks, port) {
    const baru = teks.replace(/^API_URL=http:\/\/localhost:\d+$/m, `API_URL=http://localhost:${port}`)
    if (!new RegExp(`^API_URL=http://localhost:${port}$`, 'm').test(baru)) {
        throw new Error('web/.env.example tidak lagi memuat baris API_URL=http://localhost:<port>; sesuaikan gantiPortEnvWeb di lib/ubah.mjs')
    }
    return baru
}

// Kontrak API mencantumkan alamat dev backend di `servers`. Di repo hanya ada satu entri netral
// (http://localhost:8802); di paket port itu diganti ke port varian, dengan mekanisme yang sama
// seperti API_URL di web/.env.example. Harus tepat satu entri `- url: http://localhost:<port>`:
// nol berarti spec berubah bentuk, dua atau lebih berarti ada server lain yang ikut terganti.
export function gantiPortSpec(teks, port) {
    const pola = /^(\s+- url: http:\/\/localhost:)\d+$/gm
    const jumlah = [...teks.matchAll(pola)].length
    if (jumlah !== 1) {
        throw new Error(`spec/openapi.yaml memuat ${jumlah} entri "- url: http://localhost:<port>", seharusnya 1; sesuaikan gantiPortSpec di lib/ubah.mjs atau spec`)
    }
    return teks.replace(pola, `$1${port}`)
}

// ---- Blok internal --------------------------------------------------------------------------

// Bagian dokumen yang berguna bagi pengembang tetapi tidak untuk pembeli (mis. cara menjalankan
// tes kontrak) dibungkus penanda eksplisit oleh penulisnya, dan pengemas membuang seluruh blok
// beserta penandanya. Inilah SATU-SATUNYA penulisan ulang yang diizinkan atas dokumen bagian lain:
// penanda tidak bisa "bergeser" seperti penggantian teks, dan salah pasang langsung menghentikan
// pengemas. Penandanya satu baris sendiri, bergaya komentar menurut jenis berkas.
export const KATA_PENANDA = 'kemas:abaikan'
const GAYA_PENANDA = {
    markdown: { mulai: '<!-- kemas:abaikan-mulai -->', selesai: '<!-- kemas:abaikan-selesai -->' },
    tagar: { mulai: '# kemas:abaikan-mulai', selesai: '# kemas:abaikan-selesai' },
}

export function gayaPenanda(path) {
    const nama = path.split('/').pop()
    if (/\.md$/i.test(nama)) return GAYA_PENANDA.markdown
    if (nama === '.env.example' || nama === '.gitignore') return GAYA_PENANDA.tagar
    return null
}

// Membuang blok bertanda dari teks. Gagal keras bila penanda muncul di jenis berkas yang tidak
// mendukungnya, tidak berpasangan, bersarang, atau tidak berdiri sendiri di satu baris. Baris kosong
// ganda yang tertinggal di bekas blok dirapikan menjadi satu.
export function buangBlokInternal(path, teks) {
    if (!teks.includes(KATA_PENANDA)) return teks
    const gaya = gayaPenanda(path)
    if (!gaya) {
        throw new Error(`${path}: memuat penanda ${KATA_PENANDA}, tetapi jenis berkas ini tidak mendukungnya (hanya .md, .env.example, dan .gitignore)`)
    }
    const hasil = []
    let bukaDi = 0
    let sesudahBlok = false
    teks.split('\n').forEach((baris, i) => {
        const no = i + 1
        const t = baris.trim()
        if (t === gaya.mulai) {
            if (bukaDi) throw new Error(`${path}:${no}: penanda ${gaya.mulai} bersarang di dalam blok yang dibuka di baris ${bukaDi}`)
            bukaDi = no
        } else if (t === gaya.selesai) {
            if (!bukaDi) throw new Error(`${path}:${no}: penanda ${gaya.selesai} tanpa pembuka`)
            bukaDi = 0
            sesudahBlok = true
        } else if (baris.includes(KATA_PENANDA)) {
            throw new Error(`${path}:${no}: penanda ${KATA_PENANDA} harus berdiri sendiri di satu baris, tepat "${gaya.mulai}" atau "${gaya.selesai}"`)
        } else if (!bukaDi) {
            const kosongGanda = sesudahBlok && t === '' && (hasil.length === 0 || hasil.at(-1).trim() === '')
            sesudahBlok = false
            if (!kosongGanda) hasil.push(baris)
        }
    })
    if (bukaDi) throw new Error(`${path}:${bukaDi}: penanda ${gaya.mulai} tidak ditutup`)
    return hasil.join('\n')
}

// Templat memakai {{nama}} untuk isian dan blok bersyarat untuk bagian yang hanya berlaku di
// sebagian varian atau jenis paket. Penanda blok ({{#go}} ... {{/go}} untuk "bila varian Go",
// {{^go}} ... {{/go}} untuk "bila bukan", dan {{#mobile}} ... {{/mobile}} untuk "bila paket
// lengkap", {{^mobile}} ... {{/mobile}} untuk "bila paket web") harus berdiri sendiri di satu
// baris, dan namanya harus saklar true/false di `nilai`. Salah ketik, blok yang tidak ditutup, isian yang tidak diisi, atau tanda {{ }} yang
// tersisa menghentikan pengemas, bukan menghasilkan README yang berantakan.
export function isiTemplat(templat, nilai, nama = 'templat') {
    const keluar = []
    const tumpukan = []
    for (const baris of templat.split('\n')) {
        const buka = /^\{\{([#^])(\w+)\}\}$/.exec(baris)
        const tutup = /^\{\{\/(\w+)\}\}$/.exec(baris)
        if (buka) {
            const [, tanda, saklar] = buka
            if (typeof nilai[saklar] !== 'boolean') {
                throw new Error(`${nama}: blok {{${tanda}${saklar}}} bukan saklar true/false`)
            }
            tumpukan.push({ saklar, aktif: tanda === '#' ? nilai[saklar] : !nilai[saklar] })
        } else if (tutup) {
            if (tumpukan.pop()?.saklar !== tutup[1]) throw new Error(`${nama}: blok {{/${tutup[1]}}} ditutup tanpa dibuka`)
        } else if (tumpukan.every((t) => t.aktif)) {
            keluar.push(baris)
        }
    }
    if (tumpukan.length > 0) throw new Error(`${nama}: blok {{${tumpukan.at(-1).saklar}}} tidak ditutup`)

    const teks = keluar.join('\n').replace(/\{\{(\w+)\}\}/g, (cocok, kunci) => {
        if (!(kunci in nilai)) throw new Error(`${nama}: memakai {{${kunci}}} yang tidak diisi`)
        return String(nilai[kunci])
    })
    const sisa = /\{\{|\}\}/.exec(teks)
    if (sisa) throw new Error(`${nama}: masih memuat tanda "${sisa[0]}" yang tidak dikenali`)
    return teks
}

// Isian dan saklar templat untuk satu varian dan jenis paket. `mobile` adalah saklar untuk blok
// {{#mobile}} ... {{/mobile}} (paket dengan aplikasi staf, kelak) dan {{^mobile}} ... {{/mobile}}.
export function nilaiTemplat(varian, versi, jenis = JENIS.web) {
    return {
        nama: varian.nama,
        versi,
        folder: varian.folder,
        port: String(varian.port),
        portWeb: String(PORT_WEB),
        portMysql: String(PORT_MYSQL),
        portWa: String(PORT_WA_PALSU),
        prasyarat: varian.prasyarat ? `, ${varian.prasyarat}` : '',
        prasyaratBackend: varian.prasyarat,
        siapkan: varian.siapkan.join('\n'),
        mulai: varian.mulai.join('\n'),
        migrasi: varian.migrasi,
        // Awalan perintah migration yang memakai argumen (versi, paksa N); npm butuh "--".
        migrasiArg: varian.migrasiArg ?? varian.migrasi,
        uji: varian.uji,
        go: varian.kode === 'go',
        laravel: varian.kode === 'laravel',
        nestjs: varian.kode === 'nestjs',
        mobile: jenis.mobile,
    }
}

// Layanan docker-compose: { image, ports } per nama layanan di bawah "services:". Pembaca ini
// sengaja kecil (indentasi 2 spasi untuk layanan, 4 untuk propertinya, seperti compose repo ini),
// cukup untuk membandingkan image dan port tanpa dependensi YAML.
export function bacaLayanan(teks) {
    const hasil = new Map()
    let dalamServices = false
    let kini = null
    let dalamPorts = false
    for (const baris of teks.split('\n')) {
        if (/^[A-Za-z]/.test(baris)) {
            dalamServices = /^services:\s*$/.test(baris)
            kini = null
            continue
        }
        if (!dalamServices) continue
        const layanan = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(baris)
        if (layanan) {
            kini = { image: null, ports: [] }
            hasil.set(layanan[1], kini)
            dalamPorts = false
            continue
        }
        if (!kini) continue
        const image = /^ {4}image:\s*(\S+)/.exec(baris)
        if (image) kini.image = image[1]
        if (/^ {4}ports:\s*$/.test(baris)) dalamPorts = true
        else if (/^ {4}[A-Za-z]/.test(baris)) dalamPorts = false
        const port = dalamPorts && /^ {6}-\s*"?([^"\s]+)"?/.exec(baris)
        if (port) kini.ports.push(port[1])
    }
    return hasil
}

// compose di templat adalah salinan yang dirampingkan dari compose repo (tanpa runner migrate-uji*
// dan database tes kontrak). Bila image atau port di repo berubah (mis. digest MySQL dinaikkan)
// dan templat tertinggal, paket akan menjual versi lama; karena itu keduanya dibandingkan setiap
// kali mengemas. Mengembalikan daftar galat (kosong = sinkron).
export function periksaSinkronCompose(teksRepo, teksTemplat) {
    const repo = bacaLayanan(teksRepo)
    const templat = bacaLayanan(teksTemplat)
    const galat = []
    for (const [nama, mau] of templat) {
        const ada = repo.get(nama)
        if (!ada) {
            galat.push(`docker-compose.yml di repo tidak lagi punya layanan "${nama}"; sesuaikan templat/docker-compose.yml`)
            continue
        }
        if (ada.image !== mau.image) {
            galat.push(`layanan "${nama}": image di repo ${ada.image} berbeda dari templat ${mau.image}; sinkronkan templat/docker-compose.yml`)
        }
        if (ada.ports.join(',') !== mau.ports.join(',')) {
            galat.push(`layanan "${nama}": port di repo [${ada.ports}] berbeda dari templat [${mau.ports}]; sinkronkan templat/docker-compose.yml`)
        }
    }
    return galat
}
