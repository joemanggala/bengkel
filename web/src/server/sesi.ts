// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { PATH_AKSES_DITOLAK } from '@/constants/menu'
import type { HasilApi } from '@/klien/hasil'
import type { GalatApi } from '@/skema/galat'
import type { PeranStaf, Staf } from '@/skema/staf'
import {
    HEADER_PATH,
    NAMA_COOKIE_SESI,
    PATH_MASUK,
    alamatMasukLagi,
    alamatSesiBerakhir,
    cookieAman,
    opsiCookieSesi,
} from '@/utils/sesi'
import { klienServer } from './pengangkut'

// Sesi staf di sisi server: token ada di cookie httpOnly, sedangkan peran SELALU dibaca dari
// backend (GET /api/staff/me) pada setiap permintaan, bukan dari cookie. Dengan begitu peran yang
// diubah pemilik langsung berlaku, dan cookie yang dipalsukan tidak memberi akses apa pun.

// Kelompok peran yang sering dipakai penjaga halaman.
export const PERAN_KASIR: readonly PeranStaf[] = ['owner', 'cashier']
export const PERAN_PEMILIK: readonly PeranStaf[] = ['owner']

export const ambilToken = async (): Promise<string | null> =>
    (await cookies()).get(NAMA_COOKIE_SESI)?.value || null

// Hanya boleh dipanggil dari server action atau route handler; server component tidak bisa
// mengubah cookie.
export const simpanToken = async (token: string): Promise<void> => {
    const protokol = (await headers()).get('x-forwarded-proto')
    ;(await cookies()).set(
        NAMA_COOKIE_SESI,
        token,
        opsiCookieSesi(cookieAman(protokol, process.env.COOKIE_SECURE)),
    )
}

// Path halaman yang sedang dibuka, dipasang middleware di header permintaan (lihat middleware.ts).
const pathSekarang = async (): Promise<string | null> => (await headers()).get(HEADER_PATH)

export const hapusToken = async (): Promise<void> => {
    ;(await cookies()).delete({ name: NAMA_COOKIE_SESI, path: '/' })
}

export type KeadaanSesi =
    | { status: 'tamu' }
    | { status: 'masuk'; staf: Staf; token: string }
    | { status: 'habis' }
    | { status: 'gagal'; galat: GalatApi }

export type SesiAktif = { staf: Staf; token: string }

// cache() membuat layout, halaman, dan action dalam satu permintaan cukup bertanya profil ke
// backend sekali.
export const bacaSesi = cache(async (): Promise<KeadaanSesi> => {
    const token = await ambilToken()
    if (!token) return { status: 'tamu' }
    const hasil = await klienServer(token).stafSaya()
    if (hasil.ok) return { status: 'masuk', staf: hasil.data, token }
    if (hasil.status === 401) return { status: 'habis' }
    return { status: 'gagal', galat: hasil.galat }
})

export class GalatSesi extends Error {
    constructor(galat: GalatApi) {
        super(galat.message)
        this.name = 'GalatSesi'
    }
}

// Untuk server component: cookie tidak bisa dihapus di sini, jadi sesi yang habis diarahkan
// ke route handler yang menghapus cookie lalu membuka halaman masuk.
export async function wajibStaf(): Promise<SesiAktif> {
    const sesi = await bacaSesi()
    if (sesi.status === 'tamu') redirect(PATH_MASUK)
    if (sesi.status === 'habis') redirect(alamatSesiBerakhir(await pathSekarang()))
    if (sesi.status === 'gagal') throw new GalatSesi(sesi.galat)
    return sesi
}

// Pemeriksaan peran diulang di setiap halaman yang tidak untuk semua peran, tidak hanya di
// layout: berpindah antarhalaman di panel bisa merender halaman tanpa merender ulang layout-nya.
// Ini juga penjaga yang sebenarnya; pemeriksaan di middleware hanya lapisan pertama.
export async function wajibPeran(peran: readonly PeranStaf[]): Promise<SesiAktif> {
    const sesi = await wajibStaf()
    if (!peran.includes(sesi.staf.role)) redirect(PATH_AKSES_DITOLAK)
    return sesi
}

// Halaman pemilik dan kasir (SPK baru, Booking, Pelanggan): mekanik dialihkan.
export const wajibKasir = (): Promise<SesiAktif> => wajibPeran(PERAN_KASIR)

// Halaman khusus pemilik (Jasa, Sparepart, Staf, Outlet, Rekap).
export const wajibPemilik = (): Promise<SesiAktif> => wajibPeran(PERAN_PEMILIK)

type HasilWajibAksi = { ok: true; sesi: SesiAktif } | { ok: false; pesan: string }

// Untuk server action: action bisa dipanggil langsung tanpa melewati halaman, jadi sesi dan
// peran diperiksa lagi, dan cookie sesi yang sudah habis langsung dihapus. Backend yang tidak
// bisa dihubungi dikembalikan sebagai pesan, bukan dilempar, supaya form bisa menampilkannya.
export async function wajibStafAksi(peran?: readonly PeranStaf[]): Promise<HasilWajibAksi> {
    const sesi = await bacaSesi()
    if (sesi.status === 'tamu') redirect(PATH_MASUK)
    if (sesi.status === 'habis') {
        await hapusToken()
        redirect(alamatMasukLagi(await pathSekarang()))
    }
    if (sesi.status === 'gagal') return { ok: false, pesan: sesi.galat.message }
    if (peran && !peran.includes(sesi.staf.role)) redirect(PATH_AKSES_DITOLAK)
    return { ok: true, sesi }
}

// Untuk server component setelah memanggil API: sesi yang ditolak (401) diarahkan ke route
// penghapus cookie, peran yang tidak berhak (403) ke Papan servis.
export async function arahkanBilaDitolak(hasil: HasilApi<unknown>): Promise<void> {
    if (hasil.ok) return
    if (hasil.status === 401) redirect(alamatSesiBerakhir(await pathSekarang()))
    if (hasil.status === 403) redirect(PATH_AKSES_DITOLAK)
}

// Versi server action: cookie boleh dihapus langsung di sini.
export async function arahkanBilaDitolakAksi(hasil: HasilApi<unknown>): Promise<void> {
    if (hasil.ok) return
    if (hasil.status === 401) {
        await hapusToken()
        redirect(alamatMasukLagi(await pathSekarang()))
    }
    if (hasil.status === 403) redirect(PATH_AKSES_DITOLAK)
}
