// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAKS_ENTRI } from '../lib/aturan.mjs'
import { WAKTU_TETAP, bacaZip, buatZip, waktuPaket } from '../lib/zip.mjs'

const WAKTU = new Date('2026-10-31T05:00:00Z')

const contoh = () => [
    { nama: 'paket/a.txt', isi: Buffer.from('halo dunia '.repeat(100)) },
    { nama: 'paket/b.bin', isi: Buffer.from([1, 2, 3]) },
    { nama: 'paket/kosong.txt', isi: Buffer.alloc(0) },
    { nama: 'paket/backend/skrip.sh', isi: Buffer.from('#!/bin/sh\necho ok\n'), eksekusi: true },
    { nama: 'paket/catatan-ü.md', isi: Buffer.from('nama UTF-8') },
]

test('isi ZIP terbaca kembali sama persis, beserta izin eksekusi dan nama UTF-8', () => {
    const hasil = bacaZip(buatZip(contoh(), WAKTU))
    const urut = contoh().sort((a, b) => (a.nama < b.nama ? -1 : 1))
    assert.deepEqual(hasil.map((e) => e.nama), urut.map((e) => e.nama))
    for (const [i, e] of hasil.entries()) assert.ok(e.isi.equals(urut[i].isi), e.nama)
    const mode = Object.fromEntries(hasil.map((e) => [e.nama, e.mode]))
    assert.equal(mode['paket/backend/skrip.sh'], 0o100755)
    assert.equal(mode['paket/a.txt'], 0o100644)
})

test('masukan yang sama selalu menghasilkan byte yang sama, apa pun urutan masukannya', () => {
    const maju = buatZip(contoh(), WAKTU)
    assert.ok(maju.equals(buatZip(contoh(), WAKTU)))
    assert.ok(maju.equals(buatZip(contoh().reverse(), WAKTU)), 'urutan masukan tidak boleh berpengaruh')
    assert.ok(!maju.equals(buatZip(contoh(), new Date('2026-11-01T05:00:00Z'))), 'waktu berbeda memang menghasilkan ZIP berbeda')
})

test('cap waktu tetap: bawaan 2026-01-01, SOURCE_DATE_EPOCH boleh menggantinya, salah ketik ditolak', () => {
    assert.deepEqual(waktuPaket({}), { waktu: WAKTU_TETAP, asal: 'tanggal tetap 2026-01-01' })
    assert.equal(waktuPaket({ SOURCE_DATE_EPOCH: '1767225600' }).waktu.toISOString(), '2026-01-01T00:00:00.000Z')
    assert.throws(() => waktuPaket({ SOURCE_DATE_EPOCH: 'kemarin' }), /detik Unix/)
    assert.throws(() => buatZip(contoh(), new Date('1970-01-01T00:00:00Z')), /di luar jangkauan/)
})

test('berkas dikompres hanya bila hasilnya lebih kecil', () => {
    const zip = buatZip(contoh(), WAKTU)
    assert.equal(zip.readUInt16LE(8), 8, 'berkas pertama (a.txt) berisi teks berulang, jadi memakai deflate')
    const satu = buatZip([{ nama: 'b.bin', isi: Buffer.from([1, 2, 3]) }], WAKTU)
    assert.equal(satu.readUInt16LE(8), 0, 'tiga byte acak disimpan apa adanya')
})

test('menolak paket yang melebihi batas entri toko dan nama berkas ganda', () => {
    const banyak = Array.from({ length: MAKS_ENTRI + 1 }, (_, i) => ({ nama: `f${i}`, isi: Buffer.alloc(0) }))
    assert.throws(() => buatZip(banyak, WAKTU), /melebihi batas/)
    assert.throws(() => buatZip([{ nama: 'a', isi: Buffer.alloc(0) }, { nama: 'a', isi: Buffer.alloc(1) }], WAKTU), /Nama berkas ganda/)
})

test('pembaca menolak byte sisa setelah record akhir', () => {
    const zip = Buffer.concat([buatZip(contoh(), WAKTU), Buffer.from([0])])
    assert.throws(() => bacaZip(zip), /Record akhir ZIP tidak ditemukan/)
})

test('pembaca menolak isi berkas yang rusak', () => {
    const zip = buatZip([{ nama: 'b.bin', isi: Buffer.from([1, 2, 3]) }], WAKTU)
    zip[30 + 'b.bin'.length] ^= 0xff
    assert.throws(() => bacaZip(zip), /CRC atau ukuran tidak cocok/)
})

test('pembaca menolak ZIP multi-disk', () => {
    const zip = buatZip(contoh(), WAKTU)
    zip.writeUInt16LE(1, zip.length - 22 + 4)
    assert.throws(() => bacaZip(zip), /multi-disk/)
})

test('entri folder (nama berakhiran /) dilewati pembaca', () => {
    const hasil = bacaZip(buatZip([{ nama: 'paket/', isi: Buffer.alloc(0) }, { nama: 'paket/a.txt', isi: Buffer.from('a') }], WAKTU))
    assert.deepEqual(hasil.map((e) => e.nama), ['paket/a.txt'])
})
