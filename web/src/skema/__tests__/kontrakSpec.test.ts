// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DAFTAR_SPK_CONTOH, OUTLET_CONTOH, SPK_CONTOH } from '@/constants/contoh'
import { PESAN_BAKU } from '@/utils/galat'
import { LABEL_STATUS_BOOKING, STATUS_BOOKING } from '../booking'
import { KODE_FIELD, KODE_GALAT } from '../galat'
import { skemaOutlet } from '../outlet'
import { JENIS_KENDARAAN, LABEL_JENIS_KENDARAAN } from '../pelanggan'
import {
    JENIS_PERGERAKAN,
    LABEL_JENIS_PERGERAKAN,
    LABEL_LEVEL_STOK,
    LEVEL_STOK,
} from '../sparepart'
import {
    JENIS_ITEM,
    JENIS_PESAN_WA_SPK,
    LABEL_JENIS_ITEM,
    LABEL_JENIS_PESAN_WA_SPK,
    LABEL_METODE_BAYAR,
    LABEL_STATUS_BAYAR,
    LABEL_STATUS_SPK,
    METODE_BAYAR,
    STATUS_BAYAR,
    STATUS_SPK,
    skemaSpkDetail,
    skemaSpkRingkas,
} from '../spk'
import { LABEL_PERAN, PERAN_STAF } from '../staf'

// Tes penjaga kontrak: teks dan daftar yang disalin tangan ke kode web dibandingkan langsung
// dengan spec/components/schemas/*.yaml, supaya perubahan spec yang tidak diikuti web langsung
// terlihat. Spec adalah satu-satunya sumber kebenaran bentuk API. Folder spec/ ada di akar repo
// (di luar web/), jadi bila web dipakai sendirian tanpa spec, tes ini dilewati.
const FOLDER_SKEMA = path.resolve(import.meta.dirname, '../../../../spec/components/schemas')
const adaSpec = existsSync(path.join(FOLDER_SKEMA, 'umum.yaml'))

const baca = (berkas: string): string => readFileSync(path.join(FOLDER_SKEMA, berkas), 'utf8')

// Isi satu blok YAML tingkat atas (baris "Nama:" di kolom 0 sampai blok berikutnya).
function blok(yaml: string, nama: string): string[] {
    const baris = yaml.split(/\r?\n/)
    const awal = baris.findIndex((b) => b === `${nama}:`)
    if (awal < 0) throw new Error(`Blok ${nama} tidak ada di spec`)
    const akhir = baris.findIndex((b, i) => i > awal && /^[A-Za-z]/.test(b))
    return baris.slice(awal + 1, akhir < 0 ? undefined : akhir)
}

// Pasangan "    kunci: nilai" (indentasi 4 spasi) tepat di bawah baris "  penanda:".
function peta(isiBlok: string[], penanda: string): Record<string, string> {
    const awal = isiBlok.findIndex((b) => b === `  ${penanda}:`)
    if (awal < 0) throw new Error(`${penanda} tidak ada di blok`)
    const hasil: Record<string, string> = {}
    for (const b of isiBlok.slice(awal + 1)) {
        const cocok = /^ {4}([A-Za-z_]+): (.*)$/.exec(b)
        if (!cocok) break
        hasil[cocok[1]] = cocok[2].trim()
    }
    return hasil
}

// Daftar "    - nilai" di bawah "  enum:" atau bentuk sebaris "  enum: [a, b]".
function daftarEnum(isiBlok: string[]): string[] {
    const sebaris = isiBlok.map((b) => /^ {2}enum: \[(.*)\]$/.exec(b)).find(Boolean)
    if (sebaris) return sebaris[1].split(',').map((s) => s.trim())
    const awal = isiBlok.findIndex((b) => b === '  enum:')
    if (awal < 0) throw new Error('enum tidak ada di blok')
    const hasil: string[] = []
    for (const b of isiBlok.slice(awal + 1)) {
        const cocok = /^ {4}- (.+)$/.exec(b)
        if (!cocok) break
        hasil.push(cocok[1].trim())
    }
    return hasil
}

describe.skipIf(!adaSpec)('kode galat dan pesan baku sama dengan spec/umum.yaml', () => {
    const umum = baca('umum.yaml')

    it('daftar KodeGalat sama persis dengan enum spec', () => {
        expect([...KODE_GALAT]).toEqual(daftarEnum(blok(umum, 'KodeGalat')))
    })

    it('daftar KodeField sama persis dengan enum spec', () => {
        expect([...KODE_FIELD]).toEqual(daftarEnum(blok(umum, 'KodeField')))
    })

    it('pesan baku setiap kode sama huruf demi huruf dengan x-pesan-baku', () => {
        const baku = peta(blok(umum, 'KodeGalat'), 'x-pesan-baku')
        expect(Object.keys(baku).length).toBeGreaterThan(20)
        for (const [kode, pesan] of Object.entries(baku)) {
            expect(PESAN_BAKU[kode as keyof typeof PESAN_BAKU], kode).toBe(pesan)
        }
        // Pesan stok kurang dinamis (memuat nama sparepart), jadi tidak punya pesan baku.
        expect(baku).not.toHaveProperty('insufficient_stock')
        expect(baku).not.toHaveProperty('not_found')
    })
})

describe.skipIf(!adaSpec)('enum dan label sama dengan spec', () => {
    const cek = (
        berkas: string,
        nama: string,
        enumKode: readonly string[],
        label: Record<string, string>,
    ) => {
        const isi = blok(baca(berkas), nama)
        expect([...enumKode], `enum ${nama}`).toEqual(daftarEnum(isi))
        expect(label, `x-label ${nama}`).toEqual(peta(isi, 'x-label'))
    }

    it('PeranStaf', () => cek('staf.yaml', 'PeranStaf', PERAN_STAF, LABEL_PERAN))
    it('StatusSpk', () => cek('spk.yaml', 'StatusSpk', STATUS_SPK, LABEL_STATUS_SPK))
    it('StatusBayar', () => cek('spk.yaml', 'StatusBayar', STATUS_BAYAR, LABEL_STATUS_BAYAR))
    it('MetodeBayar', () => cek('spk.yaml', 'MetodeBayar', METODE_BAYAR, LABEL_METODE_BAYAR))
    it('JenisItem', () => cek('spk.yaml', 'JenisItem', JENIS_ITEM, LABEL_JENIS_ITEM))
    it('JenisPesanWaSpk', () =>
        cek('spk.yaml', 'JenisPesanWaSpk', JENIS_PESAN_WA_SPK, LABEL_JENIS_PESAN_WA_SPK))
    it('StatusBooking', () =>
        cek('booking.yaml', 'StatusBooking', STATUS_BOOKING, LABEL_STATUS_BOOKING))
    it('JenisKendaraan', () =>
        cek('pelanggan.yaml', 'JenisKendaraan', JENIS_KENDARAAN, LABEL_JENIS_KENDARAAN))
    it('LevelStok', () => cek('sparepart.yaml', 'LevelStok', LEVEL_STOK, LABEL_LEVEL_STOK))
    it('JenisPergerakan', () =>
        cek('sparepart.yaml', 'JenisPergerakan', JENIS_PERGERAKAN, LABEL_JENIS_PERGERAKAN))
})

describe('data contoh web sesuai skema', () => {
    it('outlet, SPK detail, dan daftar SPK contoh lolos skema zod', () => {
        expect(skemaOutlet.safeParse(OUTLET_CONTOH).success).toBe(true)
        expect(skemaSpkDetail.safeParse(SPK_CONTOH).success).toBe(true)
        for (const s of DAFTAR_SPK_CONTOH) {
            expect(skemaSpkRingkas.safeParse(s).success, s.number).toBe(true)
        }
    })

    it('harga beli yang ikut terkirim di item SPK dibuang, tidak pernah sampai ke komponen', () => {
        const bocor = { ...SPK_CONTOH, items: [{ ...SPK_CONTOH.items[1], costPrice: 40000 }] }
        const hasil = skemaSpkDetail.safeParse(bocor)
        expect(hasil.success && 'costPrice' in hasil.data.items[0]).toBe(false)
    })
})
