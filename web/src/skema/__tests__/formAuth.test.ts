// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { describe, expect, it } from 'vitest'
import { pangkas, panjangByte, pesanDariZod } from '../form/aturan'
import { PESAN_SANDI_BEDA, skemaMasuk, skemaSetup } from '../form/auth'

// Validasi form setup dan masuk di browser mengikuti aturan spec (staf.yaml): nama 2-100
// karakter, email ASCII maksimal 254, sandi 8-72 byte. Backend tetap memeriksa ulang.

const SETUP_SAH = {
    token: 'token-pemasangan-rahasia',
    name: '  Siti Pemilik ',
    email: ' Pemilik@Contoh.ID ',
    password: 'sandi-rahasia-123',
    ulangiPassword: 'sandi-rahasia-123',
}

const galat = (hasil: ReturnType<typeof skemaSetup.safeParse>) =>
    hasil.success ? {} : pesanDariZod(hasil.error)

describe('form setup', () => {
    it('isian sah dirapikan dan field ulangi sandi tidak ikut dikirim', () => {
        const hasil = skemaSetup.safeParse(SETUP_SAH)
        expect(hasil.success && hasil.data).toEqual({
            token: 'token-pemasangan-rahasia',
            name: 'Siti Pemilik',
            email: 'pemilik@contoh.id',
            password: 'sandi-rahasia-123',
        })
    })

    it('semua field kosong dilaporkan sekaligus dengan kalimat yang jelas', () => {
        const pesan = galat(
            skemaSetup.safeParse({
                token: '',
                name: ' ',
                email: '',
                password: '',
                ulangiPassword: '',
            }),
        )
        expect(pesan).toEqual({
            token: 'Token pemasangan wajib diisi.',
            name: 'Nama wajib diisi.',
            email: 'Email wajib diisi.',
            password: 'Kata sandi wajib diisi.',
            ulangiPassword: 'Ulangi kata sandi wajib diisi.',
        })
    })

    it('sandi pendek, sandi beda, nama pendek, dan email beraksen ditolak', () => {
        const pesan = galat(
            skemaSetup.safeParse({
                ...SETUP_SAH,
                name: 'S',
                email: 'josé@contoh.id',
                password: 'pendek',
                ulangiPassword: 'lain',
            }),
        )
        expect(pesan.name).toBe('Nama minimal 2 karakter.')
        expect(pesan.email).toMatch(/^Email belum sesuai format\./)
        expect(pesan.password).toBe('Kata sandi minimal 8 karakter.')
        // Superrefine hanya jalan bila field lain lolos; di sini cukup dipastikan tidak lolos.
        expect(skemaSetup.safeParse({ ...SETUP_SAH, ulangiPassword: 'lain' }).success).toBe(false)
    })

    it('sandi yang diulang berbeda', () => {
        const pesan = galat(skemaSetup.safeParse({ ...SETUP_SAH, ulangiPassword: 'beda-sekali' }))
        expect(pesan.ulangiPassword).toBe(PESAN_SANDI_BEDA)
    })

    it('batas sandi dihitung dalam byte UTF-8 (72)', () => {
        expect(
            skemaSetup.safeParse({
                ...SETUP_SAH,
                password: 'é'.repeat(36),
                ulangiPassword: 'é'.repeat(36),
            }).success,
        ).toBe(true)
        const pesan = galat(
            skemaSetup.safeParse({
                ...SETUP_SAH,
                password: 'é'.repeat(37),
                ulangiPassword: 'é'.repeat(37),
            }),
        )
        expect(pesan.password).toMatch(/72 byte/)
        expect(panjangByte('é')).toBe(2)
    })
})

describe('form masuk', () => {
    it('cukup tidak kosong; email dirapikan, sandi tidak dipangkas', () => {
        const hasil = skemaMasuk.safeParse({ email: ' Kasir@Bengkel.ID ', password: ' rahasia ' })
        expect(hasil.success && hasil.data).toEqual({
            email: 'kasir@bengkel.id',
            password: ' rahasia ',
        })
        expect(skemaMasuk.safeParse({ email: '', password: '' }).success).toBe(false)
    })

    it('"dipangkas" hanya spasi, tab, CR, LF (bukan NBSP)', () => {
        expect(pangkas(' \t\r\nabc\n ')).toBe('abc')
        expect(pangkas(' abc')).toBe(' abc')
    })
})
