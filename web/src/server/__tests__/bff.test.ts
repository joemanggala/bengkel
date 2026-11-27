// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    BATAS_BADAN_BYTE,
    asalSah,
    bacaBadanBerbatas,
    jalurStafBoleh,
    jenisJson,
    rutePublikBoleh,
    teruskanPublik,
    teruskanStaf,
} from '../bff'

const TOKEN = 'T'.repeat(43)
const ID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'

const fetchPalsu = vi.fn<typeof fetch>()

beforeEach(() => {
    vi.stubEnv('API_URL', 'http://backend.uji:8802/')
    vi.stubGlobal('fetch', fetchPalsu)
    fetchPalsu.mockReset()
    fetchPalsu.mockImplementation(
        async () =>
            new Response(JSON.stringify({ data: { ok: true } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
    )
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

type OpsiMinta = {
    metode?: string
    cookie?: string
    badan?: BodyInit
    header?: Record<string, string>
}

const minta = (path: string, { metode = 'GET', cookie, badan, header = {} }: OpsiMinta = {}) =>
    new NextRequest(`http://bengkel.uji${path}`, {
        method: metode,
        body: badan,
        headers: {
            host: 'bengkel.uji',
            ...header,
            ...(cookie ? { cookie: `sesi_staf=${cookie}` } : {}),
        },
    })

// Argumen fetch terakhir: [url, init].
const panggilanTerakhir = () => {
    const [url, init] = fetchPalsu.mock.calls.at(-1) ?? []
    return { url: String(url), init: (init ?? {}) as RequestInit }
}

describe('daftar putih rute staf', () => {
    it('kelompok rute staf dari spec boleh', () => {
        for (const jalur of [
            ['staff', 'me'],
            ['staff', ID],
            ['mechanics'],
            ['outlet'],
            ['customers', ID, 'vehicles'],
            ['vehicles'],
            ['vehicles', ID, 'work-orders'],
            ['services', ID],
            ['parts', ID, 'stock-count'],
            ['bookings', ID, 'convert'],
            ['work-orders'],
            ['work-orders', 'S-0001', 'items', ID],
            ['work-orders', 'S-0001', 'tracking-link'],
            ['reports', 'daily'],
        ]) {
            expect(jalurStafBoleh(jalur), jalur.join('/')).toBe(true)
        }
    })

    it('masuk, keluar, setup, publik, dan rute lain ditolak', () => {
        for (const jalur of [
            ['staff', 'login'],
            ['staff', 'logout'],
            ['setup'],
            ['public', 'services'],
            ['health'],
            ['work-orders', '..', 'staff'],
            ['work-orders', '.hidden'],
            ['work-orders', 'S-0001%2F..'],
            [],
        ]) {
            expect(jalurStafBoleh(jalur), jalur.join('/')).toBe(false)
        }
    })
})

describe('daftar putih rute publik', () => {
    it('hanya lima rute website publik dengan metode yang tepat', () => {
        expect(rutePublikBoleh('GET', ['services'])).toBe(true)
        expect(rutePublikBoleh('POST', ['bookings'])).toBe(true)
        expect(rutePublikBoleh('GET', ['bookings', TOKEN])).toBe(true)
        expect(rutePublikBoleh('POST', ['bookings', TOKEN, 'cancel'])).toBe(true)
        expect(rutePublikBoleh('GET', ['work-orders', TOKEN])).toBe(true)
    })

    it('metode lain, token salah bentuk, dan rute baru ditolak', () => {
        expect(rutePublikBoleh('POST', ['services'])).toBe(false)
        expect(rutePublikBoleh('GET', ['bookings'])).toBe(false)
        expect(rutePublikBoleh('GET', ['bookings', 'pendek'])).toBe(false)
        expect(rutePublikBoleh('GET', ['work-orders', `${TOKEN}A`])).toBe(false)
        expect(rutePublikBoleh('POST', ['work-orders', TOKEN, 'cancel'])).toBe(false)
        expect(rutePublikBoleh('GET', ['outlet'])).toBe(false)
    })
})

describe('pintu staf', () => {
    it('meneruskan ke /api dengan token cookie sebagai Bearer, tanpa cookie browser', async () => {
        const balasan = await teruskanStaf(
            minta('/bff/staf/work-orders?scope=active', { cookie: TOKEN }),
            ['work-orders'],
        )
        expect(balasan.status).toBe(200)
        const { url, init } = panggilanTerakhir()
        expect(url).toBe('http://backend.uji:8802/api/work-orders?scope=active')
        const header = init.headers as Record<string, string>
        expect(header.Authorization).toBe(`Bearer ${TOKEN}`)
        expect(header).not.toHaveProperty('cookie')
        expect(header).not.toHaveProperty('Cookie')
    })

    it('tanpa cookie: 401 tanpa bertanya ke backend', async () => {
        const balasan = await teruskanStaf(minta('/bff/staf/work-orders'), ['work-orders'])
        expect(balasan.status).toBe(401)
        expect(fetchPalsu).not.toHaveBeenCalled()
    })

    it('401 dari backend menghapus cookie sesi', async () => {
        fetchPalsu.mockResolvedValue(
            new Response(JSON.stringify({ error: { code: 'unauthenticated', message: 'x' } }), {
                status: 401,
            }),
        )
        const balasan = await teruskanStaf(minta('/bff/staf/staff/me', { cookie: TOKEN }), [
            'staff',
            'me',
        ])
        expect(balasan.status).toBe(401)
        expect(balasan.headers.get('set-cookie') ?? '').toMatch(/sesi_staf=;/)
    })

    it('POST dari situs lain ditolak', async () => {
        const balasan = await teruskanStaf(
            minta('/bff/staf/work-orders', {
                metode: 'POST',
                cookie: TOKEN,
                badan: '{}',
                header: { origin: 'https://jahat.id' },
            }),
            ['work-orders'],
        )
        expect(balasan.status).toBe(403)
        expect(fetchPalsu).not.toHaveBeenCalled()
    })

    it('tulis tanpa Origin: hanya lolos bila browser menandai Sec-Fetch-Site same-origin', async () => {
        const tulis = (metode: string, header: Record<string, string>) =>
            teruskanStaf(
                minta('/bff/staf/customers', {
                    metode,
                    cookie: TOKEN,
                    badan: metode === 'DELETE' ? undefined : '{}',
                    header: { 'content-type': 'application/json', ...header },
                }),
                ['customers'],
            )
        for (const metode of ['POST', 'PUT', 'PATCH', 'DELETE']) {
            const tanpaJejak = await tulis(metode, {})
            expect(tanpaJejak.status, metode).toBe(403)
            expect(await tanpaJejak.json()).toEqual({
                error: { code: 'forbidden', message: 'Permintaan ditolak.' },
            })
            expect((await tulis(metode, { 'sec-fetch-site': 'cross-site' })).status).toBe(403)
            expect((await tulis(metode, { 'sec-fetch-site': 'same-site' })).status).toBe(403)
            expect((await tulis(metode, { 'sec-fetch-site': 'none' })).status).toBe(403)
        }
        expect(fetchPalsu).not.toHaveBeenCalled()
        expect((await tulis('POST', { 'sec-fetch-site': 'same-origin' })).status).toBe(200)
        expect((await tulis('PATCH', { origin: 'http://bengkel.uji' })).status).toBe(200)
        expect(fetchPalsu).toHaveBeenCalledTimes(2)
    })

    it('Origin di belakang proxy dicocokkan dengan X-Forwarded-Host', async () => {
        const balasan = await teruskanStaf(
            minta('/bff/staf/customers', {
                metode: 'POST',
                cookie: TOKEN,
                badan: '{}',
                header: {
                    host: 'localhost:3800',
                    'x-forwarded-host': 'bengkelku.id',
                    origin: 'https://bengkelku.id',
                    'content-type': 'application/json',
                },
            }),
            ['customers'],
        )
        expect(balasan.status).toBe(200)
    })

    it('GET tanpa Origin tetap lolos (navigasi dan fetch biasa)', async () => {
        const balasan = await teruskanStaf(minta('/bff/staf/staff/me', { cookie: TOKEN }), [
            'staff',
            'me',
        ])
        expect(balasan.status).toBe(200)
    })

    it('badan JSON diteruskan apa adanya dengan Content-Type JSON', async () => {
        for (const jenis of [
            'application/json',
            'application/json; charset=utf-8',
            'Application/JSON;charset=UTF-8',
        ]) {
            const balasan = await teruskanStaf(
                minta('/bff/staf/work-orders/S-0001/status', {
                    metode: 'POST',
                    cookie: TOKEN,
                    badan: '{"status":"IN_PROGRESS"}',
                    header: { origin: 'http://bengkel.uji', 'content-type': jenis },
                }),
                ['work-orders', 'S-0001', 'status'],
            )
            expect(balasan.status, jenis).toBe(200)
            const { init } = panggilanTerakhir()
            expect(new TextDecoder().decode(init.body as Uint8Array)).toBe(
                '{"status":"IN_PROGRESS"}',
            )
            expect((init.headers as Record<string, string>)['Content-Type']).toBe(
                'application/json',
            )
        }
    })

    it('badan bukan JSON ditolak 415 sebelum ke backend; badan kosong tidak diperiksa', async () => {
        for (const jenis of [
            'text/plain',
            'application/x-www-form-urlencoded',
            'multipart/form-data; boundary=x',
            'application/jsonp',
            'application/json-patch+json',
            undefined,
        ]) {
            const balasan = await teruskanStaf(
                minta('/bff/staf/customers', {
                    metode: 'POST',
                    cookie: TOKEN,
                    badan: '{"name":"Budi"}',
                    header: {
                        origin: 'http://bengkel.uji',
                        ...(jenis ? { 'content-type': jenis } : {}),
                    },
                }),
                ['customers'],
            )
            expect(balasan.status, String(jenis)).toBe(415)
            expect(await balasan.json()).toEqual({
                error: {
                    code: 'bad_request',
                    message: 'Badan permintaan harus JSON dengan Content-Type: application/json.',
                },
            })
        }
        expect(fetchPalsu).not.toHaveBeenCalled()

        // Rute tanpa badan (mis. konfirmasi booking) dikirim klien tanpa Content-Type.
        const tanpaBadan = await teruskanStaf(
            minta(`/bff/staf/bookings/${ID}/confirm`, {
                metode: 'POST',
                cookie: TOKEN,
                header: { origin: 'http://bengkel.uji' },
            }),
            ['bookings', ID, 'confirm'],
        )
        expect(tanpaBadan.status).toBe(200)
        const { init } = panggilanTerakhir()
        expect(init.body).toBeUndefined()
        expect(init.headers as Record<string, string>).not.toHaveProperty('Content-Type')
    })

    it('badan lebih dari 1 MiB ditolak 413 sebelum ke backend', async () => {
        const balasan = await teruskanStaf(
            minta('/bff/staf/customers', {
                metode: 'POST',
                cookie: TOKEN,
                badan: 'x'.repeat(BATAS_BADAN_BYTE + 1),
                header: { origin: 'http://bengkel.uji', 'content-type': 'application/json' },
            }),
            ['customers'],
        )
        expect(balasan.status).toBe(413)
        expect(fetchPalsu).not.toHaveBeenCalled()
    })

    it('backend mati: 502; terlalu lama: 504', async () => {
        fetchPalsu.mockRejectedValueOnce(new TypeError('fetch failed'))
        expect(
            (await teruskanStaf(minta('/bff/staf/outlet', { cookie: TOKEN }), ['outlet'])).status,
        ).toBe(502)
        const lama = new Error('lama')
        lama.name = 'TimeoutError'
        fetchPalsu.mockRejectedValueOnce(lama)
        expect(
            (await teruskanStaf(minta('/bff/staf/outlet', { cookie: TOKEN }), ['outlet'])).status,
        ).toBe(504)
    })

    it('204 diteruskan tanpa badan, Retry-After ikut diteruskan', async () => {
        fetchPalsu.mockResolvedValueOnce(
            new Response(JSON.stringify({ error: { code: 'too_many_requests', message: 'x' } }), {
                status: 429,
                headers: { 'Retry-After': '120' },
            }),
        )
        const balasan = await teruskanStaf(minta('/bff/staf/outlet', { cookie: TOKEN }), ['outlet'])
        expect(balasan.headers.get('retry-after')).toBe('120')
    })
})

describe('pintu publik', () => {
    it('tidak membaca cookie dan tidak mengirim Authorization walau staf sedang masuk', async () => {
        const balasan = await teruskanPublik(
            minta(`/bff/public/work-orders/${TOKEN}`, { cookie: TOKEN }),
            ['work-orders', TOKEN],
        )
        expect(balasan.status).toBe(200)
        const { url, init } = panggilanTerakhir()
        expect(url).toBe(`http://backend.uji:8802/api/public/work-orders/${TOKEN}`)
        expect(init.headers as Record<string, string>).not.toHaveProperty('Authorization')
        expect(balasan.headers.get('set-cookie')).toBeNull()
    })

    it('rute di luar daftar putih: 404 tanpa ke backend', async () => {
        const balasan = await teruskanPublik(minta('/bff/public/staff'), ['staff'])
        expect(balasan.status).toBe(404)
        expect(fetchPalsu).not.toHaveBeenCalled()
    })

    it('booking dari situs lain ditolak', async () => {
        const balasan = await teruskanPublik(
            minta('/bff/public/bookings', {
                metode: 'POST',
                badan: '{}',
                header: { origin: 'https://jahat.id' },
            }),
            ['bookings'],
        )
        expect(balasan.status).toBe(403)
    })

    it('booking tanpa Origin tetap diteruskan (tidak ada cookie yang dilindungi), badan wajib JSON', async () => {
        const kirim = (jenis: string) =>
            teruskanPublik(
                minta('/bff/public/bookings', {
                    metode: 'POST',
                    badan: '{}',
                    header: { 'content-type': jenis },
                }),
                ['bookings'],
            )
        expect((await kirim('application/json')).status).toBe(200)
        expect((await kirim('text/plain')).status).toBe(415)
    })
})

describe('pembantu', () => {
    it('asal permintaan', () => {
        const dengan = (origin?: string) =>
            new Request('http://bengkel.uji/x', {
                headers: { host: 'bengkel.uji', ...(origin ? { origin } : {}) },
            })
        expect(asalSah(dengan())).toBe(true)
        expect(asalSah(dengan('http://bengkel.uji'))).toBe(true)
        expect(asalSah(dengan('https://jahat.id'))).toBe(false)
        expect(asalSah(dengan('bukan url'))).toBe(false)
        // Pintu staf: tanpa Origin hanya lolos dengan Sec-Fetch-Site: same-origin.
        expect(asalSah(dengan(), { wajib: true })).toBe(false)
        expect(asalSah(dengan('http://bengkel.uji'), { wajib: true })).toBe(true)
        const sameOrigin = new Request('http://bengkel.uji/x', {
            headers: { host: 'bengkel.uji', 'sec-fetch-site': 'same-origin' },
        })
        expect(asalSah(sameOrigin, { wajib: true })).toBe(true)
    })

    it('Content-Type JSON', () => {
        expect(jenisJson('application/json')).toBe(true)
        expect(jenisJson('application/json; charset=utf-8')).toBe(true)
        expect(jenisJson(' APPLICATION/JSON ')).toBe(true)
        expect(jenisJson(null)).toBe(false)
        expect(jenisJson('')).toBe(false)
        expect(jenisJson('text/json')).toBe(false)
        expect(jenisJson('application/problem+json')).toBe(false)
    })

    it('badan dibaca berbatas', async () => {
        const kecil = new Request('http://x/', { method: 'POST', body: 'abc' })
        expect(new TextDecoder().decode((await bacaBadanBerbatas(kecil, 10)) ?? undefined)).toBe(
            'abc',
        )
        const besar = new Request('http://x/', { method: 'POST', body: 'abcdef' })
        expect(await bacaBadanBerbatas(besar, 3)).toBeNull()
    })
})
