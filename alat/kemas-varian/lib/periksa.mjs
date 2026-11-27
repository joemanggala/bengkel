// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pemeriksaan paket jadi. Dijalankan pengemas setelah setiap ZIP dibuat, dan bisa dijalankan
// sendiri untuk ZIP atau folder apa pun sebelum diunggah (periksa.mjs). Satu galat saja sudah
// cukup untuk menolak paket: lebih baik gagal di laptop penjual daripada bocor atau rusak di
// tangan pembeli. Fungsi di sini murni (masukan: isi paket di memori), jadi mudah dites.

import { createHash } from 'node:crypto'
import { posix } from 'node:path'
import {
    AKAR_MOBILE,
    ATURAN_BOLEH_DI_README_AKAR,
    BERKAS_BESAR_SAH,
    BERKAS_BOLEH_MEREK,
    BERKAS_KUNCI,
    BERKAS_VERSI_PAKET,
    DATABASE_URL_DEV,
    EMAIL_HAK_CIPTA,
    FOLDER_PANDUAN,
    JENIS,
    MAKS_UKURAN_BERKAS,
    MEREK_BOLEH_DI_PANDUAN,
    NAMA_DATABASE,
    PANDUAN_WAJIB,
    PORT_WA_PALSU,
    POLA_AHWS,
    POLA_AHWS_NAMA,
    POLA_BERKAS_INTERNAL,
    POLA_BERKAS_SISA,
    POLA_DOKUMEN_TERLARANG,
    POLA_FOLDER_RUNTIME,
    POLA_JALUR_MESIN,
    POLA_MEREK,
    POLA_NAMA_BACKEND,
    POLA_NAMA_RAHASIA,
    POLA_RAHASIA,
    POLA_URL_KREDENSIAL,
    PUBLIC_WEB_URL_DEV,
    README_AKAR,
    RUJUKAN_MOBILE,
    RUJUKAN_TERLARANG,
    SEGMEN_TERLARANG,
    TEKS_HEADER,
    TERLARANG,
    VARIAN,
    WA_API_URL_DEV,
    berkasDokumen,
    berkasRahasia,
    folderBackendLain,
    hostKredensialSah,
    namaPaket,
    nilaiRahasiaSah,
    wajibHeader,
} from './aturan.mjs'
import { bacaLayanan } from './ubah.mjs'
import { bacaZip } from './zip.mjs'

const BINER = /\.(png|jpe?g|gif|webp|ico|icns|zip|jar|ttf|otf|woff2?|mp4|pdf|docx|xlsx|pptx)$/i
const BATAS_PINDAI = 2 * 1024 * 1024

const adaNul = (isi) => isi.subarray(0, 8000).includes(0)
const teksBerkas = (nama, isi) => (BINER.test(nama) || adaNul(isi) ? null : isi.toString('utf8'))

// Berapa temuan sejenis yang dicantumkan per berkas sebelum diringkas, supaya satu dokumen yang
// salah tidak membanjiri laporan.
const MAKS_TEMUAN_PER_BERKAS = 3

const kutip = (baris) => `"${baris.trim().slice(0, 100)}${baris.trim().length > 100 ? '…' : ''}"`

// Isi .env sederhana: NAMA=nilai per baris, komentar diawali #. Kutip pembungkus dibuang.
export function bacaEnv(teks) {
    const hasil = new Map()
    for (const baris of teks.split(/\r?\n/)) {
        const cocok = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(baris)
        if (!cocok) continue
        hasil.set(cocok[1], cocok[2].trim().replace(/^(['"])(.*)\1$/, '$2'))
    }
    return hasil
}

// Berkas wajib setiap paket. Folder (berakhiran /) cukup berisi minimal satu berkas. Panduan Word
// diperiksa terpisah (periksaPanduan) karena bisa dimatikan dengan --tanpa-panduan. Paket dengan
// aplikasi staf (kelak) menambah berkas inti mobile/ di sini; di paket web, apa pun di mobile/
// malah terlarang (periksaPaket).
export const wajibAda = (varian) => [
    'README.md',
    'LICENSE',
    '.gitignore',
    BERKAS_VERSI_PAKET,
    'docker-compose.yml',
    `${varian.folder}/README.md`,
    `${varian.folder}/.env.example`,
    `${varian.folder}/${varian.manifes}`,
    'web/package.json',
    'web/package-lock.json',
    'web/.env.example',
    'web/README.md',
    'spec/openapi.yaml',
    'spec/whatsapp.md',
    'db/migrations/',
    'db/init/01-buat-database.sql',
    'docs/menjalankan.md',
    'tests/wa-palsu/package.json',
    'tests/wa-palsu/src/server.ts',
]

// ---- Header hak cipta -----------------------------------------------------------------------

// Mengembalikan null bila berkas diawali header dua baris, atau { baris, alasan } bila tidak.
// Boleh didahului shebang, <?php, atau <?xml (dan baris kosong sesudahnya), dan penanda
// komentarnya bebas: //, #, --, blok /* */ , atau <!-- -->.
export function periksaHeader(teks) {
    const baris = teks.replace(/^﻿/, '').split(/\r?\n/)
    let i = 0
    let pembuka = false
    while (i < baris.length && /^(?:#!|<\?php\b|<\?xml\b)/.test(baris[i])) {
        i++
        pembuka = true
    }
    if (pembuka) while (i < baris.length && baris[i].trim() === '') i++
    if (baris[i]?.trim() === '/*') i++
    const bersih = (b) =>
        (b ?? '')
            .replace(/^\s*(?:\/\/|#|--|\*|<!--)\s?/, '')
            .replace(/\s*(?:-->|\*\/)\s*$/, '')
            .trim()
    for (const [k, pola] of TEKS_HEADER.entries()) {
        if (!pola.test(bersih(baris[i + k]))) {
            return { baris: i + k + 1, alasan: k === 0 ? 'baris pertama header hak cipta tidak ada' : 'baris kedua header (Lisensi: ...) tidak ada' }
        }
    }
    return null
}

// ---- Rujukan terlarang ----------------------------------------------------------------------

// Rujukan yang tidak seharusnya ada di teks sebuah berkas paket: path yang tidak ikut dikemas,
// backend lain, frasa pengembang, dan (paket web) perintah serta jalur aplikasi staf. Mengembalikan
// galat yang menunjuk berkas dan barisnya. Aturannya di lib/aturan.mjs; "docs/panduan" dan
// "tests/wa-palsu" sah dan tidak dicari, begitu pula kata "mobile" sebagai konsep.
export function cariRujukan(path, teks, varian, jenis = JENIS.web) {
    if (BERKAS_KUNCI.has(path.split('/').pop())) return []
    const dokumen = berkasDokumen(path)
    const lain = Object.values(VARIAN).filter((v) => v.kode !== varian.kode)
    const aturan = RUJUKAN_TERLARANG.filter((a) => !a.dokumen || dokumen)
    for (const v of lain) {
        aturan.push({ id: 'folder-backend-lain', nama: `folder ${v.folder}`, pola: new RegExp(`${v.folder}(?![A-Za-z0-9_])`) })
    }
    if (dokumen) {
        aturan.push(...POLA_DOKUMEN_TERLARANG)
        for (const v of lain) {
            aturan.push(
                { id: 'nama-backend-lain', nama: `nama backend ${v.nama}`, pola: POLA_NAMA_BACKEND[v.kode] },
                { id: 'port-backend-lain', nama: `port backend ${v.nama} (${v.port})`, pola: new RegExp(String.raw`:${v.port}\b`) },
            )
        }
    }
    if (!jenis.mobile) aturan.push(...RUJUKAN_MOBILE)
    const berlaku = path === README_AKAR ? aturan.filter((a) => !ATURAN_BOLEH_DI_README_AKAR.has(a.id)) : aturan

    const galat = []
    const jumlah = new Map()
    teks.split('\n').forEach((baris, i) => {
        for (const { nama, pola } of berlaku) {
            if (!pola.test(baris)) continue
            const n = (jumlah.get(nama) ?? 0) + 1
            jumlah.set(nama, n)
            if (n <= MAKS_TEMUAN_PER_BERKAS) {
                galat.push(`${path}:${i + 1}: merujuk ${nama}, yang tidak ikut paket ini: ${kutip(baris)}`)
            }
        }
    })
    for (const [nama, n] of jumlah) {
        if (n > MAKS_TEMUAN_PER_BERKAS) galat.push(`${path}: … dan ${n - MAKS_TEMUAN_PER_BERKAS} rujukan ${nama} lainnya`)
    }
    return galat
}

// ---- Rahasia --------------------------------------------------------------------------------

const BERKAS_BERISI_ENV = (path) => /(?:^|\/)\.env\.example$|\.(?:md|sh|ya?ml)$/i.test(path)

// Pola rahasia khas, URL berkredensial ke host sungguhan, dan nilai env rahasia yang bukan contoh.
export function cariRahasia(path, teks) {
    const galat = []
    for (const { nama, pola } of POLA_RAHASIA) {
        if (pola.test(teks)) galat.push(`${path}: memuat ${nama}`)
    }
    for (const m of teks.matchAll(POLA_URL_KREDENSIAL)) {
        if (!hostKredensialSah(m[1])) {
            const baris = teks.slice(0, m.index).split('\n').length
            galat.push(`${path}:${baris}: URL berkredensial ke host sungguhan "${m[1]}"`)
        }
    }
    if (BERKAS_BERISI_ENV(path)) {
        teks.split('\n').forEach((baris, i) => {
            const cocok = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(baris)
            if (!cocok || !POLA_NAMA_RAHASIA.test(cocok[1])) return
            const nilai = cocok[2].replace(/\s+#.*$/, '').trim()
            // Substitusi perintah shell ($(...) atau `...`) mengambil nilai saat dijalankan, jadi
            // bukan rahasia yang tertulis; di contoh perintah, substitusi sering berlanjut ke baris berikutnya.
            const perintah = /^\$\(|^`/.test(nilai)
            if (!perintah && !nilaiRahasiaSah(nilai)) {
                galat.push(`${path}:${i + 1}: ${cocok[1]} berisi nilai yang tidak tampak seperti contoh`)
            }
        })
    }
    if (path.split('/').pop() === '.env.example') {
        // Token pemasangan awal yang tertulis di paket terbaca semua pembeli, jadi server yang
        // memakainya bisa direbut sebelum akun pemilik dibuat. Pembeli wajib mengisinya sendiri.
        const setup = bacaEnv(teks).get('SETUP_TOKEN')
        if (setup) galat.push(`${path}: SETUP_TOKEN wajib kosong supaya pembeli mengisi nilai acak sendiri`)
    }
    return galat
}

// ---- Tautan dan rujukan jalur di Markdown ---------------------------------------------------

// Baris Markdown di luar blok kode berpagar, dengan nomor barisnya.
function barisDiLuarKode(teks) {
    const hasil = []
    let dalam = false
    teks.split('\n').forEach((baris, i) => {
        if (/^\s*(?:```|~~~)/.test(baris)) {
            dalam = !dalam
            return
        }
        if (!dalam) hasil.push({ no: i + 1, baris })
    })
    return hasil
}

// Slug judul gaya GitHub: huruf kecil, hanya huruf/angka/spasi/garis, spasi menjadi "-". Judul
// kembar diberi akhiran -1, -2, ... seperti yang dilakukan GitHub.
export function slugJudul(teks) {
    return teks
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[`*~]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .trim()
        .replace(/ /g, '-')
}

export function daftarAnchor(teks) {
    const dipakai = new Map()
    const hasil = new Set()
    for (const { baris } of barisDiLuarKode(teks)) {
        const judul = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(baris)
        if (!judul) continue
        const dasar = slugJudul(judul[1])
        const n = dipakai.get(dasar) ?? 0
        dipakai.set(dasar, n + 1)
        hasil.add(n === 0 ? dasar : `${dasar}-${n}`)
    }
    return hasil
}

const POLA_TAUTAN = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g
const TOP_DIKENAL = new Set(['web', 'spec', 'db', 'docs', 'tests', 'mobile', 'LICENSE', 'README.md', 'VERSION', 'docker-compose.yml', ...Object.values(VARIAN).map((v) => v.folder)])

// Jalur yang memang tidak ada di paket tetapi sah disebut: dibuat pembeli (env lokal) atau hasil
// build dan data runtime.
function jalurDibuatPembeli(jalur) {
    const segmen = jalur.split('/')
    const nama = segmen.at(-1)
    return (
        /^\.env(?!\.example$)/.test(nama) ||
        segmen.slice(0, -1).some((s) => SEGMEN_TERLARANG.has(s)) ||
        SEGMEN_TERLARANG.has(nama) ||
        POLA_FOLDER_RUNTIME.test(jalur.endsWith('/') ? jalur : `${jalur}/`)
    )
}

// Tautan Markdown relatif (termasuk anchor-nya) di semua .md, dan rujukan jalur dalam tanda
// kutip balik di README akar serta dokumen docs/. Mengembalikan galat per rujukan yang rusak.
export function periksaTautan(isi, { tanpaPanduan = false, varian, jenis = JENIS.web } = {}) {
    const galat = []
    const ada = (jalur) => isi.has(jalur) || [...isi.keys()].some((k) => k.startsWith(`${jalur.replace(/\/$/, '')}/`))
    const lewati = (jalur) => tanpaPanduan && (jalur === 'docs/panduan' || jalur.startsWith(FOLDER_PANDUAN))
    const cacheAnchor = new Map()
    const anchorDari = (jalur) => {
        if (!cacheAnchor.has(jalur)) cacheAnchor.set(jalur, daftarAnchor(isi.get(jalur).toString('utf8')))
        return cacheAnchor.get(jalur)
    }
    // Folder yang sengaja tidak ada di paket ini dan sudah ditolak aturan lain (backend varian lain;
    // mobile/ di paket web), jadi rujukan ke sana tidak dilaporkan lagi sebagai tautan rusak.
    const lain = [...(varian ? folderBackendLain(varian).map((f) => f.replace(/\/$/, '')) : []), ...(jenis.mobile ? [] : [AKAR_MOBILE.replace(/\/$/, '')])]

    for (const [path, buf] of isi) {
        if (!path.toLowerCase().endsWith('.md')) continue
        const teks = buf.toString('utf8')
        const periksaJalurKutip = path === README_AKAR || path.startsWith('docs/')
        for (const { no, baris } of barisDiLuarKode(teks)) {
            for (const m of baris.matchAll(POLA_TAUTAN)) {
                const target = m[1]
                if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) continue
                const [bagianBerkas, anchorMentah] = target.split('#')
                let berkas = bagianBerkas.split('?')[0]
                let anchor = anchorMentah
                try {
                    berkas = decodeURIComponent(berkas)
                    anchor = anchor && decodeURIComponent(anchor)
                } catch {
                    // Persen yang tidak sah dibiarkan apa adanya; pasti tidak ditemukan di bawah.
                }
                const tujuan = berkas === '' ? path : berkas.startsWith('/') ? posix.normalize(berkas.slice(1)) : posix.normalize(posix.join(posix.dirname(path), berkas))
                if (tujuan.startsWith('..')) {
                    galat.push(`${path}:${no}: tautan "${target}" keluar dari folder paket`)
                    continue
                }
                const jalur = tujuan.replace(/\/$/, '')
                if (lewati(jalur) || lain.some((f) => jalur === f || jalur.startsWith(`${f}/`)) || jalurDibuatPembeli(jalur)) continue
                if (!ada(jalur)) {
                    galat.push(`${path}:${no}: tautan "${target}" rusak, ${jalur} tidak ada di paket`)
                } else if (anchor && isi.has(jalur) && jalur.toLowerCase().endsWith('.md') && !anchorDari(jalur).has(anchor.toLowerCase())) {
                    galat.push(`${path}:${no}: tautan "${target}" rusak, judul #${anchor} tidak ada di ${jalur}`)
                }
            }
            if (!periksaJalurKutip) continue
            for (const m of baris.matchAll(/`([^`\n]+)`/g)) {
                const calon = m[1].trim()
                if (!/^(?:\.\/)?[A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)*\/?$/.test(calon)) continue
                const jalur = calon.replace(/^\.\//, '').replace(/\/$/, '')
                const pertama = jalur.split('/')[0]
                if (!TOP_DIKENAL.has(pertama) || lain.includes(pertama)) continue
                if (lewati(jalur) || jalurDibuatPembeli(jalur)) continue
                if (!ada(jalur)) galat.push(`${path}:${no}: merujuk \`${calon}\`, yang tidak ada di paket`)
            }
        }
    }
    return galat
}

// ---- Panduan Word ---------------------------------------------------------------------------

// Teks dari bagian XML sebuah .docx, tanpa tag. Akhir paragraf dijadikan baris baru supaya
// rujukan di paragraf berbeda tidak menyatu.
function teksDocx(entri) {
    return entri
        .filter((e) => /^word\/.*\.xml$/.test(e.nama))
        .map((e) => e.isi.toString('utf8').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ''))
        .join('\n')
}

// Empat panduan wajib ada, berupa .docx yang bisa dibuka, dan teksnya tidak boleh merujuk hal
// internal. Berkas lain di docs/panduan ditolak: folder ini hanya untuk keempat panduan itu.
function periksaPanduan(isi, { tanpaPanduan, varian, hashMerek }) {
    const galat = []
    if (!tanpaPanduan) {
        for (const nama of PANDUAN_WAJIB) {
            if (!isi.has(FOLDER_PANDUAN + nama)) galat.push(`${FOLDER_PANDUAN}${nama}: panduan Word wajib ada di paket tetapi tidak ditemukan`)
        }
    }
    for (const [path, buf] of isi) {
        if (!path.startsWith(FOLDER_PANDUAN)) continue
        if (!PANDUAN_WAJIB.includes(path.slice(FOLDER_PANDUAN.length))) {
            galat.push(`${path}: bukan salah satu dari empat panduan Word yang ditetapkan (${PANDUAN_WAJIB.join(', ')})`)
            continue
        }
        let bagian
        try {
            bagian = bacaZip(buf)
        } catch (e) {
            galat.push(`${path}: bukan berkas .docx yang sah (${e.message})`)
            continue
        }
        const nama = new Set(bagian.map((b) => b.nama))
        if (!nama.has('[Content_Types].xml') || !nama.has('word/document.xml')) {
            galat.push(`${path}: bukan berkas .docx yang sah (tidak punya [Content_Types].xml atau word/document.xml)`)
            continue
        }
        const teks = teksDocx(bagian)
        for (const { nama: n, pola } of RUJUKAN_TERLARANG.filter((a) => !a.dokumen)) {
            const m = pola.exec(teks)
            if (m) galat.push(`${path}: teks panduan merujuk ${n}, yang tidak ikut paket ini: "${teks.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, ' ')}"`)
        }
        for (const v of Object.values(VARIAN).filter((v) => v.kode !== varian.kode)) {
            if (new RegExp(`${v.folder}(?![A-Za-z0-9_])`).test(teks)) galat.push(`${path}: teks panduan merujuk folder ${v.folder}, yang tidak ikut paket ini`)
        }
        if (POLA_JALUR_MESIN.test(teks)) galat.push(`${path}: teks panduan memuat jalur absolut mesin pengembang`)
        if (!MEREK_BOLEH_DI_PANDUAN && POLA_MEREK.test(teks.replaceAll(EMAIL_HAK_CIPTA, ''))) galat.push(`${path}: teks panduan memuat nama brand toko (hanya boleh di LICENSE dan README paket)`)
        if (POLA_AHWS.test(teks)) galat.push(`${path}: teks panduan memuat nama AHWS (situs klien, proyek terpisah)`)
        // Gambar di dalam panduan juga dibandingkan dengan gambar terlarang (brand kit, AHWS).
        for (const b of bagian) {
            if (!b.nama.startsWith('word/media/')) continue
            const asal = hashMerek?.get(createHash('sha256').update(b.isi).digest('hex'))
            if (asal && !(MEREK_BOLEH_DI_PANDUAN && asal.startsWith('brand kit'))) galat.push(`${path}: gambar ${b.nama} sama dengan ${asal}`)
            else if (POLA_AHWS_NAMA.test(b.nama) || POLA_AHWS.test(b.isi.toString('latin1'))) galat.push(`${path}: gambar ${b.nama} memuat nama AHWS`)
        }
    }
    return galat
}

// ---- Kecocokan antarbagian ------------------------------------------------------------------

// Paket yang bisa dijalankan pembeli tanpa mengubah apa pun: backend dan web menunjuk ke port
// varian, backend memakai token yang sama dengan WhatsApp palsu, database dari compose, dan alamat
// web dev untuk tautan WhatsApp; compose serta pembuat database tidak membawa apa pun dari tes
// kontrak; dan VERSION sama dengan versi di nama paket.
function periksaKonsistensi(isi, varian, versi) {
    const galat = []
    const baca = (path) => isi.get(path)?.toString('utf8')

    const envBackend = baca(`${varian.folder}/.env.example`)
    const server = baca('tests/wa-palsu/src/server.ts')
    if (envBackend !== undefined) {
        const env = bacaEnv(envBackend)
        const di = `${varian.folder}/.env.example`
        if (env.get('PORT') !== String(varian.port)) galat.push(`${di}: PORT harus ${varian.port}, bukan "${env.get('PORT') ?? ''}"`)
        if (env.get('WA_API_URL') !== WA_API_URL_DEV) galat.push(`${di}: WA_API_URL harus ${WA_API_URL_DEV} (WhatsApp palsu dev)`)
        if (env.get('DATABASE_URL') !== DATABASE_URL_DEV) galat.push(`${di}: DATABASE_URL harus ${DATABASE_URL_DEV} (MySQL dari docker-compose.yml)`)
        if (env.get('PUBLIC_WEB_URL') !== PUBLIC_WEB_URL_DEV) galat.push(`${di}: PUBLIC_WEB_URL harus ${PUBLIC_WEB_URL_DEV} (web dev), supaya tautan di pesan WhatsApp terbuka di laptop`)
        const token = server && /TOKEN_BAWAAN\s*=\s*'([^']+)'/.exec(server)?.[1]
        if (!token) {
            galat.push('tests/wa-palsu/src/server.ts: TOKEN_BAWAAN tidak ditemukan')
        } else if (env.get('WA_TOKEN') !== token) {
            galat.push(`${di}: WA_TOKEN tidak sama dengan token bawaan WhatsApp palsu, sehingga pesan gagal terkirim saat pembeli mencoba di laptop`)
        }
    }
    const envWeb = baca('web/.env.example')
    if (envWeb !== undefined && bacaEnv(envWeb).get('API_URL') !== `http://localhost:${varian.port}`) {
        galat.push(`web/.env.example: API_URL harus http://localhost:${varian.port}`)
    }
    // Web menyusun tautan lacak di nota dan tombol Salin dari PUBLIC_WEB_URL miliknya sendiri; nilai
    // yang berbeda dengan backend membuat tautan di nota tidak sama dengan tautan di pesan WhatsApp.
    if (envWeb !== undefined && bacaEnv(envWeb).get('PUBLIC_WEB_URL') !== PUBLIC_WEB_URL_DEV) {
        galat.push(`web/.env.example: PUBLIC_WEB_URL harus ${PUBLIC_WEB_URL_DEV}, sama dengan backend, supaya tautan di nota sama dengan tautan di pesan WhatsApp`)
    }
    // Semua dokumen menyebut WhatsApp palsu di port 8890; bila kodenya mendengarkan di port lain, `npm start`
    // yang diikuti pembeli menyala di tempat yang salah dan pesan tidak pernah terlihat.
    const portMain = /WA_PALSU_PORT \?\? (\d+)/.exec(baca('tests/wa-palsu/src/main.ts') ?? '')?.[1]
    if (portMain && portMain !== String(PORT_WA_PALSU)) {
        galat.push(`tests/wa-palsu/src/main.ts: port bawaan WhatsApp palsu ${portMain}, padahal README dan .env.example backend memakai ${PORT_WA_PALSU}`)
    }
    const envWa = baca('tests/wa-palsu/.env.example')
    if (envWa !== undefined && bacaEnv(envWa).get('WA_PALSU_PORT') !== String(PORT_WA_PALSU)) {
        galat.push(`tests/wa-palsu/.env.example: WA_PALSU_PORT harus ${PORT_WA_PALSU}`)
    }
    const versiBerkas = baca(BERKAS_VERSI_PAKET)
    if (versiBerkas !== undefined && versiBerkas.trim() !== versi) {
        galat.push(`${BERKAS_VERSI_PAKET}: berisi "${versiBerkas.trim()}", padahal nama paket memakai versi ${versi}`)
    }
    const spec = baca('spec/openapi.yaml')
    if (spec !== undefined) {
        for (const m of spec.matchAll(/^\s+- url: http:\/\/localhost:(\d+)$/gm)) {
            if (m[1] !== String(varian.port)) {
                const baris = spec.slice(0, m.index + m[0].indexOf('- url')).split('\n').length
                galat.push(`spec/openapi.yaml:${baris}: servers menunjuk port ${m[1]}, harus ${varian.port} (backend varian ini)`)
            }
        }
    }
    const compose = baca('docker-compose.yml')
    if (compose !== undefined) {
        const layanan = bacaLayanan(compose)
        for (const wajib of ['mysql', 'migrate-dev']) {
            if (!layanan.has(wajib)) galat.push(`docker-compose.yml: layanan ${wajib} tidak ada`)
        }
        for (const nama of layanan.keys()) {
            if (nama.startsWith('migrate-uji')) galat.push(`docker-compose.yml: masih memuat runner ${nama} untuk tes kontrak`)
        }
    }
    const init = baca('db/init/01-buat-database.sql')
    if (init !== undefined) {
        const nama = [...init.matchAll(/CREATE DATABASE\s+(?:IF NOT EXISTS\s+)?`?(\w+)`?/gi)].map((m) => m[1])
        for (const n of nama.filter((n) => n !== NAMA_DATABASE)) galat.push(`db/init/01-buat-database.sql: membuat database ${n}; paket hanya membutuhkan database ${NAMA_DATABASE}`)
        if (!nama.includes(NAMA_DATABASE)) galat.push(`db/init/01-buat-database.sql: tidak membuat database ${NAMA_DATABASE}`)
    }
    return galat
}

// ---- Pemeriksaan utama ----------------------------------------------------------------------

// entri: hasil bacaZip atau bacaFolder ({ nama, isi, sha256 }). hashMerek: Map sha256 → asal
// gambar terlarang (brand kit toko, gambar AHWS), atau null bila pemeriksaan gambar dilewati.
export function periksaPaket(entri, { varian, versi, jenis = JENIS.web, tanpaPanduan = false, hashMerek = null }) {
    const galat = []
    const awalan = `${namaPaket(varian, versi, jenis)}/`
    const isi = new Map()

    for (const e of entri) {
        if (!e.nama.startsWith(awalan)) {
            galat.push(`${e.nama}: tidak berada di folder ${awalan}`)
            continue
        }
        const path = e.nama.slice(awalan.length)
        if (isi.has(path)) galat.push(`${path}: nama berkas ganda di paket`)
        // Paket web tidak boleh memuat satu berkas pun di mobile/. Berkas itu cukup dilaporkan sekali;
        // isinya tidak diperiksa lagi karena seluruh folder harus dibuang, bukan diperbaiki.
        if (!jenis.mobile && path.startsWith(AKAR_MOBILE)) {
            galat.push(`${path}: paket web tidak boleh memuat apa pun di ${AKAR_MOBILE}`)
            continue
        }
        isi.set(path, e.isi)
        if (path.includes('\\') || path.split('/').includes('..') || path.startsWith('/')) {
            galat.push(`${path}: nama berkas tidak aman (jalur mundur, absolut, atau memakai garis miring terbalik)`)
        }
        for (const t of [...TERLARANG, ...folderBackendLain(varian)]) {
            if (path.startsWith(t)) galat.push(`${path}: ${t.endsWith('/') ? 'folder' : 'berkas'} ${t} tidak boleh ikut dijual`)
        }
        for (const a of POLA_BERKAS_INTERNAL) if (a.pola.test(path)) galat.push(`${path}: ${a.nama} tidak boleh ikut dijual`)
        if (path.split('/').slice(0, -1).some((s) => SEGMEN_TERLARANG.has(s)) || POLA_FOLDER_RUNTIME.test(path)) {
            galat.push(`${path}: hasil build, dependensi, atau data runtime ikut terbawa`)
        }
        if (berkasRahasia(path)) galat.push(`${path}: berkas rahasia ikut terbawa`)
        if (POLA_BERKAS_SISA.test(path)) galat.push(`${path}: sisa build atau sistem operasi ikut terbawa`)
        if (hashMerek?.has(e.sha256)) galat.push(`${path}: isinya sama dengan gambar ${hashMerek.get(e.sha256)}`)
        // AHWS ditolak di mana pun: nama berkas, teks, dan isi biner (metadata gambar). Panduan Word
        // dibaca terpisah (periksaPanduan), karena isinya terkompresi.
        if (POLA_AHWS_NAMA.test(path)) {
            galat.push(`${path}: nama berkas memuat AHWS (situs klien, proyek terpisah)`)
        } else if (!path.startsWith(FOLDER_PANDUAN) && POLA_AHWS.test(e.isi.toString('latin1'))) {
            const teksAhws = teksBerkas(path, e.isi)
            const baris = teksAhws === null ? -1 : teksAhws.split('\n').findIndex((b) => POLA_AHWS.test(b))
            galat.push(`${path}${baris >= 0 ? `:${baris + 1}` : ''}: memuat nama AHWS (situs klien, proyek terpisah)`)
        }
        if (e.isi.length > MAKS_UKURAN_BERKAS && !BERKAS_BESAR_SAH.has(path)) {
            galat.push(`${path}: berukuran ${(e.isi.length / 1024 / 1024).toFixed(1)} MB, melebihi batas ${MAKS_UKURAN_BERKAS / 1024 / 1024} MB untuk berkas tak terduga`)
        }

        const teks = e.isi.length <= BATAS_PINDAI ? teksBerkas(path, e.isi) : null
        if (teks === null) continue
        galat.push(...cariRahasia(path, teks))
        galat.push(...cariRujukan(path, teks, varian, jenis))
        if (!BERKAS_BOLEH_MEREK.has(path) && POLA_MEREK.test(teks.replaceAll(EMAIL_HAK_CIPTA, ''))) {
            const baris = teks.split('\n').findIndex((b) => POLA_MEREK.test(b.replaceAll(EMAIL_HAK_CIPTA, '')))
            galat.push(`${path}:${baris + 1}: memuat nama brand toko (hanya boleh di LICENSE dan README paket)`)
        }
        const mesin = teks.split('\n').findIndex((b) => POLA_JALUR_MESIN.test(b))
        if (mesin >= 0) {
            galat.push(`${path}:${mesin + 1}: memuat jalur absolut mesin pengembang: ${kutip(teks.split('\n')[mesin])}`)
        }
        const crlf = teks.indexOf('\r\n')
        if (crlf >= 0 && !/\.(bat|cmd)$/i.test(path)) {
            galat.push(`${path}:${teks.slice(0, crlf).split('\n').length}: akhir baris CRLF; berkas teks di paket harus LF`)
        }
        if (wajibHeader(path)) {
            const h = periksaHeader(teks)
            if (h) galat.push(`${path}:${h.baris}: tanpa header hak cipta dua baris (${h.alasan})`)
        }
    }

    for (const w of wajibAda(varian)) {
        const ada = w.endsWith('/') ? [...isi.keys()].some((p) => p.startsWith(w)) : isi.has(w)
        if (!ada) galat.push(`${w}: wajib ada di paket tetapi tidak ditemukan`)
    }
    if (isi.has('LICENSE') && isi.get('LICENSE').toString('utf8').trim().length < 100) {
        galat.push('LICENSE: isinya terlalu pendek untuk berkas lisensi')
    }
    galat.push(...periksaPanduan(isi, { tanpaPanduan, varian, hashMerek }))
    galat.push(...periksaKonsistensi(isi, varian, versi))
    galat.push(...periksaTautan(isi, { tanpaPanduan, varian, jenis }))
    return galat
}
