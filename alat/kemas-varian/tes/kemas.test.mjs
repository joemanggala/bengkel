// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Tes menyeluruh: paket dibangun dari repo git sementara (BUKAN repo ini) yang tidak pernah di-add
// maupun di-commit, lewat fungsi pembangun dan lewat kemas.mjs/periksa.mjs sebagai proses
// sungguhan. Membuktikan seleksi berkas, determinisme byte, dan bahwa paket yang melanggar tidak
// pernah ditulis.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { JENIS, PANDUAN_WAJIB } from '../lib/aturan.mjs'
import { bangunPaket } from '../lib/bangun.mjs'
import { daftarBerkasGit } from '../lib/pilih.mjs'
import { bacaZip, buatZip } from '../lib/zip.mjs'
import { FOLDER_ALAT, LARAVEL, TEMPLAT, berkasPanduan, buatRepoFixture, envBackend, folderSementara, git, hapus, harapkan, header } from './bantu.mjs'

const KEMAS = join(FOLDER_ALAT, 'kemas.mjs')
const PERIKSA = join(FOLDER_ALAT, 'periksa.mjs')
const sementara = []
const baru = (fn) => {
    const f = fn()
    sementara.push(f)
    return f
}
after(() => sementara.forEach(hapus))

// Brand kit dikosongkan supaya tes tidak bergantung pada folder di mesin pengembang.
const jalankan = (script, args) =>
    spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, KEMAS_BRAND_KIT: '', KEMAS_GAMBAR_AHWS: '' } })
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const bangun = (akar, opsi = {}) =>
    bangunPaket({ akar, semua: daftarBerkasGit(akar), varian: LARAVEL, versi: '0.1.0', jenis: JENIS.web, templat: TEMPLAT, tanpaPanduan: true, ...opsi })
const namaDiZip = (hasil) => bacaZip(hasil.zip).map((e) => e.nama)
const isiZip = (hasil) => Object.fromEntries(bacaZip(hasil.zip).map((e) => [e.nama.replace(/^[^/]+\//, ''), e.isi.toString('utf8')]))

// ---- seleksi berkas -------------------------------------------------------------------------

test('isi paket Laravel dari repo yang belum pernah di-commit: persis berkas yang seharusnya', () => {
    const akar = baru(() => buatRepoFixture())
    const hasil = bangun(akar)
    assert.deepEqual(hasil.galat, [])
    assert.equal(hasil.nama, 'bengkel-laravel-web-0.1.0')
    assert.deepEqual(
        namaDiZip(hasil).map((n) => n.replace('bengkel-laravel-web-0.1.0/', '')),
        [
            '.gitignore',
            'LICENSE',
            'README.md',
            'VERSION',
            'backend-laravel/.env.example',
            'backend-laravel/README.md',
            'backend-laravel/app/Kode.php',
            'backend-laravel/artisan',
            'backend-laravel/composer.json',
            'db/init/01-buat-database.sql',
            'db/migrations/000001_awal.down.sql',
            'db/migrations/000001_awal.up.sql',
            'db/tanpa-docker.sql',
            'docker-compose.yml',
            'docs/menjalankan.md',
            'spec/openapi.yaml',
            'spec/whatsapp.md',
            'tests/wa-palsu/.env.example',
            'tests/wa-palsu/package.json',
            'tests/wa-palsu/src/main.ts',
            'tests/wa-palsu/src/server.ts',
            'web/.env.example',
            'web/README.md',
            'web/package-lock.json',
            'web/package.json',
            'web/src/app/page.tsx',
        ],
    )
})

test('tidak ada yang internal, rahasia, hasil build, atau backend lain di paket', () => {
    const akar = baru(() => buatRepoFixture())
    const nama = namaDiZip(bangun(akar)).join('\n')
    for (const terlarang of ['tests/kontrak', 'tests/e2e', '/alat/', 'docs/eksekusi', 'rancangan', '.claude', 'redocly', 'uji-kontrak', 'uji-serentak', '/bin/', '/vendor/', 'node_modules', '/.next/', '.bangun', '.env.local', 'backend-laravel/.env\n', 'backend-go', 'storage/logs']) {
        assert.ok(!nama.includes(terlarang), terlarang)
    }
})

test('README, panduan menjalankan, compose, pembuat database, .gitignore, dan VERSION dibuat pengemas, bukan disalin dari repo', () => {
    const akar = baru(() => buatRepoFixture())
    const isi = isiZip(bangun(akar, { versi: '0.9.0' }))
    assert.match(isi['README.md'], /^# Source code Aplikasi Bengkel: Laravel \+ Next\.js\n\nVersi 0\.9\.0\./)
    assert.doesNotMatch(isi['README.md'], /Repo pengembang|rancangan/)
    assert.doesNotMatch(isi['docs/menjalankan.md'], /Jalankan tests\/kontrak/)
    assert.doesNotMatch(isi['docker-compose.yml'], /migrate-uji/)
    assert.match(isi['db/init/01-buat-database.sql'], /CREATE DATABASE IF NOT EXISTS bengkel /)
    assert.doesNotMatch(isi['db/init/01-buat-database.sql'], /bengkel_uji/)
    assert.equal(isi.VERSION, '0.9.0\n', 'VERSION mengikuti versi paket, bukan 0.3.0 dari repo')
    assert.match(isi['web/.env.example'], /^API_URL=http:\/\/localhost:8802$/m, 'web menunjuk ke port backend Laravel')
    assert.match(isi['.gitignore'], /backend-laravel\/storage\/logs/)
})

test('berkas yang sudah dilacak lalu terhapus dari working tree dilewati dan dilaporkan, bukan membuat pengemas gagal', () => {
    const akar = baru(() => buatRepoFixture())
    git(akar, 'add', 'web/src/app/page.tsx')
    rmSync(join(akar, 'web/src/app/page.tsx'))
    const hasil = bangun(akar)
    assert.deepEqual(hasil.hilang, ['web/src/app/page.tsx'])
    assert.deepEqual(hasil.galat, [])
})

// ---- ZIP deterministik ----------------------------------------------------------------------

test('dua kali bangun menghasilkan byte yang sama, walau urutan daftar, waktu berkas, dan lokasi repo berbeda', () => {
    const a = baru(() => buatRepoFixture())
    const b = baru(() => buatRepoFixture())
    const pertama = bangun(a).zip
    assert.ok(pertama.equals(bangun(a).zip), 'dua kali bangun')
    assert.ok(pertama.equals(bangun(a, { semua: daftarBerkasGit(a).reverse() }).zip), 'urutan daftar berkas')
    utimesSync(join(a, 'web/package.json'), new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'))
    assert.ok(pertama.equals(bangun(a).zip), 'waktu ubah berkas')
    assert.ok(pertama.equals(bangun(b).zip), 'repo lain dengan isi sama')
})

test('isi berbeda menghasilkan ZIP berbeda, dan cap waktu serta izin berkas tetap', () => {
    const akar = baru(() => buatRepoFixture({ 'backend-laravel/scripts/pasang.sh': `#!/bin/sh\n${header('#')}\n`, 'web/skrip.txt': 'x\n' }))
    const dasar = bangun(akar).zip
    writeFileSync(join(akar, 'web/package.json'), '{"name":"lain"}\n')
    assert.ok(!dasar.equals(bangun(akar).zip))

    const zip = bangun(akar).zip
    const mode = Object.fromEntries(bacaZip(zip).map((e) => [e.nama.replace(/^[^/]+\//, ''), e.mode]))
    assert.equal(mode['backend-laravel/scripts/pasang.sh'], 0o100755)
    assert.equal(mode['backend-laravel/artisan'], 0o100755)
    assert.equal(mode['web/skrip.txt'], 0o100644)
    assert.equal(mode.LICENSE, 0o100644)
    // Cap waktu: bidang tanggal-jam DOS di header pusat entri pertama = 2026-01-01 00:00.
    const pusat = zip.readUInt32LE(zip.length - 22 + 16)
    assert.equal(zip.readUInt16LE(pusat + 12), 0, 'jam 00:00:00')
    assert.equal(zip.readUInt16LE(pusat + 14), ((2026 - 1980) << 9) | (1 << 5) | 1, 'tanggal 2026-01-01')
})

test('berkas ber-CRLF di working tree (git autocrlf Windows) masuk paket sebagai LF dan lolos pemeriksa', () => {
    const akar = baru(() => buatRepoFixture({ 'web/src/app/page.tsx': `${header().replaceAll('\n', '\r\n')}\r\nexport default 1\r\n` }))
    const hasil = bangun(akar)
    assert.deepEqual(hasil.galat, [])
    assert.ok(!isiZip(hasil)['web/src/app/page.tsx'].includes('\r'))
})

// ---- pelanggaran di repo membuat paket ditolak ----------------------------------------------

test('rujukan ke tests/kontrak di README backend ditolak lengkap dengan berkas dan barisnya', () => {
    const akar = baru(() => buatRepoFixture({ 'backend-laravel/README.md': '# Backend Laravel\n\nJalankan cd tests/kontrak lalu npm test.\n' }))
    harapkan(bangun(akar).galat, /^backend-laravel\/README\.md:3: merujuk folder tests\/kontrak/)
})

test('berkas kode tanpa header, panduan Word yang hilang, dan compose repo yang tertinggal templat dilaporkan', () => {
    const akar = baru(() => buatRepoFixture({ 'web/src/tanpa-header.ts': 'export const a = 1\n' }))
    const hasil = bangun(akar, { tanpaPanduan: false })
    assert.ok(hasil.galat.some((g) => g.startsWith('web/src/tanpa-header.ts:1: tanpa header hak cipta dua baris')))
    assert.equal(hasil.galat.filter((g) => /panduan Word wajib ada/.test(g)).length, 4)

    const lama = baru(() =>
        buatRepoFixture({ 'docker-compose.yml': TEMPLAT['docker-compose.yml'].replace(/mysql:8\.4\.\d+@sha256:[0-9a-f]+/, `mysql:8.4.99@sha256:${'b'.repeat(64)}`) }),
    )
    assert.ok(bangun(lama).galat.some((g) => /layanan "mysql": image di repo mysql:8\.4\.99/.test(g)))
})

test('paket sah dengan keempat panduan Word lolos tanpa --tanpa-panduan', () => {
    const akar = baru(() => buatRepoFixture(berkasPanduan()))
    const hasil = bangun(akar, { tanpaPanduan: false })
    assert.deepEqual(hasil.galat, [])
    assert.equal(namaDiZip(hasil).filter((n) => n.includes('/docs/panduan/')).length, 4)
})

test('teks AHWS di berkas repo membuat paket ditolak', () => {
    const akar = baru(() => buatRepoFixture({ 'web/src/app/tema.css': `${header()}\n/* warna AHWS Racing */\n` }))
    harapkan(bangun(akar).galat, /^web\/src\/app\/tema\.css:4: memuat nama AHWS/)
})

// ---- kemas.mjs dan periksa.mjs sebagai proses ----------------------------------------------

test('kemas.mjs menulis bengkel-laravel-web-<versi>.zip ke dist/paket, deterministik, dan periksa.mjs meloloskannya', () => {
    const akar = baru(() => buatRepoFixture())
    const proses = jalankan(KEMAS, ['--akar', akar, '--versi', '1.2.3', '--tanpa-panduan'])
    assert.equal(proses.status, 0, proses.stdout + proses.stderr)
    const keluar = join(akar, 'dist', 'paket')
    assert.deepEqual(readdirSync(keluar), ['bengkel-laravel-web-1.2.3.zip'])
    assert.match(proses.stdout, /bengkel-laravel-web-1\.2\.3 \(paket [^\n]*\n\s+berkas\s+26, ukuran/)
    assert.match(proses.stdout, /sha256\s+[0-9a-f]{64}/)
    assert.match(proses.stdout, /ditinggal \(skrip tes kontrak\): 2 berkas/)
    assert.match(proses.stderr, /PERHATIAN: --tanpa-panduan/)

    const zip = join(keluar, 'bengkel-laravel-web-1.2.3.zip')
    const sidik = sha(zip)
    assert.equal(jalankan(KEMAS, ['--akar', akar, '--versi', '1.2.3', '--tanpa-panduan']).status, 0)
    assert.equal(sha(zip), sidik, 'bangun ulang menghasilkan sha256 yang sama')

    const periksa = jalankan(PERIKSA, [zip, '--tanpa-panduan'])
    assert.equal(periksa.status, 0, periksa.stdout + periksa.stderr)
    assert.match(periksa.stdout, /lolos {2}bengkel-laravel-web-1\.2\.3\.zip: 26 berkas/)
    assert.equal(git(akar, 'ls-files', '--cached').trim(), '', 'kemas.mjs tidak menjalankan git add')
    assert.throws(() => git(akar, 'rev-parse', '--verify', 'HEAD'), /./, 'kemas.mjs tidak membuat commit')
})

test('versi bawaan dari berkas VERSION di akar repo, dan --keluaran mengganti folder hasil', () => {
    const akar = baru(() => buatRepoFixture({ VERSION: '3.1.4\n' }))
    const keluar = baru(() => folderSementara('kemas-keluar-'))
    const proses = jalankan(KEMAS, ['--akar', akar, '--keluaran', keluar, '--varian=laravel', '--paket=web', '--tanpa-panduan'])
    assert.equal(proses.status, 0, proses.stdout + proses.stderr)
    assert.deepEqual(readdirSync(keluar), ['bengkel-laravel-web-3.1.4.zip'])
    assert.match(proses.stdout, /versi 3\.1\.4 \(VERSION\)/)
})

test('tanpa --tanpa-panduan, repo tanpa panduan Word gagal dan tidak ada ZIP yang ditulis', () => {
    const akar = baru(() => buatRepoFixture())
    const keluar = baru(() => folderSementara('kemas-keluar-'))
    const proses = jalankan(KEMAS, ['--akar', akar, '--keluaran', keluar, '--versi=1.0.0'])
    assert.equal(proses.status, 1)
    assert.deepEqual(readdirSync(keluar), [])
    assert.ok(proses.stderr.includes(`docs/panduan/${PANDUAN_WAJIB[0]}: panduan Word wajib ada`), proses.stderr)
    assert.match(proses.stderr, /TIDAK ditulis/)
})

test('paket yang melanggar tidak ditulis dan ZIP lama bernama sama dibuang', () => {
    const akar = baru(() => buatRepoFixture({ 'backend-laravel/README.md': '# Laravel\n\nBaca docs/rancangan.md.\n' }))
    const keluar = baru(() => folderSementara('kemas-keluar-'))
    const lama = join(keluar, 'bengkel-laravel-web-1.0.0.zip')
    writeFileSync(lama, 'zip lama yang usang')
    const proses = jalankan(KEMAS, ['--akar', akar, '--keluaran', keluar, '--versi=1.0.0', '--tanpa-panduan'])
    assert.equal(proses.status, 1)
    assert.deepEqual(readdirSync(keluar), [])
    assert.match(proses.stderr, /backend-laravel\/README\.md:3: merujuk berkas rancangan\.md/)
    assert.ok(!existsSync(lama))
})

test('argumen salah menghasilkan kode 2 dengan pemakaian; VERSION rusak menghentikan dengan kode 1', () => {
    const salah = jalankan(KEMAS, ['--varian=php'])
    assert.equal(salah.status, 2)
    assert.match(salah.stderr, /--varian "php" tidak dikenal/)
    assert.match(salah.stderr, /Pemakaian: node alat\/kemas-varian\/kemas\.mjs/)
    assert.equal(jalankan(KEMAS, ['--varian=go']).status, 2)
    assert.equal(jalankan(PERIKSA, []).status, 2)

    const akar = baru(() => buatRepoFixture({ VERSION: 'bukan versi\n' }))
    const rusak = jalankan(KEMAS, ['--akar', akar, '--keluaran', baru(() => folderSementara()), '--tanpa-panduan'])
    assert.equal(rusak.status, 1)
    assert.match(rusak.stderr, /VERSION berisi "bukan versi"/)
})

test('folder gambar AHWS yang disebut tetapi tidak ada menghentikan alat; yang ada dipakai untuk memeriksa gambar', () => {
    const akar = baru(() => buatRepoFixture({ 'web/public/galeri.jpg': 'foto milik situs klien' }))
    const tidakAda = jalankan(KEMAS, ['--akar', akar, '--tanpa-panduan', '--gambar-ahws', join(akar, 'tidak-ada')])
    assert.equal(tidakAda.status, 1)
    assert.match(tidakAda.stderr, /gambar AHWS tidak ditemukan di/)

    const klien = baru(() => folderSementara('kemas-klien-'))
    mkdirSync(join(klien, 'galeri'))
    writeFileSync(join(klien, 'galeri', 'motor.jpg'), 'foto milik situs klien')
    const proses = jalankan(KEMAS, ['--akar', akar, '--tanpa-panduan', '--gambar-ahws', klien])
    assert.equal(proses.status, 1)
    assert.match(proses.stderr, /web\/public\/galeri\.jpg: isinya sama dengan gambar gambar AHWS galeri\/motor\.jpg/)
})

test('periksa.mjs menolak ZIP yang ditambahi berkas terlarang, menyebut berkasnya', () => {
    const akar = baru(() => buatRepoFixture())
    const keluar = baru(() => folderSementara('kemas-keluar-'))
    jalankan(KEMAS, ['--akar', akar, '--keluaran', keluar, '--versi=1.0.0', '--tanpa-panduan'])
    const zip = join(keluar, 'bengkel-laravel-web-1.0.0.zip')
    const entri = bacaZip(readFileSync(zip)).map((e) => ({ nama: e.nama, isi: e.isi }))
    entri.push({ nama: 'bengkel-laravel-web-1.0.0/tests/e2e/package.json', isi: Buffer.from('{}') })
    const bocor = join(keluar, 'bocor', 'bengkel-laravel-web-1.0.0.zip')
    mkdirSync(dirname(bocor), { recursive: true })
    writeFileSync(bocor, buatZip(entri))
    const proses = jalankan(PERIKSA, [bocor, '--tanpa-panduan'])
    assert.equal(proses.status, 1)
    assert.match(proses.stderr, /GAGAL {2}bengkel-laravel-web-1\.0\.0\.zip: 1 galat/)
    assert.match(proses.stderr, /tests\/e2e\/package\.json: folder tests\/e2e\/ tidak boleh ikut dijual/)
})

test('periksa.mjs memeriksa folder hasil ekstrak; nama folder yang bukan paket butuh --varian', () => {
    const akar = baru(() => buatRepoFixture())
    const keluar = baru(() => folderSementara('kemas-keluar-'))
    jalankan(KEMAS, ['--akar', akar, '--keluaran', keluar, '--versi=1.0.0', '--tanpa-panduan'])
    const ekstrak = baru(() => folderSementara('kemas-ekstrak-'))
    for (const e of bacaZip(readFileSync(join(keluar, 'bengkel-laravel-web-1.0.0.zip')))) {
        const tujuan = join(ekstrak, e.nama)
        mkdirSync(dirname(tujuan), { recursive: true })
        writeFileSync(tujuan, e.isi)
    }
    const folderPaket = join(ekstrak, 'bengkel-laravel-web-1.0.0')
    const lolos = jalankan(PERIKSA, [folderPaket, '--tanpa-panduan'])
    assert.equal(lolos.status, 0, lolos.stdout + lolos.stderr)
    assert.match(lolos.stdout, /lolos {2}bengkel-laravel-web-1\.0\.0: 26 berkas/)

    writeFileSync(join(folderPaket, 'backend-laravel', '.env'), 'SETUP_TOKEN=x\n')
    const bocor = jalankan(PERIKSA, [folderPaket, '--tanpa-panduan'])
    assert.equal(bocor.status, 1)
    assert.match(bocor.stderr, /backend-laravel\/\.env: berkas rahasia ikut terbawa/)

    const lain = join(ekstrak, 'hasil-ekstrak')
    mkdirSync(lain)
    const tanpaVarian = jalankan(PERIKSA, [lain, '--tanpa-panduan'])
    assert.equal(tanpaVarian.status, 1)
    assert.match(tanpaVarian.stderr, /bukan bengkel-<varian>-web-<versi>; sebutkan --varian/)
})

// ---- blok internal dan port spec ------------------------------------------------------------

const README_DENGAN_BLOK = (bungkusDaftarIsi) =>
    [
        '# Backend',
        '',
        '## Isi',
        '',
        '- [Menjalankan](#menjalankan)',
        ...(bungkusDaftarIsi ? ['<!-- kemas:abaikan-mulai -->', '- [Menguji](#menguji)', '<!-- kemas:abaikan-selesai -->'] : ['- [Menguji](#menguji)']),
        '- [Produksi](#produksi)',
        '',
        '## Menjalankan',
        '',
        'Nyalakan backend.',
        '',
        '<!-- kemas:abaikan-mulai -->',
        '## Menguji',
        '',
        'Jalankan tes kontrak di tests/kontrak lewat scripts/uji-kontrak.sh, atau uji-serentak.sh di Nginx.',
        'Database uji: bengkel_uji_laravel lewat migrate-uji-laravel.',
        '<!-- kemas:abaikan-selesai -->',
        '',
        '## Produksi',
        '',
        'Pakai Nginx.',
        '',
    ].join('\n')

test('blok internal dibuang dari paket, dan daftar isi yang ikut dibungkus tetap menaut ke judul yang ada', () => {
    const akar = baru(() => buatRepoFixture({ 'backend-laravel/README.md': README_DENGAN_BLOK(true) }))
    const hasil = bangun(akar)
    assert.deepEqual(hasil.galat, [])
    const readme = isiZip(hasil)['backend-laravel/README.md']
    assert.ok(!/kemas:abaikan|Menguji|tests\/kontrak|uji-kontrak|uji-serentak|migrate-uji|bengkel_uji/.test(readme), readme)
    assert.match(readme, /- \[Menjalankan\]\(#menjalankan\)\n- \[Produksi\]\(#produksi\)\n/)
    assert.doesNotMatch(readme, /\n\n\n/, 'tidak ada baris kosong ganda di bekas blok')
})

test('daftar isi yang lupa dibungkus membuat paket ditolak karena anchor-nya rusak sesudah blok dibuang', () => {
    const akar = baru(() => buatRepoFixture({ 'backend-laravel/README.md': README_DENGAN_BLOK(false) }))
    harapkan(bangun(akar).galat, /^backend-laravel\/README\.md:6: tautan "#menguji" rusak, judul #menguji tidak ada di backend-laravel\/README\.md$/)
})

test('penanda blok yang salah pasang menghasilkan galat dengan berkas dan baris, bukan paket yang setengah benar', () => {
    const akar = baru(() =>
        buatRepoFixture({ 'backend-laravel/README.md': '# Backend\n\n<!-- kemas:abaikan-mulai -->\nIsi tanpa penutup.\n', 'backend-laravel/.gitignore': 'a\n# kemas:abaikan-selesai\n' }),
    )
    const hasil = bangun(akar)
    assert.ok(hasil.galat.includes('backend-laravel/README.md:3: penanda <!-- kemas:abaikan-mulai --> tidak ditutup'), hasil.galat.join('\n'))
    assert.ok(hasil.galat.includes('backend-laravel/.gitignore:2: penanda # kemas:abaikan-selesai tanpa pembuka'), hasil.galat.join('\n'))
    assert.ok(hasil.galat.some((g) => /^backend-laravel\/README\.md:\d+: merujuk penanda blok internal kemas:abaikan/.test(g)), 'penanda yang tersisa juga ditolak pemeriksa')
})

test('penanda di kode sumber (jenis berkas yang tidak mendukungnya) menghentikan paket', () => {
    const akar = baru(() => buatRepoFixture({ 'web/src/app/page.tsx': `${header()}// kemas:abaikan-mulai\nexport default 1\n` }))
    const hasil = bangun(akar)
    assert.ok(hasil.galat.includes('web/src/app/page.tsx: memuat penanda kemas:abaikan, tetapi jenis berkas ini tidak mendukungnya (hanya .md, .env.example, dan .gitignore)'), hasil.galat.join('\n'))
})

test('blok bertanda di .env.example dan .gitignore dibuang dari paket', () => {
    const akar = baru(() =>
        buatRepoFixture({
            'backend-laravel/.gitignore': 'vendor/\n# kemas:abaikan-mulai\nstorage/uji/\n# kemas:abaikan-selesai\n.env\n',
            'backend-laravel/.env.example': `${envBackend()}# kemas:abaikan-mulai\n# Tes kontrak memakai 8882.\n# kemas:abaikan-selesai\n`,
        }),
    )
    const hasil = bangun(akar)
    assert.deepEqual(hasil.galat, [])
    const isi = isiZip(hasil)
    assert.equal(isi['backend-laravel/.gitignore'], 'vendor/\n.env\n')
    assert.doesNotMatch(isi['backend-laravel/.env.example'], /kemas|8882/)
})

test('servers di kontrak API menunjuk ke port backend Laravel', () => {
    const akar = baru(() => buatRepoFixture())
    const spec = isiZip(bangun(akar))['spec/openapi.yaml']
    assert.ok(spec.includes('servers:\n  - url: http://localhost:8802\n    description: Backend (alamat dev bawaan)\n'), spec)
})

test('spec yang berubah bentuk (servers lebih dari satu) menghentikan paket dengan pesan yang jelas', () => {
    const akar = baru(() => buatRepoFixture({ 'spec/openapi.yaml': `${header('#')}\nservers:\n  - url: http://localhost:8802\n  - url: http://localhost:8803\n` }))
    const keluar = baru(() => folderSementara('kemas-keluar-'))
    const proses = jalankan(KEMAS, ['--akar', akar, '--keluaran', keluar, '--versi=1.0.0', '--tanpa-panduan'])
    assert.equal(proses.status, 1)
    assert.deepEqual(readdirSync(keluar), [])
    assert.match(proses.stderr, /laravel: GAGAL: spec\/openapi\.yaml memuat 2 entri/)
})
