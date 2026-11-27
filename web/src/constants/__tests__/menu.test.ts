// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { describe, expect, it } from 'vitest'
import {
    MENU_PANEL,
    PATH_BERANDA,
    bolehMembuka,
    halamanPanelDikenal,
    halamanTerbatas,
    itemAktif,
    menuUntuk,
} from '../menu'

// Menu per peran persis seperti rancangan ("Halaman web" dan keputusan 1-2): mekanik hanya Papan
// servis dan Rincian SPK; kasir tanpa menu khusus pemilik.

const label = (peran: Parameters<typeof menuUntuk>[0]) => menuUntuk(peran).map((m) => m.label)

describe('menu per peran', () => {
    it('pemilik melihat semua menu', () => {
        expect(label('owner')).toEqual([
            'Papan servis',
            'SPK baru',
            'Booking',
            'Pelanggan',
            'Jasa',
            'Sparepart',
            'Staf',
            'Outlet',
            'Rekap',
        ])
    })

    it('kasir tanpa menu khusus pemilik', () => {
        expect(label('cashier')).toEqual(['Papan servis', 'SPK baru', 'Booking', 'Pelanggan'])
    })

    it('mekanik hanya Papan servis', () => {
        expect(label('mechanic')).toEqual(['Papan servis'])
    })

    it('beranda semua peran adalah Papan servis', () => {
        expect(PATH_BERANDA).toBe('/admin/papan')
        expect(MENU_PANEL[0].href).toBe(PATH_BERANDA)
    })
})

describe('akses halaman', () => {
    it('rincian SPK bagian dari Papan servis dan terbuka untuk mekanik; SPK baru tidak', () => {
        expect(itemAktif('/admin/spk/S-0001', MENU_PANEL)?.label).toBe('Papan servis')
        expect(itemAktif('/admin/spk/baru', MENU_PANEL)?.label).toBe('SPK baru')
        expect(bolehMembuka('mechanic', '/admin/spk/S-0001')).toBe(true)
        expect(bolehMembuka('mechanic', '/admin/spk/baru')).toBe(false)
        expect(bolehMembuka('cashier', '/admin/spk/baru')).toBe(true)
    })

    it.each([
        '/admin/jasa',
        '/admin/sparepart',
        '/admin/sparepart/4f4f4f4f-0000-4000-8000-000000000001',
        '/admin/staf',
        '/admin/outlet',
        '/admin/rekap',
    ])('%s khusus pemilik', (path) => {
        expect(bolehMembuka('owner', path)).toBe(true)
        expect(bolehMembuka('cashier', path)).toBe(false)
        expect(bolehMembuka('mechanic', path)).toBe(false)
    })

    it.each(['/admin/booking', '/admin/pelanggan', '/admin/pelanggan/x'])(
        '%s untuk pemilik dan kasir',
        (path) => {
            expect(bolehMembuka('owner', path)).toBe(true)
            expect(bolehMembuka('cashier', path)).toBe(true)
            expect(bolehMembuka('mechanic', path)).toBe(false)
        },
    )

    it('halaman untuk semua peran tidak perlu membaca peran di middleware', () => {
        expect(halamanTerbatas('/admin/papan')).toBe(false)
        expect(halamanTerbatas('/admin/spk/S-0001')).toBe(false)
        expect(halamanTerbatas('/admin/komponen')).toBe(false)
        expect(halamanTerbatas('/admin/spk/baru')).toBe(true)
        expect(halamanTerbatas('/admin/rekap')).toBe(true)
    })

    it('awalan harus utuh per segmen', () => {
        expect(itemAktif('/admin/jasanya', MENU_PANEL)).toBeNull()
        expect(halamanPanelDikenal('/admin/jasanya')).toBe(false)
        expect(halamanPanelDikenal('/admin/komponen')).toBe(true)
    })
})
