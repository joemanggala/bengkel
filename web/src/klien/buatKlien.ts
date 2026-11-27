// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import {
    skemaBooking,
    skemaBookingDibuat,
    skemaBookingPublik,
    skemaHasilJadikanSpk,
} from '@/skema/booking'
import { skemaJasa, skemaJasaPublik } from '@/skema/jasa'
import { skemaMeta } from '@/skema/meta'
import { skemaOutlet } from '@/skema/outlet'
import { skemaKendaraan, skemaKendaraanDenganPemilik, skemaPelanggan } from '@/skema/pelanggan'
import { skemaRekapHarian } from '@/skema/rekap'
import {
    skemaDaftarSparepart,
    skemaPergerakanStok,
    skemaSparepartPemilik,
    type Sparepart,
} from '@/skema/sparepart'
import { skemaSpkDetail, skemaSpkPublik, skemaSpkRingkas } from '@/skema/spk'
import { skemaAuthStaf, skemaStaf, skemaStafRingkas, skemaStatusSetup } from '@/skema/staf'
import { GALAT_KONTRAK } from './balasan'
import type { HasilApi } from './hasil'
import type { HasilDaftar, KlienApi } from './antarmuka'
import type { OpsiPanggil, Pengangkut } from './pengangkut'

// Implementasi KlienApi di atas sebuah Pengangkut. Setiap metode: (1) memilih rute dan metode
// HTTP menurut spec, (2) memanggil pengangkut, (3) memeriksa bentuk balasan sukses terhadap skema
// zod di src/skema. Balasan yang menyimpang dari kontrak menjadi galat yang jelas
// (GALAT_KONTRAK), bukan data setengah rusak yang baru meledak di komponen.

// Id, nomor SPK, dan token masuk ke path, jadi di-encode walau bentuk sahnya sudah aman.
const e = encodeURIComponent

function periksa<S extends z.ZodType>(hasil: HasilApi<unknown>, skema: S): HasilApi<z.output<S>> {
    if (!hasil.ok) return hasil
    const cek = skema.safeParse(hasil.data)
    if (!cek.success) return { ok: false, status: hasil.status, galat: GALAT_KONTRAK }
    return { ok: true, status: hasil.status, data: cek.data }
}

// Balasan 204 (keluar) tidak punya badan.
function periksaKosong(hasil: HasilApi<unknown>): HasilApi<undefined> {
    if (!hasil.ok) return hasil
    return { ok: true, status: hasil.status, data: undefined }
}

// Daftar berpaginasi: isi `data` diperiksa dengan `skemaLarik` (larik utuh, supaya aturan seperti
// "tidak mencampur bentuk" bisa diperiksa), dan `meta` wajib ada.
function periksaDaftar<S extends z.ZodType<unknown[]>>(
    hasil: HasilApi<unknown>,
    skemaLarik: S,
): HasilDaftar<z.output<S>[number]> {
    if (!hasil.ok) return hasil
    const data = skemaLarik.safeParse(hasil.data)
    const meta = skemaMeta.safeParse(hasil.meta)
    if (!data.success || !meta.success) {
        return { ok: false, status: hasil.status, galat: GALAT_KONTRAK }
    }
    return { ok: true, status: hasil.status, data: data.data, meta: meta.data }
}

const post = (badan?: unknown): OpsiPanggil => ({ metode: 'POST', badan })
const patch = (badan: unknown): OpsiPanggil => ({ metode: 'PATCH', badan })

export function buatKlien(kirim: Pengangkut): KlienApi {
    const spk = async (rute: string, opsi?: OpsiPanggil) =>
        periksa(await kirim(rute, opsi), skemaSpkDetail)
    const part = async (rute: string, opsi?: OpsiPanggil) =>
        periksa(await kirim(rute, opsi), skemaSparepartPemilik)
    const booking = async (rute: string, opsi?: OpsiPanggil) =>
        periksa(await kirim(rute, opsi), skemaBooking)

    return {
        statusSetup: async () => periksa(await kirim('/setup'), skemaStatusSetup),
        pasangAwal: async (isian) => periksa(await kirim('/setup', post(isian)), skemaAuthStaf),
        masukStaf: async (isian) =>
            periksa(await kirim('/staff/login', post(isian)), skemaAuthStaf),
        keluarStaf: async () => periksaKosong(await kirim('/staff/logout', post())),
        stafSaya: async () => periksa(await kirim('/staff/me'), skemaStaf),
        daftarStaf: async () => periksa(await kirim('/staff'), z.array(skemaStaf)),
        buatStaf: async (isian) => periksa(await kirim('/staff', post(isian)), skemaStaf),
        ubahStaf: async (staffId, isian) =>
            periksa(await kirim(`/staff/${e(staffId)}`, patch(isian)), skemaStaf),
        daftarMekanik: async () => periksa(await kirim('/mechanics'), z.array(skemaStafRingkas)),

        profilOutlet: async () => periksa(await kirim('/outlet'), skemaOutlet),
        ubahOutlet: async (isian) =>
            periksa(await kirim('/outlet', { metode: 'PUT', badan: isian }), skemaOutlet),

        jasaPublik: async () => periksa(await kirim('/public/services'), z.array(skemaJasaPublik)),
        buatBookingPublik: async (isian) =>
            periksa(await kirim('/public/bookings', post(isian)), skemaBookingDibuat),
        detailBookingPublik: async (token) =>
            periksa(await kirim(`/public/bookings/${e(token)}`), skemaBookingPublik),
        batalkanBookingPublik: async (token) =>
            periksa(await kirim(`/public/bookings/${e(token)}/cancel`, post()), skemaBookingPublik),
        lacakServisPublik: async (token) =>
            periksa(await kirim(`/public/work-orders/${e(token)}`), skemaSpkPublik),

        daftarPelanggan: async (parameter) =>
            periksaDaftar(await kirim('/customers', { query: parameter }), z.array(skemaPelanggan)),
        buatPelanggan: async (isian) =>
            periksa(await kirim('/customers', post(isian)), skemaPelanggan),
        detailPelanggan: async (customerId) =>
            periksa(await kirim(`/customers/${e(customerId)}`), skemaPelanggan),
        ubahPelanggan: async (customerId, isian) =>
            periksa(await kirim(`/customers/${e(customerId)}`, patch(isian)), skemaPelanggan),
        tambahKendaraan: async (customerId, isian) =>
            periksa(
                await kirim(`/customers/${e(customerId)}/vehicles`, post(isian)),
                skemaKendaraan,
            ),
        cariKendaraan: async (plate, parameter) =>
            periksaDaftar(
                await kirim('/vehicles', { query: { ...parameter, plate } }),
                z.array(skemaKendaraanDenganPemilik),
            ),
        ubahKendaraan: async (vehicleId, isian) =>
            periksa(await kirim(`/vehicles/${e(vehicleId)}`, patch(isian)), skemaKendaraan),
        riwayatServisKendaraan: async (vehicleId, parameter) =>
            periksaDaftar(
                await kirim(`/vehicles/${e(vehicleId)}/work-orders`, { query: parameter }),
                z.array(skemaSpkRingkas),
            ),

        daftarJasa: async (parameter) =>
            periksa(await kirim('/services', { query: parameter }), z.array(skemaJasa)),
        buatJasa: async (isian) => periksa(await kirim('/services', post(isian)), skemaJasa),
        ubahJasa: async (serviceId, isian) =>
            periksa(await kirim(`/services/${e(serviceId)}`, patch(isian)), skemaJasa),

        daftarSparepart: async (parameter) =>
            periksaDaftar<z.ZodType<Sparepart[]>>(
                await kirim('/parts', { query: parameter }),
                skemaDaftarSparepart,
            ),
        buatSparepart: async (isian) => part('/parts', post(isian)),
        ubahSparepart: async (partId, isian) => part(`/parts/${e(partId)}`, patch(isian)),
        daftarPergerakanStok: async (partId, parameter) =>
            periksaDaftar(
                await kirim(`/parts/${e(partId)}/movements`, { query: parameter }),
                z.array(skemaPergerakanStok),
            ),
        stokMasuk: async (partId, isian) => part(`/parts/${e(partId)}/stock-in`, post(isian)),
        stokKeluar: async (partId, isian) => part(`/parts/${e(partId)}/stock-out`, post(isian)),
        hitungStok: async (partId, isian) => part(`/parts/${e(partId)}/stock-count`, post(isian)),

        daftarBooking: async (parameter) =>
            periksaDaftar(await kirim('/bookings', { query: parameter }), z.array(skemaBooking)),
        detailBooking: async (bookingId) => booking(`/bookings/${e(bookingId)}`),
        konfirmasiBooking: async (bookingId) =>
            booking(`/bookings/${e(bookingId)}/confirm`, post()),
        tolakBooking: async (bookingId, isian) =>
            booking(`/bookings/${e(bookingId)}/reject`, post(isian)),
        // Badan wajib berupa objek JSON (boleh {}), jadi tanpa isian tetap dikirim {}.
        jadikanSpk: async (bookingId, isian = {}) =>
            periksa(
                await kirim(`/bookings/${e(bookingId)}/convert`, post(isian)),
                skemaHasilJadikanSpk,
            ),

        daftarSpk: async (parameter) =>
            periksaDaftar(
                await kirim('/work-orders', { query: parameter }),
                z.array(skemaSpkRingkas),
            ),
        buatSpk: async (isian) => spk('/work-orders', post(isian)),
        detailSpk: async (nomor) => spk(`/work-orders/${e(nomor)}`),
        ubahSpk: async (nomor, isian) => spk(`/work-orders/${e(nomor)}`, patch(isian)),
        ubahStatusSpk: async (nomor, isian) => spk(`/work-orders/${e(nomor)}/status`, post(isian)),
        batalkanSpk: async (nomor, isian) => spk(`/work-orders/${e(nomor)}/cancel`, post(isian)),
        tambahItemSpk: async (nomor, isian) => spk(`/work-orders/${e(nomor)}/items`, post(isian)),
        hapusItemSpk: async (nomor, itemId) =>
            spk(`/work-orders/${e(nomor)}/items/${e(itemId)}`, { metode: 'DELETE' }),
        catatPembayaran: async (nomor, isian) =>
            spk(`/work-orders/${e(nomor)}/payments`, post(isian)),
        kirimWaSpk: async (nomor, isian) => spk(`/work-orders/${e(nomor)}/wa`, post(isian)),
        buatUlangTautanLacak: async (nomor) =>
            spk(`/work-orders/${e(nomor)}/tracking-link`, post()),

        rekapHarian: async (tanggal) =>
            periksa(await kirim('/reports/daily', { query: { date: tanggal } }), skemaRekapHarian),
    }
}
