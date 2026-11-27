// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { describe, expect, it } from 'vitest'
import { rentangTanggalBooking, tambahHari, tanggalSah, tanggalWib } from '../kalender'
import { KUNCI_BOOKING, bacaBookingTersimpan, simpanBooking } from '../penyimpanan'
import {
    alamatDenganQuery,
    ambilHalaman,
    ambilUkuran,
    jumlahHalaman,
    nomorAwal,
    rentangTampil,
} from '../query'
import { inisial } from '../teks'

describe('kalender WIB', () => {
    it('tanggal WIB berganti pukul 17.00 UTC', () => {
        expect(tanggalWib(new Date('2026-11-27T16:59:59.999Z'))).toBe('2026-11-27')
        expect(tanggalWib(new Date('2026-11-27T17:00:00.000Z'))).toBe('2026-11-28')
    })

    it('rentang tanggal datang booking sama dengan contoh di spec', () => {
        // 27-11-2026 23.30 WIB -> 2026-11-27 sampai 2026-12-27.
        expect(rentangTanggalBooking(new Date('2026-11-27T16:30:00Z'))).toEqual({
            awal: '2026-11-27',
            akhir: '2026-12-27',
        })
        // 28-11-2026 00.30 WIB -> 2026-11-28 sampai 2026-12-28.
        expect(rentangTanggalBooking(new Date('2026-11-27T17:30:00Z'))).toEqual({
            awal: '2026-11-28',
            akhir: '2026-12-28',
        })
    })

    it('menambah hari melewati akhir bulan dan tahun', () => {
        expect(tambahHari('2026-12-31', 1)).toBe('2027-01-01')
        expect(tambahHari('2028-02-28', 1)).toBe('2028-02-29')
    })

    it('tanggal yang tidak ada di kalender ditolak', () => {
        expect(tanggalSah('2026-02-30')).toBe(false)
        expect(tanggalSah('2026-13-01')).toBe(false)
        expect(tanggalSah('2028-02-29')).toBe(true)
        expect(tanggalSah('27-11-2026')).toBe(false)
    })
})

describe('query halaman', () => {
    it('nilai yang tidak sah diganti bawaan', () => {
        expect(ambilHalaman('3')).toBe(3)
        expect(ambilHalaman(['2', '5'])).toBe(2)
        expect(ambilHalaman('0')).toBe(1)
        expect(ambilHalaman('-1')).toBe(1)
        expect(ambilHalaman(undefined)).toBe(1)
        expect(ambilUkuran('50')).toBe(50)
        expect(ambilUkuran('30')).toBe(20)
        expect(ambilUkuran('abc', 10)).toBe(10)
    })

    it('nomor urut kolom No berlanjut di halaman berikutnya', () => {
        expect(nomorAwal({ page: 1, limit: 20 })).toBe(1)
        expect(nomorAwal({ page: 2, limit: 20 })).toBe(21)
        expect(nomorAwal({ page: 3, limit: 10 })).toBe(21)
    })

    it('keterangan rentang dan jumlah halaman', () => {
        expect(rentangTampil({ page: 2, limit: 20, total: 45 })).toBe('Menampilkan 21–40 dari 45')
        expect(rentangTampil({ page: 3, limit: 20, total: 45 })).toBe('Menampilkan 41–45 dari 45')
        expect(rentangTampil({ page: 1, limit: 20, total: 0 })).toBe('Tidak ada data')
        expect(jumlahHalaman({ limit: 20, total: 45 })).toBe(3)
        expect(jumlahHalaman({ limit: 20, total: 0 })).toBe(1)
    })

    it('alamat dengan query membuang nilai kosong', () => {
        expect(alamatDenganQuery('/admin/pelanggan', { search: '', page: 2 })).toBe(
            '/admin/pelanggan?page=2',
        )
        expect(alamatDenganQuery('/admin/pelanggan', {})).toBe('/admin/pelanggan')
    })
})

describe('booking tersimpan di browser', () => {
    const TOKEN = 'Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk'
    const palsu = () => {
        const isi = new Map<string, string>()
        return {
            getItem: (k: string) => isi.get(k) ?? null,
            setItem: (k: string, v: string) => void isi.set(k, v),
            isi,
        }
    }

    it('menyimpan yang terbaru di depan tanpa kembar', () => {
        const s = palsu()
        simpanBooking({ token: TOKEN, nomor: 'B-0001', dibuat: 'x' }, s)
        simpanBooking({ token: TOKEN.replace('V', 'W'), nomor: 'B-0002', dibuat: 'y' }, s)
        simpanBooking({ token: TOKEN, nomor: 'B-0001', dibuat: 'z' }, s)
        expect(bacaBookingTersimpan(s).map((b) => b.nomor)).toEqual(['B-0001', 'B-0002'])
    })

    it('isi rusak atau token tidak sah dibuang diam-diam', () => {
        const s = palsu()
        s.isi.set(KUNCI_BOOKING, '{rusak')
        expect(bacaBookingTersimpan(s)).toEqual([])
        s.isi.set(KUNCI_BOOKING, JSON.stringify([{ token: 'pendek', nomor: 'B-0001', dibuat: '' }]))
        expect(bacaBookingTersimpan(s)).toEqual([])
    })

    it('penyimpanan yang diblokir tidak membuat galat', () => {
        const blokir = {
            getItem: () => {
                throw new Error('SecurityError')
            },
            setItem: () => {
                throw new Error('QuotaExceededError')
            },
        }
        expect(bacaBookingTersimpan(blokir)).toEqual([])
        expect(() =>
            simpanBooking({ token: TOKEN, nomor: 'B-0001', dibuat: '' }, blokir),
        ).not.toThrow()
        expect(bacaBookingTersimpan(null)).toEqual([])
    })
})

describe('teks', () => {
    it('inisial nama', () => {
        expect(inisial('Rina Kasir')).toBe('RK')
        expect(inisial('andi')).toBe('A')
    })
})
