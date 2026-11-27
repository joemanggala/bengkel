// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JENIS, VARIAN, VARIAN_TERSEDIA, akarVarian, bacaNamaPaket, namaPaket, versiSah } from '../lib/aturan.mjs'
import { bacaArgumenKemas, bacaArgumenPeriksa, kenaliPaket } from '../lib/argumen.mjs'

test('tanpa argumen yang dikemas adalah semua varian dan jenis yang tersedia: Laravel, paket web', () => {
    const arg = bacaArgumenKemas([])
    assert.deepEqual(arg.varian.map((v) => v.kode), ['laravel'])
    assert.deepEqual(arg.jenis, [JENIS.web])
    assert.equal(arg.versi, undefined, 'versi diisi kemas.mjs dari berkas versi di akar')
    assert.equal(arg.tanpaPanduan, false)
    assert.deepEqual(VARIAN_TERSEDIA, [VARIAN.laravel])
})

test('--varian, --paket, --versi, dan --keluaran dibaca dalam bentuk --nama=nilai maupun --nama nilai', () => {
    const a = bacaArgumenKemas(['--varian=laravel', '--paket=web', '--versi=1.2.3', '--keluaran=D:/paket'])
    assert.deepEqual(a.varian, [VARIAN.laravel])
    assert.deepEqual(a.jenis, [JENIS.web])
    assert.equal(a.versi, '1.2.3')
    assert.equal(a.keluaran, 'D:/paket')
    assert.deepEqual(bacaArgumenKemas(['--varian', 'laravel', '--versi', '2.0.0']).varian, [VARIAN.laravel])
})

test('--tanpa-panduan, --akar, --brand-kit, dan --gambar-ahws dikenali', () => {
    const a = bacaArgumenKemas(['--tanpa-panduan', '--akar=D:/repo', '--brand-kit=D:/brand', '--gambar-ahws=D:/klien'])
    assert.equal(a.tanpaPanduan, true)
    assert.equal(a.akar, 'D:/repo')
    assert.equal(a.brandKit, 'D:/brand')
    assert.equal(a.gambarAhws, 'D:/klien')
})

test('varian yang dicadangkan tetapi belum ada di repo ditolak dengan pesan yang menyebutnya', () => {
    assert.throws(() => bacaArgumenKemas(['--varian=go']), /backend Go belum ada di repo ini; pilih laravel/)
    assert.throws(() => bacaArgumenKemas(['--varian=nestjs']), /backend NestJS belum ada di repo ini/)
    assert.throws(() => bacaArgumenPeriksa(['x.zip', '--varian=go']), /backend Go belum ada/)
})

test('argumen yang salah ditolak dengan pesan yang jelas', () => {
    assert.throws(() => bacaArgumenKemas(['--varian=php']), /--varian "php" tidak dikenal; pilih laravel\|semua/)
    assert.throws(() => bacaArgumenKemas(['--paket=lengkap']), /--paket "lengkap" tidak dikenal; pilih web\|semua/)
    assert.throws(() => bacaArgumenKemas(['laravel']), /Argumen "laravel" tidak dikenal; varian ditulis --varian=<nama>/)
    assert.throws(() => bacaArgumenKemas(['--versi=1.0']), /--versi harus berbentuk x\.y\.z/)
    assert.throws(() => bacaArgumenKemas(['--versi=web-1.0.0']), /--versi harus berbentuk x\.y\.z/)
    assert.throws(() => bacaArgumenKemas(['--versi=1.0.0.0']), /--versi harus berbentuk x\.y\.z/)
    assert.throws(() => bacaArgumenKemas([`--versi=1.0.0-${'a'.repeat(30)}`]), /--versi harus berbentuk x\.y\.z/)
    assert.throws(() => bacaArgumenKemas(['--tidak-ada']), /Unknown option|tidak dikenal/i)
})

test('versi mengikuti x.y.z dengan pra-rilis opsional', () => {
    for (const v of ['0.1.0', '1.0.0', '12.34.56', '1.0.0-rc.1', '2.0.0-beta']) assert.ok(versiSah(v), v)
    for (const v of ['1', '1.0', 'v1.0.0', '1.0.0-', '1.0.0 ', '', undefined, 'a.b.c', 'mobile-1.0.0']) assert.ok(!versiSah(v), String(v))
})

test('nama paket bengkel-<varian>-web-<versi> bisa dibaca kembali, dan nama lain bukan paket', () => {
    assert.equal(namaPaket(VARIAN.laravel, '0.1.0'), 'bengkel-laravel-web-0.1.0')
    for (const versi of ['1.0.0', '1.0.0-rc.1']) {
        assert.deepEqual(bacaNamaPaket(namaPaket(VARIAN.laravel, versi, JENIS.web)), { varian: VARIAN.laravel, jenis: JENIS.web, versi })
    }
    for (const nama of ['kafe-laravel-web-1.0.0', 'bengkel-go-web-1.0.0', 'bengkel-laravel-1.0.0', 'bengkel-laravel-web-1.0', 'bengkel-laravel-web-mobile-1.0.0']) {
        assert.equal(bacaNamaPaket(nama), null, nama)
    }
})

test('akar paket: backend varian, web, spec, db, panduan, WhatsApp palsu, dan LICENSE; tanpa mobile/', () => {
    assert.deepEqual(akarVarian(VARIAN.laravel), ['backend-laravel/', 'web/', 'spec/', 'db/', 'docs/panduan/', 'tests/wa-palsu/', 'LICENSE'])
})

test('pemeriksa menerima beberapa sasaran dan --varian hanya untuk yang namanya bukan paket', () => {
    const a = bacaArgumenPeriksa(['a.zip', 'folder-b', '--tanpa-panduan', '--varian=laravel', '--versi=1.0.0'])
    assert.deepEqual(a.sasaran, ['a.zip', 'folder-b'])
    assert.equal(a.tanpaPanduan, true)
    assert.equal(a.varian, VARIAN.laravel)
    assert.throws(() => bacaArgumenPeriksa([]), /paling sedikit satu ZIP atau folder/)
})

test('kenaliPaket: dari nama folder, atau dari --varian (jenis bawaan web) bila namanya bukan paket', () => {
    assert.deepEqual(kenaliPaket('bengkel-laravel-web-0.2.0'), { varian: VARIAN.laravel, jenis: JENIS.web, versi: '0.2.0' })
    assert.equal(kenaliPaket('hasil-ekstrak'), null)
    assert.deepEqual(kenaliPaket('hasil-ekstrak', { varian: VARIAN.laravel }), { varian: VARIAN.laravel, jenis: JENIS.web, versi: '0.0.0' })
})
