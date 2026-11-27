// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { describe, expect, it } from 'vitest'
import { STATUS_BOOKING } from '@/skema/booking'
import { STATUS_SPK, type StatusSpk } from '@/skema/spk'
import {
    MAKS_BOOKING_MENUNGGU,
    aksiStafBooking,
    bolehAksiBooking,
    bookingSelesai,
} from '../statusBooking'
import {
    STATUS_AKTIF,
    STATUS_TERBUKA,
    TRANSISI_SPK,
    cekBatalSpk,
    cekBayarSpk,
    cekTransisiSpk,
    kembalian,
    sisaTagihan,
    spkTerbuka,
    statusBayar,
    statusTujuanSpk,
} from '../statusSpk'

// Aturan dari spec ("Status SPK", "Status booking", "StatusBayar"). Tabelnya ditulis ulang di sini dengan tangan supaya perubahan aturan yang tidak
// disengaja langsung terlihat.

describe('transisi status SPK', () => {
    it('hanya perpindahan yang tertulis di spec', () => {
        const sah: Record<StatusSpk, string[]> = {
            QUEUED: ['IN_PROGRESS'],
            IN_PROGRESS: ['WAITING_PARTS', 'DONE'],
            WAITING_PARTS: ['IN_PROGRESS'],
            DONE: ['PICKED_UP'],
            PICKED_UP: [],
            CANCELLED: [],
        }
        for (const s of STATUS_SPK) expect([...TRANSISI_SPK[s]], s).toEqual(sah[s])
    })

    it('menunggu part tidak bisa langsung selesai', () => {
        const spk = { status: 'WAITING_PARTS' as const, jumlahItem: 2, sisa: 0 }
        expect(cekTransisiSpk(spk, 'DONE')).toBe('status_transition_invalid')
    })

    it('selesai butuh minimal satu item (work_order_empty)', () => {
        expect(cekTransisiSpk({ status: 'IN_PROGRESS', jumlahItem: 0, sisa: 0 }, 'DONE')).toBe(
            'work_order_empty',
        )
        expect(cekTransisiSpk({ status: 'IN_PROGRESS', jumlahItem: 1, sisa: 5 }, 'DONE')).toBeNull()
    })

    it('diambil hanya bila lunas (not_paid_off)', () => {
        expect(cekTransisiSpk({ status: 'DONE', jumlahItem: 1, sisa: 1000 }, 'PICKED_UP')).toBe(
            'not_paid_off',
        )
        expect(cekTransisiSpk({ status: 'DONE', jumlahItem: 1, sisa: 0 }, 'PICKED_UP')).toBeNull()
    })

    it('ke status yang sama ditolak', () => {
        expect(
            cekTransisiSpk({ status: 'IN_PROGRESS', jumlahItem: 1, sisa: 0 }, 'IN_PROGRESS'),
        ).toBe('status_transition_invalid')
    })

    it('mekanik tidak pernah mendapat tombol Diambil', () => {
        expect(statusTujuanSpk('DONE', 'mechanic')).toEqual([])
        expect(statusTujuanSpk('DONE', 'cashier')).toEqual(['PICKED_UP'])
        expect(statusTujuanSpk('IN_PROGRESS', 'mechanic')).toEqual(['WAITING_PARTS', 'DONE'])
        expect(statusTujuanSpk('QUEUED', 'mechanic')).toEqual(['IN_PROGRESS'])
    })

    it('status terbuka dan aktif', () => {
        expect([...STATUS_TERBUKA]).toEqual(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS'])
        expect([...STATUS_AKTIF]).toEqual(['QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE'])
        expect(spkTerbuka('DONE')).toBe(false)
        expect(spkTerbuka('WAITING_PARTS')).toBe(true)
    })
})

describe('pembatalan dan pembayaran SPK', () => {
    it('batal hanya oleh kasir/pemilik, selama terbuka, dan tanpa pembayaran', () => {
        expect(cekBatalSpk({ status: 'QUEUED', paidAmount: 0 }, 'cashier')).toBeNull()
        expect(cekBatalSpk({ status: 'QUEUED', paidAmount: 0 }, 'mechanic')).toBe('forbidden')
        expect(cekBatalSpk({ status: 'IN_PROGRESS', paidAmount: 1 }, 'owner')).toBe('has_payments')
        expect(cekBatalSpk({ status: 'DONE', paidAmount: 0 }, 'owner')).toBe(
            'status_transition_invalid',
        )
    })

    it('bayar ditolak untuk SPK batal, sudah diambil, atau tanpa sisa', () => {
        expect(cekBayarSpk({ status: 'CANCELLED', sisa: 10 })).toBe('work_order_cancelled')
        expect(cekBayarSpk({ status: 'PICKED_UP', sisa: 10 })).toBe('already_picked_up')
        expect(cekBayarSpk({ status: 'QUEUED', sisa: 0 })).toBe('validation_failed')
        expect(cekBayarSpk({ status: 'QUEUED', sisa: 10 })).toBeNull()
    })

    it('status bayar turunan sama dengan backend, termasuk total 0 = lunas', () => {
        expect(statusBayar(0, 0)).toBe('paid')
        expect(statusBayar(1000, 0)).toBe('unpaid')
        expect(statusBayar(1000, 400)).toBe('partial')
        expect(statusBayar(1000, 1000)).toBe('paid')
    })

    it('sisa tagihan dan kembalian', () => {
        expect(sisaTagihan(165000, 50000)).toBe(115000)
        expect(sisaTagihan(100, 200)).toBe(0)
        expect(kembalian(200000, 165000)).toBe(35000)
        expect(kembalian(100000, 165000)).toBeNull()
    })
})

describe('status booking', () => {
    it('aksi staf per status', () => {
        expect(aksiStafBooking('PENDING')).toEqual(['konfirmasi', 'jadikanSpk', 'tolak'])
        expect(aksiStafBooking('CONFIRMED')).toEqual(['jadikanSpk', 'tolak'])
        for (const s of ['CONVERTED', 'REJECTED', 'CANCELLED'] as const) {
            expect(aksiStafBooking(s), s).toEqual([])
            expect(bookingSelesai(s), s).toBe(true)
        }
    })

    it('pelanggan hanya bisa membatalkan selagi menunggu', () => {
        const boleh = STATUS_BOOKING.filter((s) => bolehAksiBooking(s, 'batalPelanggan'))
        expect(boleh).toEqual(['PENDING'])
    })

    it('batas tiga booking menunggu per nomor HP', () => {
        expect(MAKS_BOOKING_MENUNGGU).toBe(3)
    })
})
