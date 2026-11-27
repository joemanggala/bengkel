// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { describe, expect, it } from 'vitest'
import {
    PESAN_BAKU,
    PESAN_PERIKSA_ISIAN,
    bacaGalatApi,
    pesanGalat,
    pesanKodeField,
    petakanGalatForm,
} from '../galat'
import {
    alamatMasuk,
    alamatMasukLagi,
    alamatSesiBerakhir,
    amankanTujuan,
    cookieAman,
    opsiCookieSesi,
    tujuanSetelahMasuk,
} from '../sesi'

describe('tujuan ?ke= setelah masuk', () => {
    it('hanya halaman panel yang dikenal', () => {
        expect(amankanTujuan('/admin/spk/S-0001')).toBe('/admin/spk/S-0001')
        expect(amankanTujuan('/admin/pelanggan?page=2')).toBe('/admin/pelanggan?page=2')
        expect(amankanTujuan('/admin/komponen')).toBe('/admin/komponen')
        for (const buruk of [
            '//situs-lain.id',
            '/\\situs-lain.id',
            'https://situs-lain.id/admin/papan',
            '/admin/masuk',
            '/admin/sesi-berakhir',
            '/bff/staf/staff',
            '/servis/abc',
            '/admin/papan%2F..',
            '/admin/papan\n',
            42,
        ]) {
            expect(amankanTujuan(buruk), String(buruk)).toBeNull()
        }
    })

    it('peran yang tidak berhak atas tujuannya dibawa ke Papan servis', () => {
        expect(tujuanSetelahMasuk('owner', '/admin/rekap')).toBe('/admin/rekap')
        expect(tujuanSetelahMasuk('cashier', '/admin/rekap')).toBe('/admin/papan')
        expect(tujuanSetelahMasuk('cashier', '/admin/booking')).toBe('/admin/booking')
        expect(tujuanSetelahMasuk('mechanic', '/admin/booking')).toBe('/admin/papan')
        expect(tujuanSetelahMasuk('mechanic', '/admin/spk/baru')).toBe('/admin/papan')
        expect(tujuanSetelahMasuk('mechanic', '/admin/spk/S-0012')).toBe('/admin/spk/S-0012')
        expect(tujuanSetelahMasuk('mechanic', undefined)).toBe('/admin/papan')
    })

    it('alamat masuk dan penghapus cookie membawa halaman asal yang aman saja', () => {
        expect(alamatMasuk('/admin/booking')).toBe('/admin/masuk?ke=%2Fadmin%2Fbooking')
        expect(alamatMasuk('//jahat')).toBe('/admin/masuk')
        expect(alamatSesiBerakhir('/admin/papan')).toBe('/admin/sesi-berakhir?ke=%2Fadmin%2Fpapan')
        expect(alamatMasukLagi(null)).toBe('/admin/masuk?sesi=berakhir')
    })
})

describe('cookie sesi', () => {
    it('httpOnly, SameSite=Lax, 30 hari', () => {
        expect(opsiCookieSesi(false)).toEqual({
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            path: '/',
            maxAge: 30 * 24 * 60 * 60,
        })
    })

    it('Secure mengikuti protokol, kecuali dipaksa COOKIE_SECURE', () => {
        expect(cookieAman('https')).toBe(true)
        expect(cookieAman('https:')).toBe(true)
        expect(cookieAman('http')).toBe(false)
        expect(cookieAman('https, http')).toBe(true)
        expect(cookieAman(null)).toBe(false)
        expect(cookieAman('http', 'true')).toBe(true)
        expect(cookieAman('https', 'FALSE')).toBe(false)
    })
})

describe('pesan galat', () => {
    it('kalimat kode field memakai sapaan dan label field', () => {
        expect(pesanKodeField('required', { label: 'Plat nomor' })).toBe('Plat nomor wajib diisi.')
        expect(pesanKodeField('required', { label: 'Jenis kendaraan', pilihan: true })).toBe(
            'Jenis kendaraan wajib dipilih.',
        )
        expect(
            pesanKodeField('too_long', { label: 'Kata sandi', maks: 72, satuan: 'byte' }),
        ).toMatch(/72 byte/)
        expect(pesanKodeField('kode_baru', { label: 'X' })).toBe('X belum valid.')
    })

    it('galat validasi dari API ditempel di field yang dikenal', () => {
        const hasil = petakanGalatForm(
            {
                code: 'validation_failed',
                message: 'Data yang dikirim belum valid',
                fields: { plate: 'invalid_format', lainnya: 'required' },
            },
            { plate: { label: 'Plat nomor' } },
        )
        expect(hasil.fields).toEqual({ plate: 'Plat nomor belum sesuai format.' })
        expect(hasil.pesan).toBe(`${PESAN_PERIKSA_ISIAN} lainnya wajib diisi.`)
    })

    it('stok kurang memakai pesan dari server yang menyebut sparepart-nya', () => {
        const message =
            'Stok sparepart tidak cukup: Kampas Rem Depan Vario (butuh 3 set, tersedia 2 set)'
        expect(pesanGalat({ code: 'insufficient_stock', message })).toBe(message)
        expect(pesanGalat({ code: 'insufficient_stock', message: '' })).toBe(
            PESAN_BAKU.insufficient_stock,
        )
    })

    it('badan galat dibaca dengan curiga', () => {
        expect(bacaGalatApi('<html>')).toEqual({
            code: 'internal_error',
            message: 'Terjadi kesalahan. Coba lagi sebentar lagi.',
        })
        expect(bacaGalatApi({ error: { code: 'kode_masa_depan', message: 'Baru' } })).toEqual({
            code: 'internal_error',
            message: 'Baru',
        })
        expect(
            bacaGalatApi({
                error: { code: 'validation_failed', message: 'x', fields: { phone: 'too_short' } },
            }),
        ).toEqual({ code: 'validation_failed', message: 'x', fields: { phone: 'too_short' } })
    })
})
