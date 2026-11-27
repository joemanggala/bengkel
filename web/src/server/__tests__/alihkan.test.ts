// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { alihkan, asalPermintaan } from '../alihkan'

// `next start` menyusun request.url dari host miliknya sendiri (localhost:3800), bukan dari Host
// yang dikirim browser; permintaan uji meniru itu dengan alamat localhost dan Host berbeda.
const minta = (headers: Record<string, string> = {}) =>
    new NextRequest('http://localhost:3800/admin/papan', { headers })

const lokasi = (balasan: Response) => balasan.headers.get('location')

describe('alihkan', () => {
    it('memakai Host dan skema dari proxy, bukan host milik server Next.js', () => {
        const balasan = alihkan(
            minta({
                host: 'bengkel.contoh.id',
                'x-forwarded-host': 'bengkel.contoh.id',
                'x-forwarded-proto': 'https',
            }),
            '/admin/masuk?ke=%2Fadmin%2Fpapan',
        )
        expect(balasan.status).toBe(307)
        expect(lokasi(balasan)).toBe('https://bengkel.contoh.id/admin/masuk?ke=%2Fadmin%2Fpapan')
    })

    it('akses langsung lewat IP jaringan lokal (tablet kasir): tetap ke IP itu, bukan localhost', () => {
        const balasan = alihkan(minta({ host: '192.168.1.20:3800' }), '/admin/masuk')
        expect(lokasi(balasan)).toBe('http://192.168.1.20:3800/admin/masuk')
    })

    it('tanpa Host sah: kembali ke asal permintaan', () => {
        const balasan = alihkan(minta({ host: 'jahat.example/evil' }), '/admin/masuk')
        expect(lokasi(balasan)).toBe('http://localhost:3800/admin/masuk')
    })

    it('status bisa diganti', () => {
        expect(alihkan(minta(), '/admin/papan', 303).status).toBe(303)
    })

    it('menolak apa pun yang bukan path dalam situs ini', () => {
        for (const alamat of [
            '',
            'admin/masuk',
            '//evil.example/admin',
            '/\\evil.example',
            'https://evil.example',
            'http://localhost:3800/admin',
            'javascript:alert(1)',
        ]) {
            expect(() => alihkan(minta(), alamat), alamat).toThrow('hanya ke path dalam situs ini')
        }
    })
})

describe('asalPermintaan', () => {
    const cadangan = 'http://localhost:3800'
    const asal = (h: Record<string, string>, protokol = 'http') =>
        asalPermintaan(new Headers(h), protokol, cadangan)

    it('X-Forwarded-Host mengalahkan Host; hanya nilai pertama dari daftar yang dipakai', () => {
        expect(asal({ host: 'dalam:3800', 'x-forwarded-host': 'a.example, b.example' })).toBe(
            'http://a.example',
        )
    })

    it('skema dari X-Forwarded-Proto, atau dari protokol permintaan bila tidak ada', () => {
        expect(asal({ host: 'a.example', 'x-forwarded-proto': 'HTTPS' })).toBe('https://a.example')
        expect(asal({ host: 'a.example' }, 'https')).toBe('https://a.example')
    })

    it('host dengan port dan IPv6 diterima', () => {
        expect(asal({ host: 'a.example:8080' })).toBe('http://a.example:8080')
        expect(asal({ host: '[::1]:3800' })).toBe('http://[::1]:3800')
    })

    it('host atau skema yang tidak sah tidak dipercaya', () => {
        const tidakSah: Array<Record<string, string>> = [
            { host: '' },
            { host: 'a.example/path' },
            { host: 'user@a.example' },
            { host: 'a b.example' },
            { host: 'a.example:99999x' },
            { host: 'a.example', 'x-forwarded-proto': 'javascript' },
        ]
        for (const h of tidakSah) {
            expect(asal(h), JSON.stringify(h)).toBe(cadangan)
        }
    })
})
