// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Penulis dan pembaca ZIP tanpa dependensi. Penulisnya sengaja sederhana: tanpa ZIP64, karena
// toko menolak ZIP64 saat versi produk diunggah, dan paket bengkel jauh di bawah 4 GiB dan 65.534
// berkas. Dua kali bangun dari isi yang sama harus menghasilkan byte yang sama, jadi tidak ada
// yang bergantung pada jam, urutan sistem berkas, atau izin berkas di mesin pembangun.

import { createHash } from 'node:crypto'
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib'
import { MAKS_ENTRI } from './aturan.mjs'

const TANDA_LOKAL = 0x04034b50
const TANDA_PUSAT = 0x02014b50
const TANDA_AKHIR = 0x06054b50
const FLAG_UTF8 = 0x0800
// Pembuat "Unix" supaya izin berkas (skrip .sh dan artisan yang bisa dijalankan) ikut terbawa
// saat diekstrak di Linux dan macOS.
const PEMBUAT_UNIX = (3 << 8) | 20

// Cap waktu semua berkas. Tanggal tetap, bukan waktu commit atau jam saat ini, supaya paket dari
// isi yang sama selalu identik walau dibangun di hari lain atau dari commit lain. SOURCE_DATE_EPOCH
// (konvensi build yang bisa diulang) boleh menggantinya.
export const WAKTU_TETAP = new Date('2026-01-01T00:00:00Z')

export function waktuPaket(env = process.env) {
    const epoch = env.SOURCE_DATE_EPOCH?.trim()
    if (!epoch) return { waktu: WAKTU_TETAP, asal: 'tanggal tetap 2026-01-01' }
    if (!/^\d+$/.test(epoch)) throw new Error('SOURCE_DATE_EPOCH harus detik Unix')
    return { waktu: new Date(Number(epoch) * 1000), asal: 'SOURCE_DATE_EPOCH' }
}

function waktuDos(tanggal) {
    const tahun = tanggal.getUTCFullYear()
    if (tahun < 1980 || tahun > 2107) throw new Error('Waktu berkas di luar jangkauan format ZIP (1980-2107)')
    return {
        jam: (tanggal.getUTCHours() << 11) | (tanggal.getUTCMinutes() << 5) | Math.floor(tanggal.getUTCSeconds() / 2),
        tgl: ((tahun - 1980) << 9) | ((tanggal.getUTCMonth() + 1) << 5) | tanggal.getUTCDate(),
    }
}

// entri: [{ nama, isi: Buffer, eksekusi?: boolean }]. Diurutkan di sini berdasarkan nama (urutan
// unit kode, bukan urutan lokal mesin), sehingga urutan masukan tidak memengaruhi hasil.
export function buatZip(entri, waktu = WAKTU_TETAP) {
    if (entri.length > MAKS_ENTRI) {
        throw new Error(`Paket berisi ${entri.length} berkas, melebihi batas ${MAKS_ENTRI}`)
    }
    const urut = [...entri].sort((a, b) => (a.nama < b.nama ? -1 : a.nama > b.nama ? 1 : 0))
    for (let i = 1; i < urut.length; i++) {
        if (urut[i].nama === urut[i - 1].nama) throw new Error(`Nama berkas ganda di ZIP: ${urut[i].nama}`)
    }
    const dos = waktuDos(waktu)
    const lokal = []
    const pusat = []
    let offset = 0
    for (const e of urut) {
        const nama = Buffer.from(e.nama, 'utf8')
        const kompres = deflateRawSync(e.isi, { level: 9 })
        const deflate = kompres.length < e.isi.length
        const data = deflate ? kompres : e.isi
        const crc = crc32(e.isi)

        const kepala = Buffer.alloc(30)
        kepala.writeUInt32LE(TANDA_LOKAL, 0)
        kepala.writeUInt16LE(20, 4)
        kepala.writeUInt16LE(FLAG_UTF8, 6)
        kepala.writeUInt16LE(deflate ? 8 : 0, 8)
        kepala.writeUInt16LE(dos.jam, 10)
        kepala.writeUInt16LE(dos.tgl, 12)
        kepala.writeUInt32LE(crc, 14)
        kepala.writeUInt32LE(data.length, 18)
        kepala.writeUInt32LE(e.isi.length, 22)
        kepala.writeUInt16LE(nama.length, 26)
        lokal.push(kepala, nama, data)

        const rekam = Buffer.alloc(46)
        rekam.writeUInt32LE(TANDA_PUSAT, 0)
        rekam.writeUInt16LE(PEMBUAT_UNIX, 4)
        rekam.writeUInt16LE(20, 6)
        rekam.writeUInt16LE(FLAG_UTF8, 8)
        rekam.writeUInt16LE(deflate ? 8 : 0, 10)
        rekam.writeUInt16LE(dos.jam, 12)
        rekam.writeUInt16LE(dos.tgl, 14)
        rekam.writeUInt32LE(crc, 16)
        rekam.writeUInt32LE(data.length, 20)
        rekam.writeUInt32LE(e.isi.length, 24)
        rekam.writeUInt16LE(nama.length, 28)
        rekam.writeUInt32LE(((e.eksekusi ? 0o100755 : 0o100644) << 16) >>> 0, 38)
        rekam.writeUInt32LE(offset, 42)
        pusat.push(rekam, nama)

        offset += 30 + nama.length + data.length
        if (offset >= 0xffffffff) throw new Error('Paket melebihi 4 GiB; ZIP64 tidak didukung')
    }
    const ukuranPusat = pusat.reduce((n, b) => n + b.length, 0)
    const akhir = Buffer.alloc(22)
    akhir.writeUInt32LE(TANDA_AKHIR, 0)
    akhir.writeUInt16LE(urut.length, 8)
    akhir.writeUInt16LE(urut.length, 10)
    akhir.writeUInt32LE(ukuranPusat, 12)
    akhir.writeUInt32LE(offset, 16)
    return Buffer.concat([...lokal, ...pusat, akhir])
}

// Membaca ZIP dengan aturan yang sama dengan toko saat versi diunggah, lalu membuka setiap
// berkas dan mencocokkan CRC-nya. Melempar galat bila ada yang tidak sah. Entri folder (nama
// berakhiran "/") dilewati karena tidak punya isi.
export function bacaZip(buf) {
    const ukuran = buf.length
    let p = -1
    for (let i = ukuran - 22; i >= Math.max(0, ukuran - 65_557); i--) {
        if (buf.readUInt32LE(i) === TANDA_AKHIR && i + 22 + buf.readUInt16LE(i + 20) === ukuran) {
            p = i
            break
        }
    }
    if (p < 0) throw new Error('Record akhir ZIP tidak ditemukan')
    const jumlah = buf.readUInt16LE(p + 10)
    const ukuranPusat = buf.readUInt32LE(p + 12)
    const offsetPusat = buf.readUInt32LE(p + 16)
    if (buf.readUInt16LE(p + 4) !== 0 || buf.readUInt16LE(p + 6) !== 0 || buf.readUInt16LE(p + 8) !== jumlah) {
        throw new Error('ZIP multi-disk tidak didukung')
    }
    if (jumlah > MAKS_ENTRI || offsetPusat + ukuranPusat !== p) {
        throw new Error('Struktur direktori pusat ZIP tidak sesuai aturan toko')
    }
    const entri = []
    let i = offsetPusat
    let total = 0
    while (i < p) {
        if (buf.readUInt32LE(i) !== TANDA_PUSAT) throw new Error(`Record direktori rusak di ${i}`)
        const metode = buf.readUInt16LE(i + 10)
        const crc = buf.readUInt32LE(i + 16)
        const ukuranData = buf.readUInt32LE(i + 20)
        const ukuranAsli = buf.readUInt32LE(i + 24)
        const n = buf.readUInt16LE(i + 28)
        const m = buf.readUInt16LE(i + 30)
        const k = buf.readUInt16LE(i + 32)
        const mode = buf.readUInt32LE(i + 38) >>> 16
        const offsetLokal = buf.readUInt32LE(i + 42)
        const nama = buf.toString('utf8', i + 46, i + 46 + n)
        i += 46 + n + m + k
        total++
        if (nama.endsWith('/')) continue
        const mulaiData = offsetLokal + 30 + buf.readUInt16LE(offsetLokal + 26) + buf.readUInt16LE(offsetLokal + 28)
        const data = buf.subarray(mulaiData, mulaiData + ukuranData)
        const isi = metode === 8 ? inflateRawSync(data) : metode === 0 ? Buffer.from(data) : null
        if (!isi) throw new Error(`${nama}: metode kompresi ${metode} tidak dikenal`)
        if (isi.length !== ukuranAsli || crc32(isi) !== crc) throw new Error(`${nama}: CRC atau ukuran tidak cocok`)
        entri.push({ nama, isi, mode, sha256: createHash('sha256').update(isi).digest('hex') })
    }
    if (total !== jumlah) throw new Error('Jumlah entri ZIP tidak cocok')
    return entri
}
