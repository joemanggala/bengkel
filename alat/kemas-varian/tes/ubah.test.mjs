// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JENIS, RUJUKAN_MOBILE, VARIAN_TERSEDIA } from '../lib/aturan.mjs'
import { bacaLayanan, buangBlokInternal, gantiPortEnvWeb, gantiPortSpec, isiTemplat, nilaiTemplat, normalisasiEol, periksaSinkronCompose } from '../lib/ubah.mjs'
import { LARAVEL, TEMPLAT } from './bantu.mjs'

test('CRLF dijadikan LF di berkas teks, kecuali .bat dan .cmd yang justru memerlukannya', () => {
    const crlf = Buffer.from('a\r\nb\r\n')
    assert.equal(normalisasiEol('x.ts', crlf).toString(), 'a\nb\n')
    assert.equal(normalisasiEol('x.sh', Buffer.from('#!/bin/sh\r\necho\r\n')).toString(), '#!/bin/sh\necho\n')
    assert.equal(normalisasiEol('x.bat', Buffer.from('a\nb\n')).toString(), 'a\r\nb\r\n')
    assert.equal(normalisasiEol('x.cmd', crlf).toString(), 'a\r\nb\r\n')
})

test('berkas biner tidak disentuh, dan isi yang sudah LF dikembalikan apa adanya', () => {
    const biner = Buffer.from([0x89, 0x50, 0x0d, 0x0a, 0x00, 0x01])
    assert.equal(normalisasiEol('a.png', biner), biner)
    const lf = Buffer.from('sudah lf\n')
    assert.equal(normalisasiEol('a.md', lf), lf)
    const bukanUtf8 = Buffer.from([0xe9, 0x0d, 0x0a])
    assert.deepEqual([...normalisasiEol('a.txt', bukanUtf8)], [0xe9, 0x0a], 'latin1 menjaga byte yang bukan UTF-8')
})

test('port web diganti ke port varian, komentar dibiarkan, dan baris yang hilang menghentikan pengemas', () => {
    const asli = '# Alamat backend\nAPI_URL=http://localhost:8802\nCOOKIE_SECURE=\n'
    assert.equal(gantiPortEnvWeb(asli, 8803), '# Alamat backend\nAPI_URL=http://localhost:8803\nCOOKIE_SECURE=\n')
    assert.equal(gantiPortEnvWeb(asli, 8802), asli)
    assert.throws(() => gantiPortEnvWeb('# kosong\nCOOKIE_SECURE=\n', 8802), /tidak lagi memuat baris API_URL/)
})

test('templat: isian, blok bersyarat, dan blok bersarang', () => {
    const t = 'Halo {{nama}}\n{{#go}}\nhanya go\n{{/go}}\n{{^go}}\nbukan go\n{{#laravel}}\nlaravel\n{{/laravel}}\n{{/go}}\n'
    const nilai = { nama: 'X', go: false, laravel: true }
    assert.equal(isiTemplat(t, nilai), 'Halo X\nbukan go\nlaravel\n')
    assert.equal(isiTemplat(t, { ...nilai, go: true }), 'Halo X\nhanya go\n')
})

test('templat yang salah ketik menghentikan pengemas, bukan menghasilkan README berantakan', () => {
    const n = { go: true, nama: 'X' }
    assert.throws(() => isiTemplat('{{#go}}\nx\n', n), /tidak ditutup/)
    assert.throws(() => isiTemplat('x\n{{/go}}\n', n), /ditutup tanpa dibuka/)
    assert.throws(() => isiTemplat('{{#nama}}\nx\n{{/nama}}\n', n), /bukan saklar true\/false/)
    assert.throws(() => isiTemplat('{{#php}}\nx\n{{/php}}\n', n), /bukan saklar true\/false/)
    assert.throws(() => isiTemplat('{{tidakAda}}\n', n), /memakai \{\{tidakAda\}\} yang tidak diisi/)
    assert.throws(() => isiTemplat('sisa {{ rusak\n', n), /masih memuat tanda/)
})

test('semua templat bisa dirender untuk semua varian yang tersedia tanpa tanda {{ }} tersisa', () => {
    for (const varian of VARIAN_TERSEDIA) {
        for (const [tujuan, teks] of Object.entries(TEMPLAT)) {
            const hasil = isiTemplat(teks, nilaiTemplat(varian, '1.0.0', JENIS.web), tujuan)
            assert.ok(!/\{\{|\}\}/.test(hasil), `${varian.kode} ${tujuan}`)
        }
    }
})

const render = (tujuan, versi = '1.0.0') => isiTemplat(TEMPLAT[tujuan], nilaiTemplat(LARAVEL, versi, JENIS.web), tujuan)

test('README paket: judul, versi, perintah backend Laravel, port, dan syarat sebelum publik', () => {
    const readme = render('README.md', '2.0.0')
    assert.match(readme, /^# Source code Aplikasi Bengkel: Laravel \+ Next\.js\n/)
    assert.match(readme, /Versi 2\.0\.0\./)
    assert.match(readme, /\ncd backend-laravel\ncomposer install\ncp \.env\.example \.env\n/)
    assert.match(readme, /\nphp artisan bengkel:serve\n/)
    assert.match(readme, /\nphp artisan bengkel:migrate\n/)
    assert.match(readme, /Composer 2/)
    assert.match(readme, /\| Backend Laravel \| http:\/\/localhost:8802 \|/)
    assert.match(readme, /\| Web \| http:\/\/localhost:3800 \|/)
    assert.match(readme, /\| WhatsApp palsu \| http:\/\/localhost:8890 \|/)
    assert.match(readme, /`localhost:3350` bila lewat Docker/)
    for (const syarat of ['SETUP_TOKEN', 'PUBLIC_WEB_URL', 'COOKIE_SECURE=true', 'PHP-FPM', '/servis/', '/booking']) assert.ok(readme.includes(syarat), syarat)
    assert.doesNotMatch(readme, /kafe|meja|QR meja/i)
})

test('panduan menjalankan: Cara A dan B, migration, pemilik pertama, WhatsApp palsu, dan syarat produksi', () => {
    const jalan = render('docs/menjalankan.md')
    for (const bagian of ['## 1. MySQL dan migration', '### Cara A: tanpa Docker', '### Cara B: Docker', '## 2. Pemilik pertama', '## 3. WhatsApp palsu', '## 4. WhatsApp sungguhan untuk produksi', '## 5. Syarat sebelum produksi', '## Memecahkan masalah']) {
        assert.ok(jalan.includes(bagian), bagian)
    }
    assert.match(jalan, /\nphp artisan bengkel:migrate\nphp artisan bengkel:migrate versi\n/)
    assert.match(jalan, /\| PHP \| 8\.4/)
    assert.match(jalan, /16 tabel/)
    assert.doesNotMatch(jalan, /kafe|meja|tes kontrak|migrate-uji/i)
})

test('templat paket web tidak memuat kata aplikasi staf', () => {
    for (const tujuan of Object.keys(TEMPLAT)) {
        const teks = render(tujuan)
        for (const { nama, pola } of RUJUKAN_MOBILE) assert.ok(!pola.test(teks), `${tujuan}: ${nama}`)
    }
})

test('.gitignore paket memuat berkas runtime Laravel dan rahasia lokal', () => {
    const ignore = render('.gitignore')
    assert.match(ignore, /^backend-laravel\/storage\/logs\/\*$/m)
    assert.match(ignore, /^\.env$/m)
    assert.match(ignore, /^!\.env\.example$/m)
    assert.match(ignore, /^vendor\/$/m)
    assert.doesNotMatch(ignore, /backend-go|backend-nestjs|tests\/kontrak|mobile/)
})

test('compose di templat tidak punya migrate-uji, dan menyala di port yang dipakai seluruh paket', () => {
    const layanan = bacaLayanan(TEMPLAT['docker-compose.yml'])
    assert.deepEqual([...layanan.keys()], ['mysql', 'migrate-dev'])
    // Diikat ke 127.0.0.1: sandi dev sederhana, jadi MySQL tidak boleh terjangkau dari jaringan.
    assert.deepEqual(layanan.get('mysql').ports, ['127.0.0.1:3350:3306'])
    assert.match(layanan.get('mysql').image, /^mysql:8\.4\.\d+@sha256:[0-9a-f]{64}$/)
    assert.doesNotMatch(TEMPLAT['docker-compose.yml'], /migrate-uji|bengkel_uji/)
    assert.doesNotMatch(TEMPLAT['db/init/01-buat-database.sql'], /bengkel_uji|bengkel_e2e/)
    assert.match(TEMPLAT['db/init/01-buat-database.sql'], /CREATE DATABASE IF NOT EXISTS bengkel /)
})

test('sinkron compose: image atau port repo yang berubah dilaporkan agar templat disesuaikan', () => {
    const templat = TEMPLAT['docker-compose.yml']
    assert.deepEqual(periksaSinkronCompose(templat, templat), [])
    const tambahan = `${templat.replace('\nvolumes:', '\n  migrate-uji:\n    image: migrate/migrate:lain\n\nvolumes:')}`
    assert.deepEqual(periksaSinkronCompose(tambahan, templat), [], 'layanan tambahan di repo (migrate-uji) tidak jadi masalah')
    const imageBaru = templat.replace(/mysql:8\.4\.\d+@sha256:[0-9a-f]+/, 'mysql:8.4.99@sha256:' + 'a'.repeat(64))
    const galat = periksaSinkronCompose(imageBaru, templat)
    assert.equal(galat.length, 1)
    assert.match(galat[0], /^layanan "mysql": image di repo mysql:8\.4\.99@.* berbeda dari templat mysql:8\.4\./)
    const portBaru = periksaSinkronCompose(templat.replace('"127.0.0.1:3350:3306"', '"127.0.0.1:3340:3306"'), templat)
    assert.match(portBaru[0], /layanan "mysql": port di repo \[127\.0\.0\.1:3340:3306\] berbeda dari templat \[127\.0\.0\.1:3350:3306\]/)
    const hilang = periksaSinkronCompose(templat.replace('migrate-dev:', 'migrasi:'), templat)
    assert.match(hilang[0], /tidak lagi punya layanan "migrate-dev"/)
})

// ---- blok internal (kemas:abaikan) ----------------------------------------------------------

const MD_MULAI = '<!-- kemas:abaikan-mulai -->'
const MD_SELESAI = '<!-- kemas:abaikan-selesai -->'

test('blok bertanda di Markdown dibuang beserta penandanya, dan baris kosong ganda dirapikan', () => {
    const teks = ['# Judul', '', 'Pengantar.', '', MD_MULAI, '## Menguji', '', 'Jalankan tes kontrak.', MD_SELESAI, '', '## Produksi', 'Isi.', ''].join('\n')
    assert.equal(buangBlokInternal('backend-laravel/README.md', teks), ['# Judul', '', 'Pengantar.', '', '## Produksi', 'Isi.', ''].join('\n'))
})

test('blok di akhir berkas dan beberapa blok dalam satu berkas dibuang semuanya', () => {
    const akhir = ['Awal.', '', MD_MULAI, 'rahasia', MD_SELESAI, ''].join('\n')
    assert.equal(buangBlokInternal('a.md', akhir), 'Awal.\n')
    const dua = ['a', MD_MULAI, 'x', MD_SELESAI, 'b', MD_MULAI, 'y', MD_SELESAI, 'c'].join('\n')
    assert.equal(buangBlokInternal('a.md', dua), 'a\nb\nc')
})

test('penanda satu baris pembungkus entri daftar isi membuang entrinya saja', () => {
    const teks = ['- [Satu](#satu)', MD_MULAI, '- [Menguji](#menguji)', MD_SELESAI, '- [Dua](#dua)', ''].join('\n')
    assert.equal(buangBlokInternal('a.md', teks), '- [Satu](#satu)\n- [Dua](#dua)\n')
})

test('berkas bergaya tagar (.env.example dan .gitignore) memakai penanda "# kemas:abaikan-..."', () => {
    const env = ['PORT=8802', '', '# kemas:abaikan-mulai', '# Tes kontrak memakai 8882', 'X_UJI=x', '# kemas:abaikan-selesai', '', 'WA_TOKEN=', ''].join('\n')
    assert.equal(buangBlokInternal('backend-laravel/.env.example', env), 'PORT=8802\n\nWA_TOKEN=\n')
    const ignore = ['node_modules/', '# kemas:abaikan-mulai', 'storage/uji/', '# kemas:abaikan-selesai', ''].join('\n')
    assert.equal(buangBlokInternal('backend-laravel/.gitignore', ignore), 'node_modules/\n')
})

test('teks tanpa penanda dikembalikan apa adanya, termasuk di jenis berkas yang tidak mendukung penanda', () => {
    const teks = 'tanpa penanda\n'
    assert.equal(buangBlokInternal('a.php', teks), teks)
    assert.equal(buangBlokInternal('a.md', teks), teks)
})

test('penanda yang tidak berpasangan, bersarang, atau salah tempat menghentikan pengemas dengan berkas dan barisnya', () => {
    const lempar = (path, teks, pola) => assert.throws(() => buangBlokInternal(path, teks), pola)
    lempar('a.md', `x\n${MD_MULAI}\ny\n`, /a\.md:2: penanda .* tidak ditutup/)
    lempar('a.md', `x\n${MD_SELESAI}\n`, /a\.md:2: penanda .*selesai.* tanpa pembuka/)
    lempar('a.md', `${MD_MULAI}\n${MD_MULAI}\n${MD_SELESAI}\n${MD_SELESAI}\n`, /a\.md:2: penanda .* bersarang di dalam blok yang dibuka di baris 1/)
    lempar('a.md', `x ${MD_MULAI}\n`, /a\.md:1: penanda kemas:abaikan harus berdiri sendiri di satu baris/)
    lempar('a.md', '# kemas:abaikan-mulai\nx\n# kemas:abaikan-selesai\n', /a\.md:1: penanda kemas:abaikan harus berdiri sendiri/)
    lempar('.env.example', `${MD_MULAI}\nx\n${MD_SELESAI}\n`, /\.env\.example:1: penanda kemas:abaikan harus berdiri sendiri/)
    lempar('kode.ts', `// ${MD_MULAI}\n`, /kode\.ts: memuat penanda kemas:abaikan, tetapi jenis berkas ini tidak mendukungnya/)
})

test('port di kontrak API (servers) diganti ke port varian, tepat satu entri', () => {
    const spec = 'openapi: 3.1.0\nservers:\n  - url: http://localhost:8802\n    description: Backend (alamat dev bawaan)\nsecurity: []\n'
    assert.equal(gantiPortSpec(spec, 8803), spec.replace('8802', '8803'))
    assert.equal(gantiPortSpec(spec, 8802), spec)
    assert.throws(() => gantiPortSpec('servers: []\n', 8802), /memuat 0 entri .*seharusnya 1/)
    const dua = `${spec}  - url: http://localhost:8801\n`
    assert.throws(() => gantiPortSpec(dua, 8802), /memuat 2 entri .*seharusnya 1/)
    const lain = spec + '  - url: https://api.contoh.id\n'
    assert.match(gantiPortSpec(lain, 8803), /url: https:\/\/api\.contoh\.id/, 'server https tidak ikut berubah')
})
