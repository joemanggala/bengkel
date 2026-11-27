// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pembantu bersama semua tes: paket sah di memori, repo git sementara, dan pembanding galat.
// Tidak ada tes yang menyentuh repo ini; semua repo dibuat di folder sementara.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATABASE_URL_DEV, JENIS, PANDUAN_WAJIB, PORT_WA_PALSU, PUBLIC_WEB_URL_DEV, VARIAN, WA_API_URL_DEV, namaPaket } from '../lib/aturan.mjs'
import { muatTemplat } from '../lib/bangun.mjs'
import { isiTemplat, nilaiTemplat } from '../lib/ubah.mjs'
import { buatZip } from '../lib/zip.mjs'

export const FOLDER_ALAT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const TEMPLAT = muatTemplat(join(FOLDER_ALAT, 'templat'))
export const LARAVEL = VARIAN.laravel
export const WEB = JENIS.web

export const TOKEN_WA = 'token-wa-uji-bengkel-bukan-kunci-asli'
const H1 = 'Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.'
const H2 = 'Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.'

// Header dua baris dengan penanda komentar tertentu: '//', '#', '--'.
export const header = (penanda = '//') => `${penanda} ${H1}\n${penanda} ${H2}\n`

const LISENSI = 'Hak Cipta (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>\nSource code ini BUKAN perangkat lunak sumber terbuka. Dilarang menjual ulang atau membagikan.\n'

// Berkas .docx minimal yang lolos pemeriksa: ZIP berisi [Content_Types].xml dan word/document.xml,
// ditambah gambar di word/media bila diberikan.
export function docx(teks = 'Panduan', media = {}) {
    const isi = (nama, s) => ({ nama, isi: Buffer.isBuffer(s) ? s : Buffer.from(s) })
    return buatZip([
        isi('[Content_Types].xml', '<Types/>'),
        isi('word/document.xml', `<w:document><w:body><w:p><w:r><w:t>${teks}</w:t></w:r></w:p></w:body></w:document>`),
        ...Object.entries(media).map(([nama, buf]) => isi(`word/media/${nama}`, buf)),
    ])
}

// .env.example backend yang sah: port varian, WhatsApp palsu, MySQL dari compose, web dev.
export const envBackend = (varian = LARAVEL) =>
    `${header('#')}\nPORT=${varian.port}\nDATABASE_URL=${DATABASE_URL_DEV}\nSETUP_TOKEN=\nWA_API_URL=${WA_API_URL_DEV}\nWA_TOKEN=${TOKEN_WA}\nPUBLIC_WEB_URL=${PUBLIC_WEB_URL_DEV}\n`

// Isi paket yang sah: path → string atau Buffer. README, panduan menjalankan, compose, pembuat
// database, dan .gitignore dirender dari templat/ yang asli, sehingga tes ini sekaligus
// membuktikan templat lolos pemeriksa.
export function isiPaketSah(varian = LARAVEL, versi = '1.0.0', jenis = WEB) {
    const nilai = nilaiTemplat(varian, versi, jenis)
    const m = new Map()
    for (const [tujuan, teks] of Object.entries(TEMPLAT)) m.set(tujuan, isiTemplat(teks, nilai, tujuan))
    m.set('LICENSE', LISENSI)
    m.set('VERSION', `${versi}\n`)
    m.set(`${varian.folder}/README.md`, '# Backend\n\nKontrak API ada di [spec](../spec/openapi.yaml).\n')
    m.set(`${varian.folder}/.env.example`, envBackend(varian))
    m.set(`${varian.folder}/${varian.manifes}`, '{}\n')
    m.set(`${varian.folder}/artisan`, `#!/usr/bin/env php\n<?php\n\n${header()}\n`)
    m.set(`${varian.folder}/app/Kode.php`, `<?php\n\n${header()}\nclass Kode {}\n`)
    m.set('web/package.json', '{}\n')
    m.set('web/package-lock.json', '{}\n')
    m.set('web/.env.example', `${header('#')}\nAPI_URL=http://localhost:${varian.port}\nPUBLIC_WEB_URL=${PUBLIC_WEB_URL_DEV}\nCOOKIE_SECURE=\n`)
    m.set('web/README.md', '# Web\n\nKontrak API ada di [spec](../spec/openapi.yaml).\n')
    m.set('web/src/app/page.tsx', `${header()}\nexport default function Halaman() { return null }\n`)
    m.set('spec/openapi.yaml', `${header('#')}\nopenapi: 3.1.0\nservers:\n  - url: http://localhost:${varian.port}\n    description: Backend (alamat dev bawaan)\n`)
    m.set('spec/whatsapp.md', '# WhatsApp\n')
    m.set('db/migrations/000001_awal.up.sql', `${header('--')}\nSELECT 1;\n`)
    m.set('db/tanpa-docker.sql', `${header('--')}\nCREATE DATABASE IF NOT EXISTS bengkel;\n`)
    m.set('tests/wa-palsu/package.json', '{}\n')
    m.set('tests/wa-palsu/src/server.ts', `${header()}\nexport const TOKEN_BAWAAN = '${TOKEN_WA}'\n`)
    m.set('tests/wa-palsu/src/main.ts', `${header()}\nconst port = Number(process.env.WA_PALSU_PORT ?? ${PORT_WA_PALSU})\n`)
    m.set('tests/wa-palsu/.env.example', `${header('#')}\nWA_PALSU_PORT=${PORT_WA_PALSU}\nWA_TOKEN=${TOKEN_WA}\n`)
    for (const nama of PANDUAN_WAJIB) m.set(`docs/panduan/${nama}`, docx())
    return m
}

const sidik = (isi) => createHash('sha256').update(isi).digest('hex')

// Isi paket (Map) menjadi entri seperti hasil bacaZip.
export function jadikanEntri(isi, varian = LARAVEL, versi = '1.0.0', jenis = WEB) {
    const akar = namaPaket(varian, versi, jenis)
    return [...isi].map(([path, nilai]) => {
        const buf = Buffer.isBuffer(nilai) ? nilai : Buffer.from(nilai)
        return { nama: `${akar}/${path}`, isi: buf, mode: 0o100644, sha256: sidik(buf) }
    })
}

// Menjalankan pemeriksa atas Map setelah diubah oleh `ubah`; hasilnya larik galat.
export async function periksaDengan(ubah, { varian = LARAVEL, versi = '1.0.0', jenis = WEB, ...opsi } = {}) {
    const { periksaPaket } = await import('../lib/periksa.mjs')
    const isi = isiPaketSah(varian, versi, jenis)
    ubah?.(isi)
    return periksaPaket(jadikanEntri(isi, varian, versi, jenis), { varian, versi, jenis, ...opsi })
}

// Galat harus persis sebanyak pola yang diberikan, dan setiap pola cocok dengan satu galat
// berbeda. Dengan begitu satu pelanggaran tidak boleh diam-diam memicu galat lain.
export function harapkan(galat, ...pola) {
    const sisa = [...galat]
    for (const p of pola) {
        const i = sisa.findIndex((g) => p.test(g))
        assert.ok(i >= 0, `tidak ada galat yang cocok dengan ${p}; galat: ${JSON.stringify(galat, null, 2)}`)
        sisa.splice(i, 1)
    }
    assert.deepEqual(sisa, [], 'ada galat lain yang tidak diharapkan')
}

// ---- repo git sementara ---------------------------------------------------------------------

export function folderSementara(awalan = 'kemas-tes-') {
    return mkdtempSync(join(tmpdir(), awalan))
}

export const hapus = (folder) => rmSync(folder, { recursive: true, force: true })

export function git(folder, ...args) {
    return execFileSync('git', args, { cwd: folder, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

export function tulis(folder, berkas) {
    for (const [path, isi] of Object.entries(berkas)) {
        const lengkap = join(folder, path)
        mkdirSync(dirname(lengkap), { recursive: true })
        writeFileSync(lengkap, isi)
    }
}

// Repo git sementara yang mirip repo asli: backend Laravel, web, spec, db, wa-palsu, dan banyak
// berkas yang TIDAK boleh ikut paket (tes kontrak, E2E, alat, catatan internal, skrip uji, hasil
// build, rahasia, folder backend lain). Tidak ada git add maupun commit; semua berkas berstatus
// belum dilacak.
export function buatRepoFixture(tambahan = {}) {
    const folder = folderSementara('kemas-repo-')
    git(folder, 'init', '-q')
    const v = LARAVEL
    const berkas = {
        '.gitignore': 'node_modules/\nvendor/\n.env\n.env.*\n!.env.example\ndist/\n.next/\n.bangun/\n',
        LICENSE: LISENSI,
        VERSION: '0.3.0\n',
        'README.md': '# Repo pengembang\n\nLihat docs/rancangan.md dan tests/kontrak.\n',
        'docker-compose.yml': `${TEMPLAT['docker-compose.yml']}\n  migrate-uji-laravel:\n    image: migrate/migrate:v4.20.1\n`,
        'db/init/01-buat-database.sql': `${header('--')}\nCREATE DATABASE bengkel;\nCREATE DATABASE bengkel_uji_laravel;\n`,
        'db/migrations/000001_awal.up.sql': `${header('--')}\nSELECT 1;\n`,
        'db/migrations/000001_awal.down.sql': `${header('--')}\nSELECT 2;\n`,
        'db/tanpa-docker.sql': `${header('--')}\nCREATE DATABASE IF NOT EXISTS bengkel;\n`,
        'docs/menjalankan.md': '# Menjalankan\n\nJalankan tests/kontrak.\n',
        'docs/rancangan.md': '# Rancangan\n',
        'docs/eksekusi/aturan.md': '# Catatan internal\n',
        'alat/kemas-varian/kemas.mjs': `${header()}\n`,
        'alat/panduan-word/buat.js': `${header()}\n`,
        'spec/openapi.yaml': `${header('#')}\nopenapi: 3.1.0\nservers:\n  - url: http://localhost:8802\n    description: Backend (alamat dev bawaan)\n`,
        'spec/whatsapp.md': '# WhatsApp\n',
        'spec/redocly.yaml': `${header('#')}\nextends: []\n`,
        'tests/kontrak/package.json': '{}\n',
        'tests/e2e/package.json': '{}\n',
        'tests/e2e/.bangun/log/web.log': 'log',
        'tests/wa-palsu/package.json': '{}\n',
        'tests/wa-palsu/src/server.ts': `${header()}\nexport const TOKEN_BAWAAN = '${TOKEN_WA}'\n`,
        'tests/wa-palsu/src/main.ts': `${header()}\nconst port = Number(process.env.WA_PALSU_PORT ?? ${PORT_WA_PALSU})\n`,
        'tests/wa-palsu/.env.example': `${header('#')}\nWA_PALSU_PORT=${PORT_WA_PALSU}\nWA_TOKEN=${TOKEN_WA}\n`,
        'tests/wa-palsu/node_modules/x/index.js': 'x',
        'web/package.json': '{}\n',
        'web/package-lock.json': '{}\n',
        'web/.env.example': `${header('#')}\nAPI_URL=http://localhost:8802\nPUBLIC_WEB_URL=${PUBLIC_WEB_URL_DEV}\nCOOKIE_SECURE=\n`,
        'web/README.md': '# Web\n\nKontrak API ada di [spec](../spec/openapi.yaml).\n',
        'web/.env.local': 'API_URL=http://rahasia.example.com\n',
        'web/src/app/page.tsx': `${header()}\nexport default function Halaman() { return null }\n`,
        'web/.next/server.js': 'x',
        '.claude/settings.json': '{}\n',
        [`${v.folder}/README.md`]: '# Backend Laravel\n\nKontrak API ada di [spec](../spec/openapi.yaml).\n',
        [`${v.folder}/.env.example`]: envBackend(v),
        [`${v.folder}/.env`]: 'SETUP_TOKEN=rahasia-sungguhan-1234567890\n',
        [`${v.folder}/${v.manifes}`]: '{}\n',
        [`${v.folder}/artisan`]: `#!/usr/bin/env php\n<?php\n\n${header()}\n`,
        [`${v.folder}/app/Kode.php`]: `<?php\n\n${header()}\nclass Kode {}\n`,
        [`${v.folder}/bin/api.exe`]: 'exe',
        [`${v.folder}/scripts/uji-kontrak.sh`]: `#!/usr/bin/env bash\n${header('#')}\ncd ../tests/kontrak\n`,
        [`${v.folder}/scripts/uji-serentak.sh`]: `#!/usr/bin/env bash\n${header('#')}\ncd ../tests/kontrak\n`,
        [`${v.folder}/vendor/paket/a.php`]: '<?php',
        [`${v.folder}/storage/logs/laravel.log`]: 'log',
        // Backend lain yang kelak ada di repo tidak boleh ikut paket Laravel.
        'backend-go/go.mod': 'module bengkel\n',
    }
    tulis(folder, { ...berkas, ...tambahan })
    return folder
}

// Empat panduan Word sah untuk repo fixture.
export const berkasPanduan = () => Object.fromEntries(PANDUAN_WAJIB.map((n) => [`docs/panduan/${n}`, docx()]))
