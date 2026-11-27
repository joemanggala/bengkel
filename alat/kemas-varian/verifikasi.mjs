// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Verifikasi paket jadi seperti di tangan pembeli: ZIP dibaca Python zipfile, diekstrak ke folder
// sementara (di luar repo, jadi tidak ada node_modules, vendor, atau .env milik repo yang
// terbawa), lalu dari hasil ekstrak dijalankan tes unit backend, typecheck + test + build web, dan
// tes WhatsApp palsu. Semua dependensi dipasang dari lockfile di dalam paket (composer install,
// npm ci), jadi lockfile yang tertinggal atau berkas yang lupa ikut langsung ketahuan.
//
//   node alat/kemas-varian/verifikasi.mjs dist/paket/bengkel-laravel-web-0.1.0.zip [--folder=<tempat ekstrak>] [--simpan]
//
// Butuh Python 3, PHP 8.4 + Composer 2, dan Node.js. Tanpa --simpan, folder ekstrak dihapus bila
// semua langkah lolos (dibiarkan bila ada yang gagal, untuk diperiksa).

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { bacaNamaPaket } from './lib/aturan.mjs'
import { bacaZip } from './lib/zip.mjs'

const WINDOWS = process.platform === 'win32'

// Python zipfile: daftar isi, CRC semua berkas (testzip), dan tidak ada nama berkas ganda.
const SKRIP_PYTHON = [
    'import sys, zipfile',
    'z = zipfile.ZipFile(sys.argv[1])',
    'rusak = z.testzip()',
    'nama = z.namelist()',
    'assert rusak is None, "CRC rusak: " + str(rusak)',
    'assert len(nama) == len(set(nama)), "nama berkas ganda"',
    'print(len(nama), "berkas, CRC cocok")',
].join('\n')

// npm dan composer di Windows berupa .cmd/.bat, yang hanya bisa dijalankan lewat shell; argumennya
// di sini tidak pernah berisi spasi. Python dijalankan langsung (tanpa shell) karena argumennya
// berupa jalur berkas.
function jalankan(judul, perintah, args, cwd, { shell = WINDOWS } = {}) {
    console.log(`\n== ${judul}\n   ${perintah} ${args.join(' ')}  (di ${cwd})`)
    const mulai = Date.now()
    const hasil = spawnSync(perintah, args, { cwd, stdio: 'inherit', shell, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', CI: '1' } })
    const detik = ((Date.now() - mulai) / 1000).toFixed(1)
    const lolos = hasil.status === 0
    console.log(`   ${lolos ? 'lolos' : `GAGAL (kode ${hasil.status ?? hasil.error?.message})`} dalam ${detik} detik`)
    return { judul, lolos }
}

// Ekstrak ZIP dengan pembaca alat ini (sudah memeriksa CRC dan nama yang tidak aman), lalu
// pulihkan izin eksekusi supaya artisan dan skrip .sh bisa dijalankan di Linux/macOS.
function ekstrak(zip, tujuan) {
    for (const e of bacaZip(readFileSync(zip))) {
        const lengkap = join(tujuan, e.nama)
        mkdirSync(dirname(lengkap), { recursive: true })
        writeFileSync(lengkap, e.isi, { mode: e.mode & 0o777 })
    }
}

function utama() {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { folder: { type: 'string' }, simpan: { type: 'boolean' } } })
    if (positionals.length !== 1) {
        console.error('Pemakaian: node alat/kemas-varian/verifikasi.mjs <paket.zip> [--folder=<tempat ekstrak>] [--simpan]')
        return 2
    }
    const zip = resolve(positionals[0])
    const paket = bacaNamaPaket(basename(zip, '.zip'))
    if (!paket) {
        console.error(`${basename(zip)} bukan bengkel-<varian>-web-<versi>.zip`)
        return 2
    }
    const tempat = values.folder ? resolve(values.folder) : mkdtempSync(join(tmpdir(), 'verifikasi-paket-'))
    mkdirSync(tempat, { recursive: true })
    const akar = join(tempat, basename(zip, '.zip'))
    if (existsSync(akar)) rmSync(akar, { recursive: true, force: true })
    console.log(`verifikasi ${basename(zip)} di ${tempat}`)

    // Skrip Python ditulis di folder sementara dan dijalankan dengan -I, supaya tidak memuat modul
    // dari folder kerja.
    const skrip = join(tempat, 'periksa-zip.py')
    writeFileSync(skrip, SKRIP_PYTHON)
    const hasil = [jalankan('Python zipfile', WINDOWS ? 'python' : 'python3', ['-I', skrip, zip], tempat, { shell: false })]
    ekstrak(zip, tempat)
    if (!existsSync(join(akar, 'LICENSE'))) {
        console.error(`isi ZIP tidak berada di folder ${basename(akar)}/`)
        return 1
    }

    const backend = join(akar, paket.varian.folder)
    const web = join(akar, 'web')
    const wa = join(akar, 'tests', 'wa-palsu')
    hasil.push(
        jalankan('backend: composer install', 'composer', ['install', '--no-interaction', '--no-progress'], backend),
        jalankan('backend: tes unit', 'composer', ['test'], backend),
        jalankan('web: npm ci', 'npm', ['ci', '--no-audit', '--no-fund'], web),
        jalankan('web: typecheck', 'npm', ['run', 'typecheck'], web),
        jalankan('web: test', 'npm', ['test'], web),
        jalankan('web: build', 'npm', ['run', 'build'], web),
        jalankan('WhatsApp palsu: npm ci', 'npm', ['ci', '--no-audit', '--no-fund'], wa),
        jalankan('WhatsApp palsu: typecheck', 'npm', ['run', 'typecheck'], wa),
        jalankan('WhatsApp palsu: test', 'npm', ['test'], wa),
    )

    console.log('\nRingkasan:')
    for (const h of hasil) console.log(`  ${h.lolos ? 'lolos' : 'GAGAL'}  ${h.judul}`)
    const gagal = hasil.filter((h) => !h.lolos).length
    if (gagal === 0 && !values.simpan && !values.folder) rmSync(tempat, { recursive: true, force: true })
    else console.log(`folder ekstrak dibiarkan di ${tempat}`)
    return gagal > 0 ? 1 : 0
}

process.exitCode = utama()
