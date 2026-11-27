// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import assert from 'node:assert/strict'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { VARIAN, berkasRahasia } from '../lib/aturan.mjs'
import { akarGit, bacaVersiAkar, daftarBerkasGit, jumlahBelumKomit, pilihBerkas } from '../lib/pilih.mjs'
import { buatRepoFixture, folderSementara, git, hapus } from './bantu.mjs'

const REPO = [
    '.gitignore',
    'LICENSE',
    'README.md',
    'VERSION',
    'alat/kemas-varian/kemas.mjs',
    'alat/panduan-word/buat.js',
    'backend-go/go.mod',
    'backend-laravel/.env',
    'backend-laravel/.env.example',
    'backend-laravel/artisan',
    'backend-laravel/bin/x.exe',
    'backend-laravel/scripts/uji-kontrak.sh',
    'backend-laravel/scripts/uji-serentak.sh',
    'backend-laravel/storage/logs/.gitignore',
    'backend-laravel/storage/oauth-private.key',
    'backend-laravel/vendor/autoload.php',
    'backend-nestjs/package.json',
    'db/init/01-buat-database.sql',
    'db/migrations/000001_awal.up.sql',
    'db/tanpa-docker.sql',
    'dist/paket/bengkel-laravel-web-0.1.0.zip',
    'docker-compose.yml',
    'docs/eksekusi/bagian-3-e2e-paket.md',
    'docs/menjalankan.md',
    'docs/panduan/Panduan-Pemakai-Aplikasi-Bengkel.docx',
    'docs/rancangan.md',
    'mobile/pubspec.yaml',
    'spec/openapi.yaml',
    'spec/redocly.yaml',
    'tests/e2e/tes/01-pemasangan.spec.ts',
    'tests/kontrak/package.json',
    'tests/wa-palsu/node_modules/tsx/package.json',
    'tests/wa-palsu/package.json',
    'web/.env.example',
    'web/.env.local',
    'web/.next/server.js',
    'web/package.json',
    'web/src/app/page.tsx',
]

test('paket Laravel membawa backend-nya, web, spec, db, wa-palsu, panduan, dan LICENSE', () => {
    const { dipilih } = pilihBerkas(REPO, VARIAN.laravel)
    assert.deepEqual(dipilih, [
        'LICENSE',
        'backend-laravel/.env.example',
        'backend-laravel/artisan',
        'backend-laravel/storage/logs/.gitignore',
        'db/migrations/000001_awal.up.sql',
        'db/tanpa-docker.sql',
        'docs/panduan/Panduan-Pemakai-Aplikasi-Bengkel.docx',
        'spec/openapi.yaml',
        'tests/wa-palsu/package.json',
        'web/.env.example',
        'web/package.json',
        'web/src/app/page.tsx',
    ])
})

test('berkas yang dibuang dicatat dengan alasannya', () => {
    const { dibuang } = pilihBerkas(REPO, VARIAN.laravel)
    assert.deepEqual(dibuang, [
        { path: '.gitignore', alasan: 'digantikan templat paket' },
        { path: 'README.md', alasan: 'digantikan templat paket' },
        { path: 'VERSION', alasan: 'dibuat ulang dari versi paket' },
        { path: 'backend-laravel/.env', alasan: 'berkas rahasia' },
        { path: 'backend-laravel/bin/x.exe', alasan: 'hasil build, dependensi, atau data runtime' },
        { path: 'backend-laravel/scripts/uji-kontrak.sh', alasan: 'skrip tes kontrak' },
        { path: 'backend-laravel/scripts/uji-serentak.sh', alasan: 'skrip tes kontrak' },
        { path: 'backend-laravel/storage/oauth-private.key', alasan: 'berkas rahasia' },
        { path: 'backend-laravel/vendor/autoload.php', alasan: 'hasil build, dependensi, atau data runtime' },
        { path: 'db/init/01-buat-database.sql', alasan: 'digantikan templat paket' },
        { path: 'docker-compose.yml', alasan: 'digantikan templat paket' },
        { path: 'docs/menjalankan.md', alasan: 'digantikan templat paket' },
        { path: 'spec/redocly.yaml', alasan: 'catatan internal atau alat' },
        { path: 'tests/wa-palsu/node_modules/tsx/package.json', alasan: 'hasil build, dependensi, atau data runtime' },
        { path: 'web/.env.local', alasan: 'berkas rahasia' },
        { path: 'web/.next/server.js', alasan: 'hasil build, dependensi, atau data runtime' },
    ])
})

test('catatan internal, alat, tes kontrak, E2E, mobile/, dan backend lain tidak pernah ikut', () => {
    const { dipilih } = pilihBerkas(REPO, VARIAN.laravel)
    for (const awalan of ['docs/eksekusi/', 'docs/rancangan.md', 'alat/', 'dist/', 'tests/kontrak/', 'tests/e2e/', 'mobile/', 'backend-go/', 'backend-nestjs/']) {
        assert.ok(!dipilih.some((p) => p.startsWith(awalan)), awalan)
    }
})

test('berkas rahasia: .env dan variannya, kunci, dan keystore; .env.example tidak', () => {
    for (const p of ['.env', 'a/.env.local', 'a/.env.production', 'a/kunci.pem', 'a/x.key', 'a/x.p12', 'a/x.jks']) assert.ok(berkasRahasia(p), p)
    for (const p of ['a/.env.example', 'a/environment.ts', 'a/keyboard.ts', 'a/monkey.txt']) assert.ok(!berkasRahasia(p), p)
})

test('versi bawaan dari berkas VERSION di akar, atau 0.1.0 bila tidak ada, dan isi yang salah menghentikan', () => {
    const folder = folderSementara()
    try {
        assert.deepEqual(bacaVersiAkar(folder), { versi: '0.1.0', asal: 'bawaan' })
        writeFileSync(join(folder, 'VERSION'), '1.4.2\n')
        assert.deepEqual(bacaVersiAkar(folder), { versi: '1.4.2', asal: 'VERSION' })
        writeFileSync(join(folder, 'VERSION'), 'versi satu\n')
        assert.throws(() => bacaVersiAkar(folder), /VERSION berisi "versi satu", bukan versi x\.y\.z/)
        rmSync(join(folder, 'VERSION'))
        writeFileSync(join(folder, 'VERSI'), '2.0.0-rc.1')
        assert.deepEqual(bacaVersiAkar(folder), { versi: '2.0.0-rc.1', asal: 'VERSI' })
    } finally {
        hapus(folder)
    }
})

// ---- repo git sementara: berkas dipilih tanpa commit ----------------------------------------

const folder = buatRepoFixture()
after(() => hapus(folder))

test('berkas belum dilacak tetapi tidak diabaikan ikut; yang diabaikan .gitignore tidak; tanpa commit sama sekali', () => {
    assert.equal(git(folder, 'ls-files', '--cached').trim(), '', 'tidak ada berkas yang dilacak (belum ada git add)')
    const semua = daftarBerkasGit(folder)
    assert.ok(semua.includes('web/src/app/page.tsx'), 'berkas baru yang belum dilacak ikut')
    assert.ok(semua.includes('backend-laravel/.env.example'))
    assert.ok(!semua.includes('web/.env.local'), '.env.local diabaikan .gitignore')
    assert.ok(!semua.includes('backend-laravel/.env'), '.env diabaikan .gitignore')
    assert.ok(!semua.includes('backend-laravel/vendor/paket/a.php'), 'vendor/ diabaikan')
    assert.ok(!semua.includes('tests/wa-palsu/node_modules/x/index.js'), 'node_modules/ diabaikan')
    assert.ok(!semua.includes('web/.next/server.js'))
    assert.ok(!semua.includes('tests/e2e/.bangun/log/web.log'))
    assert.deepEqual(semua, [...semua].sort(), 'daftar terurut tetap')
})

test('sesudah daftar dibaca, repo tetap tanpa berkas terlacak dan tanpa commit (alat hanya membaca)', () => {
    daftarBerkasGit(folder)
    jumlahBelumKomit(folder, ['web/'])
    akarGit(folder)
    assert.equal(git(folder, 'ls-files', '--cached').trim(), '')
    assert.throws(() => git(folder, 'rev-parse', '--verify', 'HEAD'), /./, 'belum ada commit')
})

test('berkas yang sudah dilacak lalu dihapus dari working tree tetap ada di daftar (pembangun yang melewatinya)', () => {
    const dua = buatRepoFixture()
    try {
        git(dua, 'add', 'LICENSE')
        rmSync(join(dua, 'LICENSE'))
        assert.ok(daftarBerkasGit(dua).includes('LICENSE'))
    } finally {
        hapus(dua)
    }
})

test('jumlah berkas belum dikomit di akar paket dihitung, untuk peringatan', () => {
    assert.ok(jumlahBelumKomit(folder, ['web/']) >= 3)
    assert.equal(jumlahBelumKomit(folder, ['tidak-ada/']), 0)
})

test('pilihBerkas atas daftar git fixture: backend lain, tes kontrak, E2E, dan skrip uji tidak ikut', () => {
    const { dipilih } = pilihBerkas(daftarBerkasGit(folder), VARIAN.laravel)
    assert.ok(dipilih.includes('backend-laravel/app/Kode.php'))
    assert.ok(!dipilih.some((p) => p.startsWith('backend-go/')))
    assert.ok(!dipilih.includes('backend-laravel/scripts/uji-kontrak.sh'))
    assert.ok(!dipilih.includes('backend-laravel/scripts/uji-serentak.sh'))
    assert.ok(!dipilih.includes('backend-laravel/bin/api.exe'))
    assert.ok(!dipilih.some((p) => p.startsWith('tests/kontrak/') || p.startsWith('tests/e2e/') || p.startsWith('docs/eksekusi/') || p.startsWith('alat/')))
})
