// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { describe, expect, it } from 'vitest'
import { opsiMekanik } from '@/components/ui/useMekanik'
import { periksaKendaraan, periksaPelanggan } from '@/components/pelanggan/logika'
import { periksaBooking, isianBookingKosong } from '@/components/publik/logika/booking'
import { formatDurasi } from '@/components/publik/DaftarJasa'
import { periksaDataSpk } from '@/components/spk/logika'
import {
    bacaBilangan,
    periksaBilangan,
    periksaTeks,
    waktuApiKeLokal,
    waktuLokalKeApi,
} from '@/utils/validasi'

const RENTANG = { awal: '2026-11-27', akhir: '2026-12-27' }
const BOOKING_SAH = {
    ...isianBookingKosong(),
    customerName: ' Budi Santoso ',
    phone: '0812-3456-7890',
    vehicleType: 'MOTOR' as const,
    plate: 'b 1234 xyz',
    vehicleBrand: 'Honda',
    visitDate: '2026-11-28',
    complaint: 'Rem depan bunyi.\nSekalian ganti oli.',
}

describe('form booking publik', () => {
    it('isian sah dirapikan; nomor HP dan plat dikirim seperti diketik', () => {
        const hasil = periksaBooking(BOOKING_SAH, RENTANG)
        expect(hasil.ok && hasil.badan).toEqual({
            customerName: 'Budi Santoso',
            phone: '0812-3456-7890',
            vehicleType: 'MOTOR',
            plate: 'b 1234 xyz',
            vehicleBrand: 'Honda',
            vehicleModel: '',
            serviceId: null,
            visitDate: '2026-11-28',
            complaint: 'Rem depan bunyi.\nSekalian ganti oli.',
        })
    })

    it('form kosong melaporkan semua kolom wajib sekaligus', () => {
        const hasil = periksaBooking(isianBookingKosong(), RENTANG)
        expect(hasil.ok).toBe(false)
        if (hasil.ok) return
        expect(Object.keys(hasil.fields).sort()).toEqual(
            [
                'complaint',
                'customerName',
                'phone',
                'plate',
                'vehicleBrand',
                'vehicleType',
                'visitDate',
            ].sort(),
        )
    })

    it('tanggal di luar hari ini sampai 30 hari ditolak, tanggal tidak ada di kalender juga', () => {
        for (const visitDate of ['2026-11-26', '2026-12-28', '2026-02-30']) {
            const hasil = periksaBooking({ ...BOOKING_SAH, visitDate }, RENTANG)
            expect(hasil.ok, visitDate).toBe(false)
        }
        expect(periksaBooking({ ...BOOKING_SAH, visitDate: '2026-12-27' }, RENTANG).ok).toBe(true)
    })

    it('karakter kontrol di nama ditolak; tab dan baris baru di keluhan boleh', () => {
        const nama = periksaBooking({ ...BOOKING_SAH, customerName: 'Budi\tSantoso' }, RENTANG)
        expect(!nama.ok && nama.fields.customerName).toMatch(/format/)
        const arah = periksaBooking({ ...BOOKING_SAH, vehicleBrand: 'Hon\u202eda' }, RENTANG)
        expect(arah.ok).toBe(false)
        expect(periksaBooking({ ...BOOKING_SAH, complaint: 'a\tb\r\nc' }, RENTANG).ok).toBe(true)
        expect(periksaBooking({ ...BOOKING_SAH, complaint: 'a\u0007b' }, RENTANG).ok).toBe(false)
    })
})

describe('form pelanggan dan kendaraan', () => {
    it('nomor HP salah dan nama pendek ditolak', () => {
        const hasil = periksaPelanggan({ name: 'A', phone: '021-555', address: '', notes: '' })
        expect(!hasil.ok && Object.keys(hasil.fields).sort()).toEqual(['name', 'phone'])
    })

    it('kendaraan: tahun opsional dalam 1900..2100, plat dinormalkan backend', () => {
        const sah = periksaKendaraan({
            type: 'CAR',
            plate: 'D 1',
            brand: 'Toyota',
            model: '',
            year: '',
            color: '',
        })
        expect(sah.ok && sah.badan.year).toBeNull()
        const tahun = periksaKendaraan({
            type: 'CAR',
            plate: 'D 1',
            brand: 'Toyota',
            model: '',
            year: '1850',
            color: '',
        })
        expect(!tahun.ok && tahun.fields.year).toMatch(/1900/)
        const tanpaJenis = periksaKendaraan({
            type: '',
            plate: '1234',
            brand: '',
            model: '',
            year: '',
            color: '',
        })
        expect(!tanpaJenis.ok && Object.keys(tanpaJenis.fields).sort()).toEqual([
            'brand',
            'plate',
            'type',
        ])
    })
})

describe('form data SPK', () => {
    it('estimasi dikirim sebagai waktu WIB +07:00; kosong = null', () => {
        const hasil = periksaDataSpk({
            complaint: ' Servis rutin ',
            odometer: '18.250',
            estimatedDoneAt: '2026-11-28T15:00',
            mechanicId: '',
        })
        expect(hasil.ok && hasil.badan).toEqual({
            complaint: 'Servis rutin',
            odometer: 18250,
            estimatedDoneAt: '2026-11-28T15:00:00+07:00',
            mechanicId: null,
        })
    })

    it('menjadikan booking SPK tidak butuh keluhan', () => {
        const isian = { complaint: '', odometer: '', estimatedDoneAt: '', mechanicId: '' }
        expect(periksaDataSpk(isian).ok).toBe(false)
        expect(periksaDataSpk(isian, true).ok).toBe(true)
    })

    it('mekanik nonaktif yang tertera di SPK tetap muncul sebagai pilihan', () => {
        const aktif = [{ staffId: 'a', name: 'Andi' }]
        expect(opsiMekanik(aktif, { staffId: 'b', name: 'Budi' })).toEqual([
            { nilai: 'a', label: 'Andi' },
            { nilai: 'b', label: 'Budi (nonaktif)' },
        ])
        expect(opsiMekanik(aktif, { staffId: 'a', name: 'Andi' })).toHaveLength(1)
    })
})

describe('pembantu isian', () => {
    it('bilangan dari isian rupiah dan angka', () => {
        expect(bacaBilangan('15.000')).toBe(15000)
        expect(bacaBilangan(' ')).toBeNull()
        expect(bacaBilangan('1,5')).toBeNaN()
        expect(periksaBilangan('0', { label: 'Jumlah', min: 1, maks: 99 })).toEqual({
            ok: false,
            pesan: 'Jumlah harus di antara 1 dan 99.',
        })
        expect(
            periksaBilangan('', { label: 'Tahun', min: 1900, maks: 2100, opsional: true }),
        ).toEqual({
            ok: true,
            nilai: null,
        })
    })

    it('teks opsional kosong sah, yang terisi tetap dibatasi', () => {
        expect(periksaTeks('', { label: 'Catatan', maks: 5, opsional: true })).toBeNull()
        expect(periksaTeks('panjang sekali', { label: 'Catatan', maks: 5, opsional: true })).toBe(
            'Catatan maksimal 5 karakter.',
        )
    })

    it('waktu WIB bolak-balik antara isian dan API', () => {
        expect(waktuLokalKeApi('2026-11-28T08:05')).toBe('2026-11-28T08:05:00+07:00')
        expect(waktuLokalKeApi('salah')).toBeNull()
        expect(waktuApiKeLokal('2026-11-28T01:05:00.000Z')).toBe('2026-11-28T08:05')
        expect(waktuApiKeLokal(null)).toBe('')
    })

    it('durasi jasa', () => {
        expect(formatDurasi(30)).toBe('30 menit')
        expect(formatDurasi(120)).toBe('2 jam')
        expect(formatDurasi(90)).toBe('1 jam 30 menit')
    })
})
