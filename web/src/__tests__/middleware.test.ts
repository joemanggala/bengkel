// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HALAMAN_PANEL_LAIN, MENU_PANEL } from '@/constants/menu'
import { config, middleware } from '../middleware'

const fetchPalsu = vi.fn<typeof fetch>()

beforeEach(() => {
    vi.stubEnv('API_URL', 'http://backend.uji:8802')
    vi.stubGlobal('fetch', fetchPalsu)
    fetchPalsu.mockReset()
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

const minta = (path: string, cookie?: string, header: Record<string, string> = {}) =>
    new NextRequest(`http://bengkel.uji${path}`, {
        headers: { ...header, ...(cookie ? { cookie: `sesi_staf=${cookie}` } : {}) },
    })

const tujuan = (balasan: Response) =>
    new URL(balasan.headers.get('location') ?? '', 'http://bengkel.uji')

// Backend palsu untuk GET /api/staff/me.
const backendMenjawab = (status: number, role?: string) =>
    fetchPalsu.mockResolvedValue(
        new Response(JSON.stringify(role ? { data: { role } } : { error: { code: 'x' } }), {
            status,
            headers: { 'Content-Type': 'application/json' },
        }),
    )

// Pola matcher Next.js yang dipakai di sini hanya dua bentuk: path persis dan "/x/:path*".
const tercakup = (path: string): boolean =>
    config.matcher.some((pola) =>
        pola.endsWith('/:path*')
            ? path === pola.slice(0, -'/:path*'.length) ||
              path.startsWith(pola.slice(0, -':path*'.length))
            : path === pola,
    )

describe('cakupan middleware', () => {
    it('setiap menu panel dan halaman panel lain dijaga', () => {
        for (const item of MENU_PANEL) expect(tercakup(item.href), item.href).toBe(true)
        for (const path of HALAMAN_PANEL_LAIN) expect(tercakup(path), path).toBe(true)
        expect(tercakup('/admin')).toBe(true)
        expect(tercakup('/admin/spk/S-0001')).toBe(true)
    })

    it('halaman masuk, setup, penghapus cookie, BFF, dan website publik tidak dijaga', () => {
        for (const path of [
            '/admin/masuk',
            '/admin/setup',
            '/admin/sesi-berakhir',
            '/bff/staf/work-orders',
            '/bff/public/services',
            '/',
            '/booking',
            '/servis/abc',
        ]) {
            expect(tercakup(path), path).toBe(false)
        }
    })
})

describe('middleware: sesi', () => {
    it('tanpa cookie ke halaman masuk dengan ?ke= halaman asal', async () => {
        const balasan = await middleware(minta('/admin/spk/S-0001?tab=bayar'))
        expect(balasan.status).toBe(307)
        expect(tujuan(balasan).pathname).toBe('/admin/masuk')
        expect(tujuan(balasan).searchParams.get('ke')).toBe('/admin/spk/S-0001?tab=bayar')
        expect(fetchPalsu).not.toHaveBeenCalled()
    })

    it('/admin tanpa cookie ke halaman masuk tanpa ?ke=', async () => {
        const t = tujuan(await middleware(minta('/admin')))
        expect(t.pathname).toBe('/admin/masuk')
        expect(t.search).toBe('')
    })

    it('dengan cookie: lanjut, dan cookie ditulis ulang 30 hari (sesi bergeser)', async () => {
        const balasan = await middleware(minta('/admin/papan', 'tok'))
        expect(balasan.headers.get('location')).toBeNull()
        const cookie = balasan.headers.get('set-cookie') ?? ''
        expect(cookie).toMatch(/^sesi_staf=tok;/)
        expect(cookie).toMatch(/Max-Age=2592000/)
        expect(cookie).toMatch(/HttpOnly/)
        expect(cookie.toLowerCase()).toMatch(/samesite=lax/)
    })

    it('halaman untuk semua peran tidak bertanya peran ke backend', async () => {
        await middleware(minta('/admin/papan', 'tok'))
        await middleware(minta('/admin/spk/S-0001', 'tok'))
        await middleware(minta('/admin/komponen', 'tok'))
        expect(fetchPalsu).not.toHaveBeenCalled()
    })

    it('path halaman diteruskan ke server component lewat header permintaan', async () => {
        const balasan = await middleware(minta('/admin/booking?page=2', 'tok'))
        expect(balasan.headers.get('x-middleware-request-x-bengkel-path')).toBe(
            '/admin/booking?page=2',
        )
    })

    it('cookie Secure mengikuti protokol permintaan', async () => {
        const setCookie = async (h: Record<string, string>) =>
            (await middleware(minta('/admin/papan', 'tok', h))).headers.get('set-cookie') ?? ''
        expect(await setCookie({ 'x-forwarded-proto': 'http' })).not.toMatch(/Secure/i)
        expect(await setCookie({ 'x-forwarded-proto': 'https' })).toMatch(/Secure/i)
    })
})

describe('middleware: pembatasan halaman per peran', () => {
    const PEMILIK = [
        '/admin/jasa',
        '/admin/sparepart',
        '/admin/staf',
        '/admin/outlet',
        '/admin/rekap',
    ]
    const KASIR = ['/admin/spk/baru', '/admin/booking', '/admin/pelanggan']

    it.each(PEMILIK)('kasir membuka %s: dialihkan ke Papan servis dengan penjelasan', async (p) => {
        backendMenjawab(200, 'cashier')
        const balasan = await middleware(minta(p, 'tok'))
        expect(balasan.status).toBe(307)
        expect(tujuan(balasan).pathname).toBe('/admin/papan')
        expect(tujuan(balasan).searchParams.get('akses')).toBe('ditolak')
    })

    it.each([...PEMILIK, ...KASIR])('mekanik membuka %s: dialihkan', async (p) => {
        backendMenjawab(200, 'mechanic')
        const balasan = await middleware(minta(p, 'tok'))
        expect(tujuan(balasan).pathname).toBe('/admin/papan')
    })

    it.each(KASIR)('kasir membuka %s: lanjut', async (p) => {
        backendMenjawab(200, 'cashier')
        expect((await middleware(minta(p, 'tok'))).headers.get('location')).toBeNull()
    })

    it.each([...PEMILIK, ...KASIR])('pemilik membuka %s: lanjut', async (p) => {
        backendMenjawab(200, 'owner')
        expect((await middleware(minta(p, 'tok'))).headers.get('location')).toBeNull()
    })

    it('peran dibaca dari backend dengan token cookie, bukan dari cookie', async () => {
        backendMenjawab(200, 'cashier')
        await middleware(minta('/admin/jasa', 'token-rahasia'))
        const [url, init] = fetchPalsu.mock.calls[0]
        expect(String(url)).toBe('http://backend.uji:8802/api/staff/me')
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-rahasia')
    })

    it('token ditolak backend (401): lewat penghapus cookie dengan ?ke=', async () => {
        backendMenjawab(401)
        const balasan = await middleware(minta('/admin/rekap', 'tok'))
        expect(tujuan(balasan).pathname).toBe('/admin/sesi-berakhir')
        expect(tujuan(balasan).searchParams.get('ke')).toBe('/admin/rekap')
    })

    it('backend tidak terjangkau: dibiarkan lewat, penjaga di server yang memutuskan', async () => {
        fetchPalsu.mockRejectedValue(new TypeError('fetch failed'))
        expect((await middleware(minta('/admin/jasa', 'tok'))).headers.get('location')).toBeNull()
    })
})
