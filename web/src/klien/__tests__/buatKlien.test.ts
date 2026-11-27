// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { describe, expect, it, vi } from 'vitest'
import { SPK_CONTOH } from '@/constants/contoh'
import { GALAT_KONTRAK } from '../balasan'
import { buatKlien } from '../buatKlien'
import type { HasilApi } from '../hasil'
import { buatPengangkutBrowser } from '../peramban'
import type { OpsiPanggil } from '../pengangkut'

type Panggilan = { rute: string; opsi: OpsiPanggil }

// Pengangkut palsu: mencatat rute dan membalas `balasan` apa adanya.
function palsu(balasan: HasilApi<unknown> = { ok: true, status: 200, data: {} }) {
    const panggilan: Panggilan[] = []
    const klien = buatKlien(async (rute, opsi = {}) => {
        panggilan.push({ rute, opsi })
        return balasan
    })
    return { klien, panggilan }
}

const ID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const TOKEN = 'Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk'
const WAKTU = '2026-11-28T01:15:00.000Z'
const META = { page: 1, limit: 20, total: 1 }

const partStaf = {
    partId: ID,
    sku: 'OLI-10W40',
    name: 'Oli Mesin',
    unit: 'botol',
    price: 55000,
    stock: 3,
    minStock: 2,
    stockLevel: 'ok',
    isActive: true,
    createdAt: WAKTU,
    updatedAt: WAKTU,
}

describe('antarmuka lengkap', () => {
    it('satu metode untuk setiap operasi spec kecuali GET /api/health (51 metode)', () => {
        expect(Object.keys(palsu().klien)).toHaveLength(51)
    })
})

describe('rute dan metode HTTP sesuai spec', () => {
    it.each([
        ['statusSetup', [], '/setup', 'GET'],
        ['keluarStaf', [], '/staff/logout', 'POST'],
        ['daftarMekanik', [], '/mechanics', 'GET'],
        ['ubahOutlet', [{}], '/outlet', 'PUT'],
        ['jasaPublik', [], '/public/services', 'GET'],
        ['batalkanBookingPublik', [TOKEN], `/public/bookings/${TOKEN}/cancel`, 'POST'],
        ['lacakServisPublik', [TOKEN], `/public/work-orders/${TOKEN}`, 'GET'],
        ['tambahKendaraan', [ID, {}], `/customers/${ID}/vehicles`, 'POST'],
        ['riwayatServisKendaraan', [ID], `/vehicles/${ID}/work-orders`, 'GET'],
        ['ubahJasa', [ID, {}], `/services/${ID}`, 'PATCH'],
        ['hitungStok', [ID, {}], `/parts/${ID}/stock-count`, 'POST'],
        ['konfirmasiBooking', [ID], `/bookings/${ID}/confirm`, 'POST'],
        ['ubahStatusSpk', ['S-0001', {}], '/work-orders/S-0001/status', 'POST'],
        ['hapusItemSpk', ['S-0001', ID], `/work-orders/S-0001/items/${ID}`, 'DELETE'],
        ['buatUlangTautanLacak', ['S-0001'], '/work-orders/S-0001/tracking-link', 'POST'],
    ] as const)('%s -> %s %s', async (nama, argumen, rute, metode) => {
        const { klien, panggilan } = palsu()
        const fungsi = klien[nama] as (...a: unknown[]) => Promise<unknown>
        await fungsi(...argumen)
        expect(panggilan[0].rute).toBe(rute)
        expect(panggilan[0].opsi.metode ?? 'GET').toBe(metode)
    })

    it('query daftar dan cari plat', async () => {
        const { klien, panggilan } = palsu()
        await klien.daftarSpk({ scope: 'active', sort: 'oldest', page: 2 })
        await klien.cariKendaraan('b 1234', { limit: 5 })
        await klien.rekapHarian('2026-11-27')
        expect(panggilan[0].opsi.query).toEqual({ scope: 'active', sort: 'oldest', page: 2 })
        expect(panggilan[1].opsi.query).toEqual({ limit: 5, plate: 'b 1234' })
        expect(panggilan[2].opsi.query).toEqual({ date: '2026-11-27' })
    })

    it('jadikan SPK tanpa isian tetap mengirim objek JSON kosong', async () => {
        const { klien, panggilan } = palsu()
        await klien.jadikanSpk(ID)
        expect(panggilan[0].opsi.badan).toEqual({})
    })

    it('nomor dan token di path di-encode', async () => {
        const { klien, panggilan } = palsu()
        await klien.detailSpk('S-0001/../x')
        expect(panggilan[0].rute).toBe('/work-orders/S-0001%2F..%2Fx')
    })
})

describe('balasan diperiksa terhadap kontrak', () => {
    it('balasan sesuai skema diteruskan', async () => {
        const { klien } = palsu({ ok: true, status: 200, data: SPK_CONTOH })
        const hasil = await klien.detailSpk('S-0012')
        expect(hasil.ok && hasil.data.number).toBe('S-0012')
    })

    it('balasan yang menyimpang menjadi galat kontrak, bukan data setengah rusak', async () => {
        const { klien } = palsu({ ok: true, status: 200, data: { ...SPK_CONTOH, total: '165000' } })
        expect(await klien.detailSpk('S-0012')).toEqual({
            ok: false,
            status: 200,
            galat: GALAT_KONTRAK,
        })
    })

    it('daftar berpaginasi wajib membawa meta', async () => {
        const { klien } = palsu({ ok: true, status: 200, data: [] })
        const hasil = await klien.daftarSpk()
        expect(hasil.ok).toBe(false)
        const ada = palsu({ ok: true, status: 200, data: [], meta: META })
        expect((await ada.klien.daftarSpk()).ok).toBe(true)
    })

    it('galat dari backend diteruskan apa adanya', async () => {
        const galat = {
            code: 'forbidden' as const,
            message: 'Kamu tidak punya akses ke sumber ini',
        }
        const { klien } = palsu({ ok: false, status: 403, galat })
        expect(await klien.daftarBooking()).toEqual({ ok: false, status: 403, galat })
    })
})

describe('sparepart: harga beli rahasia pemilik', () => {
    it('daftar untuk kasir (tanpa costPrice) diterima', async () => {
        const { klien } = palsu({ ok: true, status: 200, data: [partStaf], meta: META })
        const hasil = await klien.daftarSparepart()
        expect(hasil.ok && 'costPrice' in hasil.data[0]).toBe(false)
    })

    it('daftar untuk pemilik (dengan costPrice) diterima', async () => {
        const { klien } = palsu({
            ok: true,
            status: 200,
            data: [{ ...partStaf, costPrice: 40000 }],
            meta: META,
        })
        const hasil = await klien.daftarSparepart()
        expect(hasil.ok && 'costPrice' in hasil.data[0]).toBe(true)
    })

    it('daftar yang mencampur kedua bentuk ditolak sebagai pelanggaran kontrak', async () => {
        const { klien } = palsu({
            ok: true,
            status: 200,
            data: [partStaf, { ...partStaf, partId: ID.replace('3f', '4f'), costPrice: 0 }],
            meta: { ...META, total: 2 },
        })
        expect((await klien.daftarSparepart()).ok).toBe(false)
    })
})

describe('pengangkut browser', () => {
    it('401 membawa staf ke halaman masuk dengan ?ke= halaman ini', async () => {
        const pindah = vi.fn()
        const ambil = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ error: { code: 'unauthenticated', message: 'x' } }), {
                status: 401,
            }),
        )
        const kirim = buatPengangkutBrowser({
            awalan: '/bff/staf',
            pindahBilaSesiHabis: true,
            pindahHalaman: pindah,
            ambil,
        })
        const hasil = await kirim('/work-orders', { query: { scope: 'active' } })
        expect(hasil.ok).toBe(false)
        expect(String(ambil.mock.calls[0][0])).toBe('/bff/staf/work-orders?scope=active')
        expect(pindah).toHaveBeenCalledWith('/admin/masuk?sesi=berakhir')
    })

    it('badan dikirim sebagai JSON; koneksi putus menjadi status 0', async () => {
        const ambil = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: 1 }), { status: 201 }))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        const kirim = buatPengangkutBrowser({ awalan: '/bff', ambil })
        expect(await kirim('/public/bookings', { metode: 'POST', badan: { a: 1 } })).toEqual({
            ok: true,
            status: 201,
            data: 1,
        })
        const init = ambil.mock.calls[0][1] as RequestInit
        expect(init.body).toBe('{"a":1}')
        expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
        expect((await kirim('/public/services')).status).toBe(0)
    })
})
