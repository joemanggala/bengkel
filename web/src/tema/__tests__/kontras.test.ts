// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { bacaTokenWarna, rasioKontras } from '../kontras'

// Token warna dibaca langsung dari globals.css, jadi mengganti warna di sana tanpa memeriksa
// kontras langsung gagal di tes ini.
const css = readFileSync(path.join(import.meta.dirname, '../../app/globals.css'), 'utf8')
const w = bacaTokenWarna(css)

const AA_TEKS = 4.5
const AA_KOMPONEN = 3

// Pasangan lencana: [teks, latar pucat]. Enam status SPK dan lima status booking.
const LENCANA_SPK = ['antre', 'dikerjakan', 'tunggu-part', 'selesai', 'diambil', 'batal']
const LENCANA_BOOKING = ['menunggu', 'dikonfirmasi', 'jadi-spk', 'ditolak', 'batal']

describe('rumus kontras', () => {
    it('hitam di atas putih = 21:1, warna sama = 1:1', () => {
        expect(rasioKontras('#000000', '#ffffff')).toBeCloseTo(21, 5)
        expect(rasioKontras('#336699', '#336699')).toBeCloseTo(1, 5)
    })

    it('menolak format selain #rrggbb', () => {
        expect(() => rasioKontras('#fff', '#000000')).toThrow()
    })
})

describe('token warna di globals.css memenuhi WCAG AA', () => {
    it('semua token yang dipakai ada', () => {
        const wajib = [
            'latar',
            'permukaan',
            'tinta',
            'redup',
            'garis',
            'garis-kuat',
            'utama',
            'utama-tua',
            'utama-pucat',
            'fokus',
            'bahaya',
            'bahaya-tua',
            'bahaya-pucat',
            'peringatan',
            'peringatan-pucat',
            'berhasil',
            'berhasil-pucat',
            ...LENCANA_SPK.flatMap((s) => [`st-${s}`, `st-${s}-pucat`]),
            ...LENCANA_BOOKING.flatMap((s) => [`bk-${s}`, `bk-${s}-pucat`]),
        ]
        for (const nama of wajib) expect(w[nama], nama).toBeDefined()
    })

    // [teks, latar]
    const TEKS: [string, string][] = [
        ['tinta', 'permukaan'],
        ['tinta', 'latar'],
        ['redup', 'permukaan'],
        ['redup', 'latar'],
        ['permukaan', 'utama'],
        ['permukaan', 'utama-tua'],
        ['permukaan', 'bahaya'],
        ['permukaan', 'bahaya-tua'],
        ['permukaan', 'berhasil'],
        ['permukaan', 'peringatan'],
        ['utama', 'permukaan'],
        ['utama', 'latar'],
        ['utama-tua', 'permukaan'],
        ['utama-tua', 'latar'],
        ['utama-tua', 'utama-pucat'],
        ['tinta', 'utama-pucat'],
        ['redup', 'utama-pucat'],
        ['bahaya-tua', 'bahaya-pucat'],
        ['bahaya-tua', 'permukaan'],
        ['peringatan', 'peringatan-pucat'],
        ['berhasil', 'berhasil-pucat'],
        ...LENCANA_SPK.map((s): [string, string] => [`st-${s}`, `st-${s}-pucat`]),
        ...LENCANA_BOOKING.map((s): [string, string] => [`bk-${s}`, `bk-${s}-pucat`]),
    ]

    it.each(TEKS)('teks %s di atas %s minimal 4,5:1', (teks, latar) => {
        expect(rasioKontras(w[teks], w[latar]), `${teks} / ${latar}`).toBeGreaterThanOrEqual(
            AA_TEKS,
        )
    })

    it('tepi kotak isian dan cincin fokus minimal 3:1 terhadap permukaan dan latar', () => {
        expect(rasioKontras(w['garis-kuat'], w.permukaan)).toBeGreaterThanOrEqual(AA_KOMPONEN)
        expect(rasioKontras(w.fokus, w.permukaan)).toBeGreaterThanOrEqual(AA_KOMPONEN)
        expect(rasioKontras(w.fokus, w.latar)).toBeGreaterThanOrEqual(AA_KOMPONEN)
        // Cincin fokus di atas tombol utama juga harus terlihat.
        expect(rasioKontras(w.fokus, w['utama-pucat'])).toBeGreaterThanOrEqual(AA_KOMPONEN)
    })

    it('cincin fokus tidak sewarna dengan warna utama (keduanya harus bisa dibedakan)', () => {
        expect(w.fokus).not.toBe(w.utama)
        expect(w.fokus).not.toBe(w['utama-tua'])
    })
})

describe('lencana: rona tiap status berbeda', () => {
    it('enam status SPK memakai enam pasangan warna yang berbeda', () => {
        const pasangan = LENCANA_SPK.map((s) => `${w[`st-${s}`]}/${w[`st-${s}-pucat`]}`)
        expect(new Set(pasangan).size).toBe(LENCANA_SPK.length)
    })

    it('lima status booking memakai lima pasangan warna yang berbeda', () => {
        const pasangan = LENCANA_BOOKING.map((s) => `${w[`bk-${s}`]}/${w[`bk-${s}-pucat`]}`)
        expect(new Set(pasangan).size).toBe(LENCANA_BOOKING.length)
    })
})

describe('gerakan dan cetak', () => {
    it('menghormati prefers-reduced-motion', () => {
        expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    })

    it('nota thermal selebar bidang cetak 58 mm (48 mm) dan hanya area cetak yang tercetak', () => {
        expect(css).toMatch(/\.nota-thermal\s*\{[^}]*width:\s*48mm/)
        expect(css).toMatch(/@media print[\s\S]*body > :not\(#area-cetak\)/)
    })
})
