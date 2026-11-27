// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { describe, expect, it } from 'vitest'
import { normalkanNomorHp, tautanWhatsApp } from '../nomorHp'
import { kunciPlatMentah, normalkanPlat, tampilanPlat } from '../plat'

// Contoh-contoh di bawah disalin dari tabel di spec (NomorHpMasukan dan PlatMasukan di
// spec/components/schemas/umum.yaml), supaya form di browser menolak dan merapikan isian persis
// seperti backend.

describe('nomor HP (NomorHpMasukan)', () => {
    it.each([
        ['0812-3456-7890', '6281234567890'],
        ['+62 812 3456 7890', '6281234567890'],
        ['6281234567890', '6281234567890'],
        ['  0812 3456 7890\n', '6281234567890'],
        ['0812345678', '62812345678'],
    ])('%j -> %s', (ketik, seragam) => {
        expect(normalkanNomorHp(ketik)).toEqual({ ok: true, seragam })
    })

    it.each([
        ['', 'required'],
        ['  - ', 'required'],
        ['08123456', 'too_short'],
        ['0812345678901234', 'too_long'],
        ['021-555-1234', 'invalid_format'],
        ['(0812) 3456', 'invalid_format'],
        ['+08123456789', 'invalid_format'],
        ['62081234567', 'invalid_format'],
        ['0812abc', 'invalid_format'],
    ])('%j -> %s', (ketik, kode) => {
        expect(normalkanNomorHp(ketik)).toEqual({ ok: false, kode })
    })

    it('batas panjang: 10 dan 15 digit sah, 9 dan 16 tidak', () => {
        expect(normalkanNomorHp('62812345678').ok).toBe(true)
        expect(normalkanNomorHp('6281234567').ok).toBe(true)
        expect(normalkanNomorHp('628123456789012').ok).toBe(true)
        expect(normalkanNomorHp('628123456')).toEqual({ ok: false, kode: 'too_short' })
        expect(normalkanNomorHp('6281234567890123')).toEqual({ ok: false, kode: 'too_long' })
    })

    it('tautan WhatsApp memakai nomor seragam dan meng-encode pesan', () => {
        expect(tautanWhatsApp('6281234567890')).toBe('https://wa.me/6281234567890')
        expect(tautanWhatsApp('6281234567890', 'Halo bengkel & tim')).toBe(
            'https://wa.me/6281234567890?text=Halo%20bengkel%20%26%20tim',
        )
    })
})

describe('plat nomor (PlatMasukan)', () => {
    it.each([
        ['b1234xyz', 'B1234XYZ', 'B 1234 XYZ'],
        [' B 1234  XYZ ', 'B1234XYZ', 'B 1234 XYZ'],
        ['B-1234-XYZ', 'B1234XYZ', 'B 1234 XYZ'],
        ['ab 12 c', 'AB12C', 'AB 12 C'],
        ['D 1', 'D1', 'D 1'],
        ['RI1', 'RI1', 'RI 1'],
        ['B 1234 XYZ 5', 'B1234XYZ5', 'B1234XYZ5'],
        ['ABCDE', 'ABCDE', 'ABCDE'],
        ['b.1234.xy', 'B1234XY', 'B 1234 XY'],
    ])('%j -> kunci %s, tampilan %s', (ketik, kunci, tampilan) => {
        expect(normalkanPlat(ketik)).toEqual({ ok: true, kunci, tampilan })
    })

    it.each([
        ['', 'required'],
        [' - . ', 'required'],
        ['1234 AB', 'invalid_format'],
        ['B/1234', 'invalid_format'],
        ['B 12é', 'invalid_format'],
        ['B', 'too_short'],
        ['B 1234 ABCDEFGH', 'too_long'],
    ])('%j -> %s', (ketik, kode) => {
        expect(normalkanPlat(ketik)).toEqual({ ok: false, kode })
    })

    it('huruf non-ASCII tidak dibesarkan (spec: hanya a-z)', () => {
        expect(kunciPlatMentah('bé1')).toBe('Bé1')
    })

    it('tampilan dari kunci tanpa huruf belakang', () => {
        expect(tampilanPlat('B1234')).toBe('B 1234')
    })
})
