// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pemeriksa harus MENERIMA paket sah dan MENOLAK tiap jenis pelanggaran. Setiap pelanggaran
// punya tesnya sendiri, dan `harapkan` memastikan satu pelanggaran tidak memicu galat lain.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FOLDER_PANDUAN, JENIS, MEREK_BOLEH_DI_PANDUAN, PANDUAN_WAJIB, VARIAN, VARIAN_TERSEDIA, namaPaket } from '../lib/aturan.mjs'
import { bacaEnv, daftarAnchor, periksaHeader, periksaPaket, slugJudul, wajibAda } from '../lib/periksa.mjs'
import { TOKEN_WA, docx, harapkan, header, isiPaketSah, jadikanEntri, periksaDengan } from './bantu.mjs'

const BAWAAN = VARIAN.laravel
// Varian yang dicadangkan tetapi belum ada: paket Laravel tetap tidak boleh menyebutnya.
const lain = Object.values(VARIAN).filter((v) => v.kode !== BAWAAN.kode)
const P1 = PANDUAN_WAJIB[0]
const P3 = PANDUAN_WAJIB[2]
const re = (teks) => teks.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---- paket sah ------------------------------------------------------------------------------

for (const varian of VARIAN_TERSEDIA) {
    test(`paket sah varian ${varian.nama} lolos tanpa galat (templat ikut diperiksa)`, async () => {
        assert.deepEqual(await periksaDengan(null, { varian }), [])
    })
}

test('versi pra-rilis dan nama folder akar harus cocok dengan varian dan versi', async () => {
    assert.deepEqual(await periksaDengan(null, { versi: '2.0.0-rc.1' }), [])
    const isi = isiPaketSah(BAWAAN, '1.0.0')
    const galat = periksaPaket(jadikanEntri(isi, BAWAAN, '1.0.0'), { varian: BAWAAN, versi: '1.0.1', jenis: JENIS.web })
    assert.match(galat[0], /^bengkel-laravel-web-1\.0\.0\/.*: tidak berada di folder bengkel-laravel-web-1\.0\.1\/$/)
})

// ---- berkas terlarang -----------------------------------------------------------------------

const BERKAS_TERLARANG = [
    ['tests/kontrak/package.json', /^tests\/kontrak\/package\.json: folder tests\/kontrak\/ tidak boleh ikut dijual$/],
    ['tests/e2e/tes/alur.spec.ts', /^tests\/e2e\/tes\/alur\.spec\.ts: folder tests\/e2e\/ tidak boleh ikut dijual$/],
    ['alat/kemas-varian/kemas.mjs', /^alat\/kemas-varian\/kemas\.mjs: folder alat\/ tidak boleh ikut dijual$/],
    ['alat/panduan-word/buat.js', /^alat\/panduan-word\/buat\.js: folder alat\/ tidak boleh ikut dijual$/],
    ['docs/eksekusi/aturan-bersama.md', /^docs\/eksekusi\/aturan-bersama\.md: folder docs\/eksekusi\/ tidak boleh ikut dijual$/],
    ['docs/rancangan.md', /^docs\/rancangan\.md: berkas docs\/rancangan\.md tidak boleh ikut dijual$/],
    ['spec/redocly.yaml', /^spec\/redocly\.yaml: berkas spec\/redocly\.yaml tidak boleh ikut dijual$/],
    ['dist/paket/bengkel-laravel-web-0.1.0.zip', /^dist\/paket\/bengkel-laravel-web-0\.1\.0\.zip: folder dist\/ tidak boleh ikut dijual$/],
    ['.git/config', /^\.git\/config: folder \.git\/ tidak boleh ikut dijual$/],
    ['.claude/settings.json', /^\.claude\/settings\.json: folder \.claude\/ tidak boleh ikut dijual$/],
    ['.playwright-mcp/log.txt', /^\.playwright-mcp\/log\.txt: folder \.playwright-mcp\/ tidak boleh ikut dijual$/],
    ['.impeccable/catatan.md', /^\.impeccable\/catatan\.md: folder \.impeccable\/ tidak boleh ikut dijual$/],
]
for (const [path, pola] of BERKAS_TERLARANG) {
    test(`berkas terlarang ditolak: ${path}`, async () => {
        const galat = await periksaDengan((m) => m.set(path, 'isi biasa\n'))
        // Sebagian folder terlarang juga masuk daftar segmen build atau dot-folder; satu galat jenis
        // "tidak boleh ikut dijual" sudah cukup, galat segmen tambahan diterima.
        assert.ok(galat.some((g) => pola.test(g)), galat.join('\n'))
    })
}

for (const v of lain) {
    test(`backend varian lain ditolak: ${v.folder}/`, async () => {
        const galat = await periksaDengan((m) => m.set(`${v.folder}/go.mod`, 'module x\n'))
        harapkan(galat, new RegExp(`^${v.folder}/go\\.mod: folder ${v.folder}/ tidak boleh ikut dijual$`))
    })
}

for (const segmen of ['node_modules', 'vendor', 'dist', 'build', '.next', 'coverage']) {
    test(`hasil build atau dependensi ditolak: segmen ${segmen}`, async () => {
        const galat = await periksaDengan((m) => m.set(`web/${segmen}/x/index.js`, 'x\n'))
        assert.ok(galat.some((g) => g.startsWith(`web/${segmen}/x/index.js: hasil build, dependensi`)), galat.join('\n'))
    })
}

for (const [path, nama] of [
    ['backend-laravel/bin/api', 'bin'],
    ['backend-laravel/uploads/a.jpg', 'uploads'],
    ['backend-laravel/uploads-uji/a.jpg', 'uploads-uji'],
]) {
    test(`data runtime backend ditolak: ${nama}`, async () => {
        const galat = await periksaDengan((m) => m.set(path, 'x\n'))
        harapkan(galat, new RegExp(`^${path}: hasil build, dependensi, atau data runtime ikut terbawa$`))
    })
}

for (const path of ['backend-laravel/.env', 'web/.env.local', 'backend-laravel/.env.production', 'backend-laravel/kunci.pem', 'backend-laravel/storage/oauth-private.key']) {
    test(`berkas rahasia ditolak: ${path}`, async () => {
        const galat = await periksaDengan((m) => m.set(path, 'x\n'))
        harapkan(galat, new RegExp(`^${path.replaceAll('.', '\\.')}: berkas rahasia ikut terbawa$`))
    })
}

for (const path of ['backend-laravel/api.exe', 'backend-laravel/storage/logs/laravel.log', 'web/.DS_Store', 'web/Thumbs.db', 'web/tsconfig.tsbuildinfo', 'backend-laravel/.phpunit.result.cache']) {
    test(`sisa build atau sistem operasi ditolak: ${path}`, async () => {
        const galat = await periksaDengan((m) => m.set(path, 'x\n'))
        assert.ok(galat.some((g) => g.includes(`${path}: sisa build atau sistem operasi ikut terbawa`)), galat.join('\n'))
    })
}

for (const skrip of ['uji-kontrak.sh', 'uji-serentak.sh']) {
    test(`skrip tes kontrak di backend ditolak: ${skrip}`, async () => {
        const galat = await periksaDengan((m) => m.set(`backend-laravel/scripts/${skrip}`, `#!/usr/bin/env bash\n${header('#')}\necho aman\n`))
        harapkan(galat, new RegExp(`^backend-laravel/scripts/${re(skrip)}: skrip tes kontrak tidak boleh ikut dijual$`))
    })
}

test('berkas lebih dari 5 MB ditolak, kecuali yang didaftarkan sah', async () => {
    const galat = await periksaDengan((m) => m.set('web/public/video.mp4', Buffer.alloc(5 * 1024 * 1024 + 1, 1)))
    harapkan(galat, /^web\/public\/video\.mp4: berukuran 5\.0 MB, melebihi batas 5 MB/)
    assert.deepEqual(await periksaDengan((m) => m.set('web/public/ok.mp4', Buffer.alloc(5 * 1024 * 1024, 1))), [])
})

test('nama berkas yang tidak aman ditolak (jalur mundur dan garis miring terbalik)', async () => {
    const mundur = await periksaDengan((m) => m.set('web/../../luar.txt', 'x\n'))
    harapkan(mundur, /^web\/\.\.\/\.\.\/luar\.txt: nama berkas tidak aman/)
    const terbalik = await periksaDengan((m) => m.set('web\\x.txt', 'x\n'))
    harapkan(terbalik, /^web\\x\.txt: nama berkas tidak aman/)
})

test('nama berkas ganda di ZIP ditolak', () => {
    const isi = isiPaketSah()
    const entri = jadikanEntri(isi)
    const galat = periksaPaket([...entri, entri.find((e) => e.nama.endsWith('/LICENSE'))], { varian: BAWAAN, versi: '1.0.0', jenis: JENIS.web })
    harapkan(galat, /^LICENSE: nama berkas ganda di paket$/)
})

test('berkas di luar folder akar paket ditolak', () => {
    const entri = [...jadikanEntri(isiPaketSah()), { nama: 'di-luar.txt', isi: Buffer.from('x'), sha256: 'x' }]
    harapkan(periksaPaket(entri, { varian: BAWAAN, versi: '1.0.0', jenis: JENIS.web }), /^di-luar\.txt: tidak berada di folder bengkel-laravel-web-1\.0\.0\/$/)
})

// ---- rujukan teks ---------------------------------------------------------------------------

// [nama, isi baris, pola galat]. Dipasang di komentar kode (web/src/x.ts) bila `kode` true,
// atau di Markdown bila tidak.
const RUJUKAN = [
    ['tests/kontrak', 'Lihat tests/kontrak untuk contoh.', /merujuk folder tests\/kontrak/],
    ['tests/e2e', 'Skenario ada di tests/e2e.', /merujuk folder tests\/e2e/],
    ['alat/', 'Jalankan alat/kemas-varian/kemas.mjs.', /merujuk folder alat\//],
    ['docs/eksekusi', 'Catatan di docs/eksekusi/bagian-5.md.', /merujuk folder docs\/eksekusi/],
    ['rancangan.md', 'Baca rancangan.md dulu.', /merujuk berkas rancangan\.md/],
    ['migrate-uji', 'docker compose run --rm migrate-uji up', /merujuk runner migrate-uji/],
    ['cek-harness', 'npm run cek-harness', /merujuk perintah tes kontrak/],
    ['BASE_URL=', 'BASE_URL=http://localhost:8882 npm test', /merujuk perintah tes kontrak/],
    ['lint-spec', 'npm run lint-spec', /merujuk perintah tes kontrak/],
    ['.spec-bundel', 'Hasil ada di .spec-bundel/.', /merujuk folder \.spec-bundel/],
    ['uji-kontrak', 'Jalankan scripts/uji-kontrak.sh.', /merujuk skrip uji-kontrak atau uji-serentak/],
    ['uji-serentak', 'Jalankan scripts/uji-serentak.sh.', /merujuk skrip uji-kontrak atau uji-serentak/],
    ['produk laundry', 'Pola yang sama dengan papan laundry.', /merujuk rujukan ke produk lain penjual/],
    ['produk toko online', 'Dipakai juga oleh toko online kami.', /merujuk rujukan ke produk lain penjual/],
    ['produk kafe-resto', 'Sama dengan qr_token meja di kafe-resto.', /merujuk rujukan ke produk lain penjual/],
    ['produk SIAKAD', 'Port 3340 dipakai SIAKAD.', /merujuk rujukan ke produk lain penjual/],
    ['tahap A', '> Status: tahap A (kerangka).', /merujuk penanda tahap pengerjaan internal/],
    ['Bagian 0b', 'WhatsApp palsu dibuat di Bagian 0b.', /merujuk penanda tahap pengerjaan internal/],
    ['Bagian 0a', '// keputusan Bagian 0a nomor 0a-2', /merujuk penanda tahap pengerjaan internal/],
]
for (const [nama, baris, pola] of RUJUKAN) {
    test(`rujukan teks ke ${nama} ditolak di komentar kode`, async () => {
        const galat = await periksaDengan((m) => m.set('web/src/x.ts', `${header()}\n// ${baris}\nexport const x = 1\n`))
        harapkan(galat, new RegExp(`^web/src/x\\.ts:4: ${pola.source}`))
    })
    test(`rujukan teks ke ${nama} ditolak di dokumen, lengkap dengan nomor baris`, async () => {
        const galat = await periksaDengan((m) => m.set('web/README.md', `# Web\n\n${baris}\n`))
        harapkan(galat, new RegExp(`^web/README\\.md:3: ${pola.source}`))
    })
}

for (const db of ['bengkel_uji_laravel', 'bengkel_e2e_laravel', 'bengkel_review_1']) {
    test(`database tes (${db}) ditolak di dokumen, tetapi di kode hanya contoh data biasa`, async () => {
        const dokumen = await periksaDengan((m) => m.set('web/README.md', `Pakai database ${db}.\n`))
        harapkan(dokumen, /^web\/README\.md:1: merujuk database tes kontrak, E2E, atau review/)
        const kode = await periksaDengan((m) => m.set('web/src/x.ts', `${header()}\nexport const dsn = 'mysql://bengkel:bengkel@localhost:3350/${db}'\n`))
        assert.deepEqual(kode, [])
    })
}

for (const v of lain) {
    test(`folder backend lain (${v.folder}) ditolak sebagai rujukan teks`, async () => {
        const galat = await periksaDengan((m) => m.set('web/src/x.ts', `${header()}\n// cd ${v.folder} lalu jalankan\nexport const x = 1\n`))
        harapkan(galat, new RegExp(`^web/src/x\\.ts:4: merujuk folder ${v.folder}, yang tidak ikut paket ini`))
    })
}

const DOKUMEN_TERLARANG = [
    ['frasa "ketiga backend"', 'Nama env sama di ketiga backend bengkel.', /frasa tentang beberapa backend/],
    ['frasa "tes kontrak"', 'Diuji lewat tes kontrak.', /rujukan ke tes kontrak/],
    ['kata "harness"', 'Harness mengosongkan tabel.', /rujukan ke harness tes/],
    ['nama backend NestJS', 'Mirip NestJS di bagian ini.', /nama backend NestJS/],
    ['nama backend Go sebagai backend', 'Bandingkan dengan backend Go.', /nama backend Go/],
    ['nama backend Go dalam daftar', 'Pilihannya (Go, NestJS).', /nama backend Go/],
    ['port backend Go', 'Backend lain di http://localhost:8801/api.', /port backend Go \(8801\)/],
    ['port backend NestJS', 'Backend lain di http://localhost:8803/api.', /port backend NestJS \(8803\)/],
]
for (const [nama, baris, pola] of DOKUMEN_TERLARANG) {
    test(`dokumen yang memuat ${nama} ditolak, tetapi komentar kode tidak`, async () => {
        const galat = await periksaDengan((m) => m.set('web/README.md', `# Web\n${baris}\n`))
        assert.ok(galat.some((g) => pola.test(g) && g.startsWith('web/README.md:2:')), galat.join('\n'))
        const kode = await periksaDengan((m) => m.set('web/src/x.ts', `${header()}\n// ${baris}\n`))
        assert.deepEqual(kode, [])
    })
}

test('README akar boleh menyebut varian lain dengan namanya sebagai pilihan, tetapi bukan folder atau port-nya', async () => {
    const sah = await periksaDengan((m) => m.set('README.md', `${m.get('README.md')}\nKelak tersedia juga untuk Go dan NestJS (ketiga backend memakai kontrak sama).\n`))
    assert.deepEqual(sah, [])
    const folder = await periksaDengan((m) => m.set('README.md', `${m.get('README.md')}\nLihat backend-go/README.md.\n`))
    assert.ok(folder.some((g) => /^README\.md:\d+: merujuk folder backend-go/.test(g)), folder.join('\n'))
    const port = await periksaDengan((m) => m.set('README.md', `${m.get('README.md')}\nNestJS di :8803.\n`))
    assert.ok(port.some((g) => /^README\.md:\d+: merujuk port backend NestJS \(8803\)/.test(g)), port.join('\n'))
    const kontrak = await periksaDengan((m) => m.set('README.md', `${m.get('README.md')}\nTes kontrak menjaganya.\n`))
    assert.ok(kontrak.some((g) => /^README\.md:\d+: merujuk rujukan ke tes kontrak/.test(g)), kontrak.join('\n'))
})

test('backend milik varian sendiri tidak dianggap rujukan ke backend lain', async () => {
    for (const v of VARIAN_TERSEDIA) {
        const galat = await periksaDengan(
            (m) => m.set(`${v.folder}/README.md`, `# Backend ${v.nama}\n\nBackend ${v.nama} di http://localhost:${v.port}, folder ${v.folder}/.\n`),
            { varian: v },
        )
        assert.deepEqual(galat, [], v.kode)
    }
})

test('kata go biasa tidak dianggap nama backend, tetapi "backend Go", "(Go", dan "Go dan" iya', async () => {
    const dokumen = (baris) => periksaDengan((m) => m.set('web/README.md', `${baris}\n`))
    assert.deepEqual(await dokumen('Ayo go ke bengkel. Kerja Go-lang di sana.'), [])
    for (const baris of ['Ini backend Go yang cepat.', 'Pilihan (Go, NestJS).', 'Cara Go dan Rust.']) {
        const galat = await dokumen(baris)
        assert.ok(galat.some((g) => /^web\/README\.md:1: merujuk nama backend Go,/.test(g)), `${baris}: ${galat.join('\n')}`)
    }
})

test('rujukan sah tidak ditolak: tests/wa-palsu, docs/panduan, kata kontrak, dan alat sebagai kata', async () => {
    const galat = await periksaDengan((m) =>
        m.set('web/README.md', '# Web\n\nWhatsApp palsu di `tests/wa-palsu/` dan panduan di `docs/panduan/`. Kontrak API di spec. Itu alat bantu; kerja alat-alat tulis.\nSaat https://contoh.id/alat/ dibuka.\n'),
    )
    assert.deepEqual(galat, [])
})

test('temuan sejenis dalam satu berkas diringkas, dan berkas kunci dependensi dilewati', async () => {
    const banyak = Array.from({ length: 6 }, (_, i) => `baris ${i} tests/kontrak`).join('\n')
    const galat = await periksaDengan((m) => {
        m.set('web/README.md', `${banyak}\n`)
        m.set('web/package-lock.json', `{"x": "tests/kontrak ketiga backend"}\n`)
    })
    assert.equal(galat.length, 4)
    assert.match(galat[3], /^web\/README\.md: … dan 3 rujukan folder tests\/kontrak lainnya$/)
})

// ---- rahasia --------------------------------------------------------------------------------

const KUNCI_ASLI = [
    ['kunci privat', '-----BEGIN RSA PRIVATE KEY-----'],
    ['kunci API Google', 'AIzaSyA1234567890abcdefghijklmnopqrstuv'],
    ['token GitHub', `ghp_${'a'.repeat(36)}`],
    ['kunci AWS', 'AKIAABCDEFGHIJKLMNOP'],
    ['token Slack', 'xoxb-1234567890-abcdefghij'],
    ['kunci Stripe', 'sk_live_abcdefghijklmnop1234'],
]
for (const [nama, nilai] of KUNCI_ASLI) {
    test(`rahasia ditolak: ${nama}`, async () => {
        const galat = await periksaDengan((m) => m.set('web/src/kunci.ts', `${header()}\nexport const k = '${nilai}'\n`))
        harapkan(galat, new RegExp(`^web/src/kunci\\.ts: memuat ${nama}$`))
    })
}

test('URL berkredensial ke host sungguhan ditolak, tetapi localhost dan host contoh sah', async () => {
    const galat = await periksaDengan((m) => m.set('web/README.md', 'DATABASE_URL=mysql://admin:S3cr3t@db.perusahaan.com:3306/bengkel\n'))
    harapkan(galat, /^web\/README\.md:1: URL berkredensial ke host sungguhan "db\.perusahaan\.com"$/)
    const sah = await periksaDengan((m) =>
        m.set('web/README.md', 'mysql://bengkel:bengkel@localhost:3350/bengkel\nmysql://user:sandi@host:port/database\nhttp://u:p@db.example.com/x\nmysql://a:b@mysql:3306/bengkel\nmysql://a:b@db.local/k\n'),
    )
    assert.deepEqual(sah.filter((g) => /URL berkredensial/.test(g)), [])
})

test('.env.example: WA_TOKEN yang bukan contoh ditolak', async () => {
    const galat = await periksaDengan((m) =>
        m.set('backend-laravel/.env.example', m.get('backend-laravel/.env.example').replace(TOKEN_WA, 'Xq7kP2mZr9TfW3hLs8Dq')),
    )
    assert.ok(galat.some((g) => /^backend-laravel\/\.env\.example:\d+: WA_TOKEN berisi nilai yang tidak tampak seperti contoh$/.test(g)), galat.join('\n'))
    assert.ok(galat.some((g) => /WA_TOKEN tidak sama dengan token bawaan/.test(g)))
})

test('.env.example: SETUP_TOKEN wajib kosong, walau nilainya bertanda contoh', async () => {
    const galat = await periksaDengan((m) =>
        m.set('backend-laravel/.env.example', m.get('backend-laravel/.env.example').replace('SETUP_TOKEN=', 'SETUP_TOKEN=token-setup-uji-bukan-rahasia')),
    )
    harapkan(galat, /^backend-laravel\/\.env\.example: SETUP_TOKEN wajib kosong/)
})

test('nilai rahasia di dokumen: placeholder, substitusi perintah, dan penanda contoh sah; nilai acak ditolak', async () => {
    const sah = await periksaDengan((m) =>
        m.set('web/README.md', 'WA_TOKEN=<token perangkat>\nSETUP_TOKEN=\nSETUP_TOKEN=$(openssl rand -hex 16)\nexport SETUP_TOKEN=$SETUP\nAPI_KEY="${API_KEY}"\nWA_TOKEN=token-wa-uji-bukan-asli\n'),
    )
    assert.deepEqual(sah, [])
    const salah = await periksaDengan((m) => m.set('web/README.md', '# Env\nWA_TOKEN=Xq7kP2mZr9TfW3hLs8Dq\n'))
    harapkan(salah, /^web\/README\.md:2: WA_TOKEN berisi nilai yang tidak tampak seperti contoh$/)
})

// ---- header hak cipta -----------------------------------------------------------------------

const TANPA_HEADER = [
    ['Go', 'web/alat-go/main.go', 'package main\n'],
    ['TypeScript', 'web/src/a.ts', 'export const a = 1\n'],
    ['TSX', 'web/src/a.tsx', 'export default function A() { return null }\n'],
    ['PHP', 'backend-laravel/app/A.php', '<?php\n\nnamespace App;\n'],
    ['SQL', 'db/migrations/000002_x.up.sql', 'SELECT 1;\n'],
    ['CSS', 'web/src/a.css', 'body { margin: 0 }\n'],
    ['YAML', 'spec/paths/a.yaml', 'a: 1\n'],
    ['shell', 'backend-laravel/skrip.sh', '#!/usr/bin/env bash\necho hai\n'],
    ['.env.example', 'tests/wa-palsu/.env.example', 'WA_PALSU_PORT=8890\nWA_TOKEN=token-wa-uji-bengkel-bukan-kunci-asli\n'],
    ['artisan (tanpa ekstensi)', 'backend-laravel/artisan', '#!/usr/bin/env php\n<?php\necho 1;\n'],
]
for (const [nama, path, isi] of TANPA_HEADER) {
    test(`berkas kode tanpa header hak cipta ditolak: ${nama}`, async () => {
        const galat = await periksaDengan((m) => m.set(path, isi))
        harapkan(galat, new RegExp(`^${path.replaceAll('.', '\\.')}:\\d+: tanpa header hak cipta dua baris \\(baris pertama`))
    })
}

test('header dengan baris kedua yang hilang atau salah ditolak', async () => {
    const hilang = await periksaDengan((m) => m.set('web/src/a.ts', '// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.\nexport const a = 1\n'))
    harapkan(hilang, /^web\/src\/a\.ts:2: tanpa header hak cipta dua baris \(baris kedua header/)
    const salah = await periksaDengan((m) => m.set('web/src/a.ts', header().replace('ariefmanggalaputra', 'orang lain') + 'export const a = 1\n'))
    harapkan(salah, /^web\/src\/a\.ts:1: tanpa header/)
})

test('header sah dalam berbagai bahasa diterima: shebang, <?php, <?xml, blok CSS, SQL, dan komentar HTML', () => {
    const H = header('//')
    const kasus = {
        go: H + 'package main\n',
        shebang: '#!/usr/bin/env bash\n' + header('#') + 'echo\n',
        php: '<?php\n\n' + H + 'namespace A;\n',
        artisan: '#!/usr/bin/env php\n<?php\n\n' + H,
        xml: '<?xml version="1.0"?>\n<!-- Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi. -->\n<!-- Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini. -->\n<a/>\n',
        css: '/*\n * Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.\n * Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.\n */\nbody {}\n',
        sql: header('--') + 'SELECT 1;\n',
        crlf: H.replaceAll('\n', '\r\n') + 'x\r\n',
        bom: '\uFEFF' + H,
    }
    for (const [nama, isi] of Object.entries(kasus)) assert.equal(periksaHeader(isi), null, nama)
})

test('berkas JSON, lockfile, Markdown, SVG, gambar, dan konfigurasi titik tidak diwajibkan berheader', async () => {
    const galat = await periksaDengan((m) => {
        m.set('web/tsconfig.json', '{}\n')
        m.set('web/package-lock.json', '{}\n')
        m.set('web/src/icon.svg', '<svg/>\n')
        m.set('web/public/a.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]))
        m.set('web/.npmrc', 'save-exact=true\n')
        m.set('web/.prettierrc', '{}\n')
        m.set('backend-laravel/composer.lock', '{}\n')
        m.set('web/pnpm-lock.yaml', 'a: 1\n')
        m.set('web/CATATAN.md', '# Catatan\n')
    })
    assert.deepEqual(galat, [])
})

// ---- LICENSE, panduan, CRLF, jalur mesin, brand ---------------------------------------------

test('paket tanpa LICENSE ditolak, termasuk rujukan README ke berkas itu', async () => {
    harapkan(
        await periksaDengan((m) => m.delete('LICENSE')),
        /^LICENSE: wajib ada di paket tetapi tidak ditemukan$/,
        /^README\.md:\d+: merujuk `LICENSE`, yang tidak ada di paket$/,
    )
})

test('LICENSE yang nyaris kosong ditolak', async () => {
    harapkan(await periksaDengan((m) => m.set('LICENSE', 'x')), /^LICENSE: isinya terlalu pendek/)
})

for (const nama of PANDUAN_WAJIB) {
    test(`paket tanpa panduan Word ${nama} ditolak`, async () => {
        const galat = await periksaDengan((m) => m.delete(`docs/panduan/${nama}`))
        harapkan(galat, new RegExp(`^docs/panduan/${nama.replaceAll('.', '\\.')}: panduan Word wajib ada`))
    })
}

test('--tanpa-panduan membolehkan paket tanpa panduan, hanya untuk tahap pengembangan', async () => {
    const ubah = (m) => PANDUAN_WAJIB.forEach((n) => m.delete(`docs/panduan/${n}`))
    const tanpaFlag = await periksaDengan(ubah)
    assert.equal(tanpaFlag.filter((g) => /panduan Word wajib ada/.test(g)).length, 4)
    assert.deepEqual(await periksaDengan(ubah, { tanpaPanduan: true }), [])
})

test('panduan yang bukan .docx sah ditolak', async () => {
    const galat = await periksaDengan((m) => m.set(`docs/panduan/${P1}`, 'bukan zip sama sekali, hanya teks biasa'))
    harapkan(galat, new RegExp(`^docs/panduan/${re(P1)}: bukan berkas \\.docx yang sah`))
})

test('berkas lain di docs/panduan ditolak', async () => {
    const galat = await periksaDengan((m) => m.set('docs/panduan/draf.docx', docx()))
    harapkan(galat, /^docs\/panduan\/draf\.docx: bukan salah satu dari empat panduan Word/)
})

test('teks panduan Word yang merujuk tests/kontrak atau jalur mesin ditolak', async () => {
    const galat = await periksaDengan((m) => m.set(`docs/panduan/${P3}`, docx('Jalankan tests/kontrak dulu di D:\\KODE_PRODUK\\bengkel')))
    harapkan(galat, new RegExp(`${re(P3)}: teks panduan merujuk folder tests/kontrak`), new RegExp(`${re(P3)}: teks panduan memuat jalur absolut`))
})

test('berkas teks ber-CRLF ditolak dengan nomor barisnya, kecuali .bat', async () => {
    const galat = await periksaDengan((m) => m.set('web/src/a.ts', `${header()}export const a = 1\r\n`))
    harapkan(galat, /^web\/src\/a\.ts:3: akhir baris CRLF; berkas teks di paket harus LF$/)
    const bat = await periksaDengan((m) => m.set('web/skrip.bat', '@echo off\r\necho hai\r\n'))
    assert.deepEqual(bat, [])
})

for (const jalur of ['D:\\KODE_PRODUK\\bengkel', 'C:\\Users\\USER\\proyek', 'D:/KODE_PRODUK/bengkel', '/d/KODE_PRODUK/bengkel']) {
    test(`jalur absolut mesin pengembang ditolak: ${jalur}`, async () => {
        const galat = await periksaDengan((m) => m.set('web/README.md', `# Web\n\nBuka ${jalur} lalu jalankan.\n`))
        harapkan(galat, /^web\/README\.md:3: memuat jalur absolut mesin pengembang/)
    })
}

test('nama brand toko ditolak di kode dan README bagian lain, tetapi sah di LICENSE, README akar, dan email hak cipta', async () => {
    const galat = await periksaDengan((m) => m.set('web/src/a.ts', `${header()}// Dibuat oleh KodeCoding\nexport const a = 1\n`))
    harapkan(galat, /^web\/src\/a\.ts:3: memuat nama brand toko/)
    const sah = await periksaDengan((m) => {
        m.set('LICENSE', `${m.get('LICENSE')}Dijual melalui KodeCoding.\n`)
        m.set('README.md', `${m.get('README.md')}\nDijual oleh KodeCoding.\n`)
    })
    assert.deepEqual(sah, [])
})

test('gambar yang sama persis dengan gambar brand ditolak; tanpa sidik brand pemeriksaan dilewati', async () => {
    const logo = Buffer.from('<svg>logo brand toko</svg>')
    const { sha256 } = await import('../lib/merek.mjs')
    const hashMerek = new Map([[sha256(logo), 'brand kit 01-logo/logo.svg']])
    const ubah = (m) => m.set('web/public/logo.svg', logo)
    harapkan(await periksaDengan(ubah, { hashMerek }), /^web\/public\/logo\.svg: isinya sama dengan gambar brand kit 01-logo\/logo\.svg$/)
    assert.deepEqual(await periksaDengan(ubah), [])
})

// ---- berkas wajib ---------------------------------------------------------------------------

for (const wajib of wajibAda(BAWAAN, JENIS.web)) {
    test(`berkas wajib yang hilang dilaporkan: ${wajib}`, async () => {
        const galat = await periksaDengan((m) => {
            for (const k of [...m.keys()]) if (wajib.endsWith('/') ? k.startsWith(wajib) : k === wajib) m.delete(k)
        })
        assert.ok(galat.some((g) => g === `${wajib}: wajib ada di paket tetapi tidak ditemukan`), galat.join('\n'))
    })
}

// ---- kecocokan antarbagian ------------------------------------------------------------------

const gantiTeks = (m, path, dari, ke) => m.set(path, m.get(path).replace(dari, ke))
const KONSISTENSI = [
    [
        'PORT backend salah',
        (m) => gantiTeks(m, 'backend-laravel/.env.example', 'PORT=8802', 'PORT=8000'),
        [/^backend-laravel\/\.env\.example: PORT harus 8802, bukan "8000"$/],
    ],
    [
        'WA_API_URL bukan WhatsApp palsu dev',
        (m) => gantiTeks(m, 'backend-laravel/.env.example', 'localhost:8890', 'localhost:9999'),
        [/WA_API_URL harus http:\/\/localhost:8890\/send/],
    ],
    [
        'DATABASE_URL bukan database dev',
        (m) => gantiTeks(m, 'backend-laravel/.env.example', '/bengkel\n', '/bengkel_lain\n'),
        [/DATABASE_URL harus mysql:\/\/bengkel:bengkel@127.0.0.1:3350\/bengkel/],
    ],
    [
        'PUBLIC_WEB_URL bukan web dev',
        (m) => gantiTeks(m, 'backend-laravel/.env.example', 'PUBLIC_WEB_URL=http://localhost:3800', 'PUBLIC_WEB_URL=https://bengkelku.id'),
        [/PUBLIC_WEB_URL harus http:\/\/localhost:3800/],
    ],
    [
        'VERSION tidak sama dengan versi paket',
        (m) => m.set('VERSION', '9.9.9\n'),
        [/^VERSION: berisi "9\.9\.9", padahal nama paket memakai versi 1\.0\.0$/],
    ],
    [
        'WA_TOKEN beda dengan token WhatsApp palsu',
        (m) => gantiTeks(m, 'backend-laravel/.env.example', TOKEN_WA, 'token-wa-uji-lain-bukan-asli'),
        [/WA_TOKEN tidak sama dengan token bawaan WhatsApp palsu/],
    ],
    [
        'TOKEN_BAWAAN WhatsApp palsu hilang',
        (m) => m.set('tests/wa-palsu/src/server.ts', `${header()}\nexport const x = 1\n`),
        [/TOKEN_BAWAAN tidak ditemukan/],
    ],
    [
        'port bawaan WhatsApp palsu di kode beda dengan yang didokumentasikan',
        (m) => m.set('tests/wa-palsu/src/main.ts', `${header()}\nconst port = Number(process.env.WA_PALSU_PORT ?? 8490)\n`),
        [/^tests\/wa-palsu\/src\/main\.ts: port bawaan WhatsApp palsu 8490, padahal README dan \.env\.example backend memakai 8890$/],
    ],
    [
        'WA_PALSU_PORT di .env.example WhatsApp palsu salah',
        (m) => gantiTeks(m, 'tests/wa-palsu/.env.example', 'WA_PALSU_PORT=8890', 'WA_PALSU_PORT=8490'),
        [/^tests\/wa-palsu\/\.env\.example: WA_PALSU_PORT harus 8890$/],
    ],
    [
        // API_URL web ke port backend lain juga terbaca sebagai rujukan ke backend lain di dokumen.
        'API_URL web ke port lain',
        (m) => gantiTeks(m, 'web/.env.example', 'localhost:8802', 'localhost:8803'),
        [/^web\/\.env\.example: API_URL harus http:\/\/localhost:8802$/, /^web\/\.env\.example:\d+: merujuk port backend NestJS \(8803\)/],
    ],
    [
        // Tautan lacak di nota disusun web dari PUBLIC_WEB_URL miliknya; harus sama dengan backend.
        'PUBLIC_WEB_URL web beda dengan backend',
        (m) => gantiTeks(m, 'web/.env.example', 'PUBLIC_WEB_URL=http://localhost:3800', 'PUBLIC_WEB_URL=http://localhost:3000'),
        [/^web\/\.env\.example: PUBLIC_WEB_URL harus http:\/\/localhost:3800, sama dengan backend/],
    ],
    [
        'PUBLIC_WEB_URL web tidak ada',
        (m) => gantiTeks(m, 'web/.env.example', 'PUBLIC_WEB_URL=http://localhost:3800\n', ''),
        [/^web\/\.env\.example: PUBLIC_WEB_URL harus http:\/\/localhost:3800/],
    ],
]
for (const [nama, ubah, pola] of KONSISTENSI) {
    test(`paket yang tidak saling cocok ditolak: ${nama}`, async () => {
        harapkan(await periksaDengan(ubah), ...pola)
    })
}

test('docker-compose yang masih memuat runner migrate-uji ditolak', async () => {
    const galat = await periksaDengan((m) => {
        const c = m.get('docker-compose.yml').replace('\nvolumes:', '\n  migrate-uji-laravel:\n    image: migrate/migrate\n\nvolumes:')
        m.set('docker-compose.yml', c)
    })
    assert.ok(galat.some((g) => g === 'docker-compose.yml: masih memuat runner migrate-uji-laravel untuk tes kontrak'), galat.join('\n'))
    assert.ok(galat.some((g) => /^docker-compose\.yml:\d+: merujuk runner migrate-uji/.test(g)))
})

test('docker-compose tanpa layanan mysql atau migrate-dev ditolak', async () => {
    const galat = await periksaDengan((m) => m.set('docker-compose.yml', `${header('#')}\nservices:\n  mysql:\n    image: x\n`))
    harapkan(galat, /^docker-compose\.yml: layanan migrate-dev tidak ada$/)
})

test('pembuat database yang membuat database uji ditolak', async () => {
    const galat = await periksaDengan((m) => m.set('db/init/01-buat-database.sql', `${header('--')}\nCREATE DATABASE IF NOT EXISTS bengkel;\nCREATE DATABASE IF NOT EXISTS bengkel_uji_laravel;\n`))
    harapkan(galat, /^db\/init\/01-buat-database\.sql: membuat database bengkel_uji_laravel; paket hanya membutuhkan database bengkel$/)
})

// ---- tautan di README -----------------------------------------------------------------------

test('tautan Markdown relatif yang rusak ditolak dengan berkas dan barisnya', async () => {
    const galat = await periksaDengan((m) => m.set('web/README.md', '# Web\n\nBaca [spesifikasi](../spec/tidak-ada.yaml) dan [bagus](../spec/openapi.yaml).\n'))
    harapkan(galat, /^web\/README\.md:3: tautan "\.\.\/spec\/tidak-ada\.yaml" rusak, spec\/tidak-ada\.yaml tidak ada di paket$/)
})

test('tautan anchor yang judulnya tidak ada ditolak, yang ada diterima', async () => {
    const galat = await periksaDengan((m) =>
        m.set('web/README.md', '# Web\n\n## Produksi: Nginx + PHP-FPM\n\n[a](#produksi-nginx--php-fpm) [b](#tidak-ada) [c](../spec/whatsapp.md#whatsapp) [d](../spec/whatsapp.md#nyasar)\n'),
    )
    harapkan(galat, /^web\/README\.md:5: tautan "#tidak-ada" rusak, judul #tidak-ada tidak ada di web\/README\.md$/, /^web\/README\.md:5: tautan "\.\.\/spec\/whatsapp\.md#nyasar" rusak/)
})

test('tautan ke luar paket ditolak; tautan web, mailto, dan folder yang ada diterima', async () => {
    const galat = await periksaDengan((m) => m.set('web/README.md', '# Web\n[a](../../luar.md) [b](https://contoh.id) [c](mailto:a@b.id) [d](../spec/) [e](/spec/openapi.yaml)\n'))
    harapkan(galat, /^web\/README\.md:2: tautan "\.\.\/\.\.\/luar\.md" keluar dari folder paket$/)
})

test('rujukan jalur dalam tanda kutip balik di README akar yang tidak ada di paket ditolak', async () => {
    const galat = await periksaDengan((m) => m.set('README.md', `${m.get('README.md')}\nBaca \`docs/tidak-ada.md\` dan \`spec/openapi.yaml\`, isi \`web/.env.local\`.\n`))
    harapkan(galat, /^README\.md:\d+: merujuk `docs\/tidak-ada\.md`, yang tidak ada di paket$/)
})

test('rujukan ke docs/panduan diabaikan hanya bila --tanpa-panduan', async () => {
    const ubah = (m) => PANDUAN_WAJIB.forEach((n) => m.delete(`docs/panduan/${n}`))
    assert.ok((await periksaDengan(ubah)).some((g) => g.startsWith(`docs/panduan/${P1}: panduan Word wajib`)))
    assert.deepEqual(await periksaDengan(ubah, { tanpaPanduan: true }), [])
})

test('judul bertanda baca, kode, dan kembar menghasilkan slug gaya GitHub', () => {
    assert.equal(slugJudul('Produksi: Nginx + PHP-FPM'), 'produksi-nginx--php-fpm')
    assert.equal(slugJudul('Env `UPLOAD_DIR` dan [tautan](x)'), 'env-upload_dir-dan-tautan')
    assert.deepEqual([...daftarAnchor('# A\n## A\n```\n# bukan judul\n```\n## B\n')], ['a', 'a-1', 'b'])
})

test('bacaEnv membaca NAMA=nilai, membuang komentar dan kutip', () => {
    const env = bacaEnv('# komentar\nA=1\nB="dua"\n  C = \'tiga\'\nD=\n')
    assert.deepEqual([...env], [['A', '1'], ['B', 'dua'], ['C', 'tiga'], ['D', '']])
})

test('nama paket dan folder akar mengikuti bengkel-<varian>-web-<versi>', () => {
    assert.equal(namaPaket(VARIAN.laravel, '1.2.3', JENIS.web), 'bengkel-laravel-web-1.2.3')
})

test('servers di kontrak API yang menunjuk ke port backend lain ditolak', async () => {
    const galat = await periksaDengan((m) => m.set('spec/openapi.yaml', m.get('spec/openapi.yaml').replace('localhost:8802', 'localhost:8803')))
    harapkan(
        galat,
        /^spec\/openapi\.yaml:6: servers menunjuk port 8803, harus 8802 \(backend varian ini\)$/,
        /^spec\/openapi\.yaml:6: merujuk port backend NestJS \(8803\)/,
    )
})

test('penanda blok internal yang tersisa di paket ditolak, di dokumen maupun di kode', async () => {
    const dokumen = await periksaDengan((m) => m.set('web/README.md', '# Web\n<!-- kemas:abaikan-mulai -->\nx\n'))
    harapkan(dokumen, /^web\/README\.md:2: merujuk penanda blok internal kemas:abaikan/)
})

// ==== khusus produk bengkel: aplikasi staf, AHWS, brand di panduan, berkas yang dibuat pengemas ====

test('paket web yang memuat berkas mobile/ ditolak satu kali per berkas, tanpa memeriksa isinya', async () => {
    const galat = await periksaDengan((m) => {
        m.set('mobile/pubspec.yaml', 'name: bengkel\n')
        m.set('mobile/lib/main.dart', 'void main() {}\n')
    })
    harapkan(galat, /^mobile\/pubspec\.yaml: paket web tidak boleh memuat apa pun di mobile\/$/, /^mobile\/lib\/main\.dart: paket web tidak boleh memuat apa pun di mobile\/$/)
})

for (const [nama, baris] of [
    ['cd mobile', 'Lalu cd mobile dan jalankan.'],
    ['Flutter', 'Aplikasi staf dibuat dengan Flutter.'],
    ['APK', 'Unduh APK-nya.'],
    ['emulator', 'Coba di emulator Android.'],
]) {
    test(`paket web menolak kata aplikasi staf di dokumen: ${nama}`, async () => {
        const galat = await periksaDengan((m) => m.set('web/README.md', `# Web\n${baris}\n`))
        assert.ok(galat.some((g) => g.startsWith('web/README.md:2: merujuk')), galat.join('\n'))
    })
}

test('kata "mobile" sebagai konsep sah, begitu pula panduan Word yang membahas aplikasi HP', async () => {
    const galat = await periksaDengan((m) => {
        m.set('web/README.md', '# Web\nTampilan dibuat mobile first.\n')
        m.set(`docs/panduan/${P1}`, docx('Aplikasi HP (Flutter) dijual sebagai paket lain.'))
    })
    assert.deepEqual(galat, [])
})

test('teks AHWS ditolak di kode, dokumen, README akar, dan LICENSE, dengan nomor barisnya', async () => {
    const galat = await periksaDengan((m) => {
        m.set('web/src/a.ts', `${header()}\n// Warna diambil dari AHWS Racing\nexport const a = 1\n`)
        m.set('web/README.md', '# Web\n\nTema meniru ahws-racing.\n')
        m.set('README.md', `${m.get('README.md')}\nDipakai AHWS Racing Team.\n`)
        m.set('LICENSE', `${m.get('LICENSE')}Untuk AHWS.\n`)
    })
    harapkan(
        galat,
        /^web\/src\/a\.ts:4: memuat nama AHWS/,
        /^web\/README\.md:3: memuat nama AHWS/,
        /^README\.md:\d+: memuat nama AHWS/,
        /^LICENSE:\d+: memuat nama AHWS/,
    )
})

test('nama berkas AHWS dan gambar yang memuat teks AHWS (metadata, SVG) ditolak', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]), Buffer.from('tEXtAuthor\0AHWS Racing Team'), Buffer.from([0, 1, 2])])
    const galat = await periksaDengan((m) => {
        m.set('web/public/logoahws.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]))
        m.set('web/public/hero.png', png)
        m.set('web/src/app/icon.svg', '<svg><title>AHWS</title></svg>\n')
    })
    harapkan(galat, /^web\/public\/logoahws\.png: nama berkas memuat AHWS/, /^web\/public\/hero\.png: memuat nama AHWS/, /^web\/src\/app\/icon\.svg:1: memuat nama AHWS/)
})

test('empat huruf "ahws" di tengah kata atau hash base64 tidak dianggap nama AHWS', async () => {
    const galat = await periksaDengan((m) => {
        m.set('web/package-lock.json', '{"integrity": "sha512-Xk9ahwsQ2+abcAHWSz"}\n')
        m.set('web/public/acak.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0x41, 0x48, 0x57, 0x53, 0x41]))
    })
    assert.deepEqual(galat, [])
})

test('panduan Word yang memuat teks AHWS atau gambar AHWS ditolak', async () => {
    const { sha256 } = await import('../lib/merek.mjs')
    const foto = Buffer.from('foto motor milik situs klien')
    const hashMerek = new Map([[sha256(foto), 'gambar AHWS galeri/motor.jpg']])
    const galat = await periksaDengan(
        (m) => {
            m.set(`docs/panduan/${P1}`, docx('Contoh tampilan seperti AHWS Racing.'))
            m.set(`docs/panduan/${P3}`, docx('Panduan', { 'image1.jpg': foto }))
        },
        { hashMerek },
    )
    harapkan(galat, new RegExp(`${re(P1)}: teks panduan memuat nama AHWS`), new RegExp(`${re(P3)}: gambar word/media/image1\\.jpg sama dengan gambar AHWS galeri/motor\\.jpg`))
})

test('gambar situs klien yang ikut di web ditolak bila folder gambar AHWS diberikan', async () => {
    const { sha256 } = await import('../lib/merek.mjs')
    const foto = Buffer.from('foto galeri klien')
    const hashMerek = new Map([[sha256(foto), 'gambar AHWS galeri/1.jpg']])
    const galat = await periksaDengan((m) => m.set('web/public/galeri.jpg', foto), { hashMerek })
    harapkan(galat, /^web\/public\/galeri\.jpg: isinya sama dengan gambar gambar AHWS galeri\/1\.jpg$/)
})

test('nama dan logo brand toko sah di panduan Word (MEREK_BOLEH_DI_PANDUAN), tetapi tetap ditolak di luar LICENSE, README akar, header, dan panduan', async () => {
    // Keputusan koordinator 2026-11-27: panduan memuat nama dan logo toko di sampul dan kaki
    // halaman, seperti panduan laundry dan kafe-resto. Bila keputusan itu dicabut, tes ini gagal di
    // baris berikut dan perlu ditulis ulang untuk perilaku yang menolak.
    assert.equal(MEREK_BOLEH_DI_PANDUAN, true)
    const { sha256 } = await import('../lib/merek.mjs')
    const logo = Buffer.from('<svg>logo toko</svg>')
    const hashMerek = new Map([[sha256(logo), 'brand kit 01-logo/logo.svg']])
    const panduanBermerek = (m) => {
        m.set(`docs/panduan/${P1}`, docx('Dibeli di KodeCoding. Hubungi idekodecoding@gmail.com'))
        m.set(`docs/panduan/${P3}`, docx('Panduan dari Kode Coding', { 'image9.png': logo }))
    }
    assert.deepEqual(await periksaDengan(panduanBermerek, { hashMerek }), [])

    // Logo yang sama di luar panduan tetap ditolak, begitu pula nama toko di dokumen dan kode lain.
    const galat = await periksaDengan(
        (m) => {
            panduanBermerek(m)
            m.set('web/public/logo.svg', logo)
            m.set('web/README.md', '# Web\n\nDibuat oleh KodeCoding.\n')
            m.set('spec/whatsapp.md', '# WhatsApp\n\nPesan dari Kode Coding.\n')
            m.set('backend-laravel/app/Kode.php', `<?php\n\n${header()}\n// Dibuat oleh KodeCoding\nclass Kode {}\n`)
        },
        { hashMerek },
    )
    harapkan(
        galat,
        /^web\/public\/logo\.svg: isinya sama dengan gambar brand kit 01-logo\/logo\.svg$/,
        /^web\/README\.md:3: memuat nama brand toko/,
        /^spec\/whatsapp\.md:3: memuat nama brand toko/,
        /^backend-laravel\/app\/Kode\.php:\d+: memuat nama brand toko/,
    )
})

test('AHWS tetap ditolak di panduan Word walau nama dan logo brand toko sah di sana', async () => {
    const { sha256 } = await import('../lib/merek.mjs')
    const logo = Buffer.from('<svg>logo toko</svg>')
    const foto = Buffer.from('foto motor klien')
    const hashMerek = new Map([
        [sha256(logo), 'brand kit 01-logo/logo.svg'],
        [sha256(foto), 'gambar AHWS galeri/motor.jpg'],
    ])
    const galat = await periksaDengan(
        (m) => {
            m.set(`docs/panduan/${P1}`, docx('Dibeli di KodeCoding, contoh dari AHWS Racing Team.', { 'image1.png': logo }))
            m.set(`docs/panduan/${P3}`, docx('Panduan dari KodeCoding', { 'image2.png': logo, 'image3.jpg': foto, 'ahws-logo.png': Buffer.from('x') }))
        },
        { hashMerek },
    )
    harapkan(
        galat,
        new RegExp(`^${re(FOLDER_PANDUAN + P1)}: teks panduan memuat nama AHWS`),
        new RegExp(`^${re(FOLDER_PANDUAN + P3)}: gambar word/media/image3\\.jpg sama dengan gambar AHWS galeri/motor\\.jpg$`),
        new RegExp(`^${re(FOLDER_PANDUAN + P3)}: gambar word/media/ahws-logo\\.png memuat nama AHWS$`),
    )
})

test('VERSION wajib ada, web/package-lock.json wajib ikut (npm ci), dan web/README.md wajib ada', async () => {
    harapkan(
        await periksaDengan((m) => m.delete('VERSION')),
        /^VERSION: wajib ada di paket tetapi tidak ditemukan$/,
        /^README\.md:\d+: merujuk `VERSION`, yang tidak ada di paket$/,
    )
    harapkan(await periksaDengan((m) => m.delete('web/package-lock.json')), /^web\/package-lock\.json: wajib ada di paket tetapi tidak ditemukan$/)
    harapkan(await periksaDengan((m) => m.delete('web/README.md')), /^web\/README\.md: wajib ada di paket tetapi tidak ditemukan$/)
})
