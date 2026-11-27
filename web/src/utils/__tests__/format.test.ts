// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { describe, expect, it } from 'vitest'
import {
    formatAngka,
    formatKendaraan,
    formatNomorHp,
    formatRupiah,
    formatTanggal,
    formatWaktu,
    formatWaktuWib,
    posisiKursorRupiah,
    rapikanIsianRupiah,
} from '../format'

// Contoh format diambil dari spec/whatsapp.md bagian 4, supaya angka di layar dan nota sama
// dengan pesan WhatsApp dari backend.

describe('rupiah dan angka', () => {
    it.each([
        [0, 'Rp0'],
        [7, 'Rp7'],
        [500, 'Rp500'],
        [35000, 'Rp35.000'],
        [150000, 'Rp150.000'],
        [1250000, 'Rp1.250.000'],
        [-2000, '-Rp2.000'],
    ])('%d -> %s', (nilai, teks) => {
        expect(formatRupiah(nilai)).toBe(teks)
    })

    it('angka bulat dengan titik ribuan', () => {
        expect(formatAngka(18250)).toBe('18.250')
        expect(formatAngka(-1500)).toBe('-1.500')
    })

    it('isian rupiah dirapikan saat diketik', () => {
        expect(rapikanIsianRupiah('15000')).toBe('15.000')
        expect(rapikanIsianRupiah('Rp 1a2')).toBe('12')
        expect(rapikanIsianRupiah('007')).toBe('7')
        expect(rapikanIsianRupiah('')).toBe('')
        expect(posisiKursorRupiah('15.000', 2)).toBe(2)
        expect(posisiKursorRupiah('15.000', 3)).toBe(4)
    })
})

describe('waktu dan tanggal (WIB)', () => {
    it.each([
        ['2026-11-27T07:05:59.999Z', '27-11-2026 14:05'],
        ['2026-11-27T17:00:00Z', '28-11-2026 00:00'],
    ])('%s -> %s', (iso, teks) => {
        expect(formatWaktu(iso)).toBe(teks)
        expect(formatWaktuWib(iso)).toBe(`${teks} WIB`)
    })

    it('teks yang bukan waktu menjadi kosong', () => {
        expect(formatWaktu('bukan')).toBe('')
        expect(formatWaktuWib('bukan')).toBe('')
    })

    it('tanggal kalender ditulis DD-MM-YYYY', () => {
        expect(formatTanggal('2026-11-27')).toBe('27-11-2026')
        expect(formatTanggal('27/11/2026')).toBe('27/11/2026')
    })
})

describe('nomor HP dan kendaraan', () => {
    it('nomor seragam ditulis seperti diketik orang', () => {
        expect(formatNomorHp('6281234567890')).toBe('0812-3456-7890')
        expect(formatNomorHp('6281****7890')).toBe('6281****7890')
    })

    it('kendaraan sama dengan {kendaraan} di templat WhatsApp', () => {
        expect(formatKendaraan({ plate: 'B 1234 XYZ', brand: 'Honda', model: 'Vario 125' })).toBe(
            'B 1234 XYZ (Honda Vario 125)',
        )
        expect(formatKendaraan({ plate: 'D 1', brand: 'Toyota', model: '' })).toBe('D 1 (Toyota)')
    })
})
