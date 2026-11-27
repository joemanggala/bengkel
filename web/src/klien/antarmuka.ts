// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type {
    Booking,
    BookingDibuat,
    BookingPublik,
    BuatBookingRequest,
    HasilJadikanSpk,
    JadikanSpkRequest,
    StatusBooking,
    TolakBookingRequest,
} from '@/skema/booking'
import type { GalatApi } from '@/skema/galat'
import type { BuatJasaRequest, Jasa, JasaPublik, UbahJasaRequest } from '@/skema/jasa'
import type { Meta } from '@/skema/meta'
import type { Outlet, UbahOutletRequest } from '@/skema/outlet'
import type {
    BuatKendaraanRequest,
    BuatPelangganRequest,
    Kendaraan,
    KendaraanDenganPemilik,
    Pelanggan,
    UbahKendaraanRequest,
    UbahPelangganRequest,
} from '@/skema/pelanggan'
import type { RekapHarian } from '@/skema/rekap'
import type {
    BuatSparepartRequest,
    HitungStokRequest,
    PergerakanStok,
    Sparepart,
    SparepartPemilik,
    StokKeluarRequest,
    StokMasukRequest,
    UbahSparepartRequest,
} from '@/skema/sparepart'
import type {
    BatalSpkRequest,
    BayarRequest,
    BuatSpkRequest,
    KirimWaRequest,
    SpkDetail,
    SpkPublik,
    SpkRingkas,
    StatusSpk,
    TambahItemRequest,
    UbahSpkRequest,
    UbahStatusSpkRequest,
} from '@/skema/spk'
import type {
    AuthStaf,
    BuatStafRequest,
    MasukStafRequest,
    SetupRequest,
    Staf,
    StafRingkas,
    StatusSetup,
    UbahStafRequest,
} from '@/skema/staf'
import type { HasilApi } from './hasil'

// Antarmuka klien API: SATU metode untuk setiap operationId di spec/openapi.yaml (52 operasi,
// kecuali GET /api/health yang bukan untuk web). Halaman dan komponen bergantung pada antarmuka
// ini, bukan pada fetch, sehingga tes bisa memakai klien palsu dan bentuk data selalu mengikuti
// spec. Implementasinya ada di buatKlien.ts. Nama metode sama dengan operationId di spec.

// Daftar berpaginasi selalu membawa `meta`.
export type HasilDaftar<T> =
    | { ok: true; status: number; data: T[]; meta: Meta }
    | { ok: false; status: number; galat: GalatApi; retryAfter?: number }

// page 1..1.000.000, limit 1..50 (bawaan backend 20).
export type ParameterHalaman = { page?: number; limit?: number }

export type ParameterDaftarSpk = ParameterHalaman & {
    status?: StatusSpk
    // active = masih di bengkel (QUEUED..DONE); history = PICKED_UP dan CANCELLED.
    scope?: 'active' | 'history'
    // Diabaikan backend bila yang meminta mekanik (mekanik selalu hanya melihat SPK miliknya).
    mechanicId?: string
    // Tanggal WIB YYYY-MM-DD (tanggal SPK dibuat).
    date?: string
    sort?: 'newest' | 'oldest'
    // Nomor SPK, plat, nama pelanggan, atau nomor HP.
    search?: string
}

export type ParameterDaftarBooking = ParameterHalaman & {
    status?: StatusBooking
    visitDate?: string
    // Nomor booking, nama pemesan, nomor HP, atau plat.
    search?: string
}

export type ParameterDaftarPelanggan = ParameterHalaman & { search?: string }

export type ParameterDaftarJasa = { search?: string; isActive?: 'true' | 'false' }

export type ParameterDaftarSparepart = ParameterHalaman & {
    search?: string
    isActive?: 'true' | 'false'
    lowStock?: 'true' | 'false'
}

export type KlienApi = {
    // Setup dan staf.
    statusSetup(): Promise<HasilApi<StatusSetup>>
    pasangAwal(isian: SetupRequest): Promise<HasilApi<AuthStaf>>
    masukStaf(isian: MasukStafRequest): Promise<HasilApi<AuthStaf>>
    keluarStaf(): Promise<HasilApi<undefined>>
    stafSaya(): Promise<HasilApi<Staf>>
    daftarStaf(): Promise<HasilApi<Staf[]>>
    buatStaf(isian: BuatStafRequest): Promise<HasilApi<Staf>>
    ubahStaf(staffId: string, isian: UbahStafRequest): Promise<HasilApi<Staf>>
    daftarMekanik(): Promise<HasilApi<StafRingkas[]>>

    // Outlet.
    profilOutlet(): Promise<HasilApi<Outlet>>
    ubahOutlet(isian: UbahOutletRequest): Promise<HasilApi<Outlet>>

    // Publik (tanpa token).
    jasaPublik(): Promise<HasilApi<JasaPublik[]>>
    buatBookingPublik(isian: BuatBookingRequest): Promise<HasilApi<BookingDibuat>>
    detailBookingPublik(bookingToken: string): Promise<HasilApi<BookingPublik>>
    batalkanBookingPublik(bookingToken: string): Promise<HasilApi<BookingPublik>>
    lacakServisPublik(trackingToken: string): Promise<HasilApi<SpkPublik>>

    // Pelanggan dan kendaraan.
    daftarPelanggan(parameter?: ParameterDaftarPelanggan): Promise<HasilDaftar<Pelanggan>>
    buatPelanggan(isian: BuatPelangganRequest): Promise<HasilApi<Pelanggan>>
    detailPelanggan(customerId: string): Promise<HasilApi<Pelanggan>>
    ubahPelanggan(customerId: string, isian: UbahPelangganRequest): Promise<HasilApi<Pelanggan>>
    tambahKendaraan(customerId: string, isian: BuatKendaraanRequest): Promise<HasilApi<Kendaraan>>
    cariKendaraan(
        plate: string,
        parameter?: ParameterHalaman,
    ): Promise<HasilDaftar<KendaraanDenganPemilik>>
    ubahKendaraan(vehicleId: string, isian: UbahKendaraanRequest): Promise<HasilApi<Kendaraan>>
    riwayatServisKendaraan(
        vehicleId: string,
        parameter?: ParameterHalaman,
    ): Promise<HasilDaftar<SpkRingkas>>

    // Jasa.
    daftarJasa(parameter?: ParameterDaftarJasa): Promise<HasilApi<Jasa[]>>
    buatJasa(isian: BuatJasaRequest): Promise<HasilApi<Jasa>>
    ubahJasa(serviceId: string, isian: UbahJasaRequest): Promise<HasilApi<Jasa>>

    // Sparepart dan stok. Daftar untuk pemilik berisi SparepartPemilik (dengan costPrice), untuk
    // kasir dan mekanik SparepartStaf; rute tulis khusus pemilik selalu membalas SparepartPemilik.
    daftarSparepart(parameter?: ParameterDaftarSparepart): Promise<HasilDaftar<Sparepart>>
    buatSparepart(isian: BuatSparepartRequest): Promise<HasilApi<SparepartPemilik>>
    ubahSparepart(partId: string, isian: UbahSparepartRequest): Promise<HasilApi<SparepartPemilik>>
    daftarPergerakanStok(
        partId: string,
        parameter?: ParameterHalaman,
    ): Promise<HasilDaftar<PergerakanStok>>
    stokMasuk(partId: string, isian: StokMasukRequest): Promise<HasilApi<SparepartPemilik>>
    stokKeluar(partId: string, isian: StokKeluarRequest): Promise<HasilApi<SparepartPemilik>>
    hitungStok(partId: string, isian: HitungStokRequest): Promise<HasilApi<SparepartPemilik>>

    // Booking (staf).
    daftarBooking(parameter?: ParameterDaftarBooking): Promise<HasilDaftar<Booking>>
    detailBooking(bookingId: string): Promise<HasilApi<Booking>>
    konfirmasiBooking(bookingId: string): Promise<HasilApi<Booking>>
    tolakBooking(bookingId: string, isian: TolakBookingRequest): Promise<HasilApi<Booking>>
    jadikanSpk(bookingId: string, isian?: JadikanSpkRequest): Promise<HasilApi<HasilJadikanSpk>>

    // SPK.
    daftarSpk(parameter?: ParameterDaftarSpk): Promise<HasilDaftar<SpkRingkas>>
    buatSpk(isian: BuatSpkRequest): Promise<HasilApi<SpkDetail>>
    detailSpk(nomor: string): Promise<HasilApi<SpkDetail>>
    ubahSpk(nomor: string, isian: UbahSpkRequest): Promise<HasilApi<SpkDetail>>
    ubahStatusSpk(nomor: string, isian: UbahStatusSpkRequest): Promise<HasilApi<SpkDetail>>
    batalkanSpk(nomor: string, isian: BatalSpkRequest): Promise<HasilApi<SpkDetail>>
    tambahItemSpk(nomor: string, isian: TambahItemRequest): Promise<HasilApi<SpkDetail>>
    hapusItemSpk(nomor: string, itemId: string): Promise<HasilApi<SpkDetail>>
    catatPembayaran(nomor: string, isian: BayarRequest): Promise<HasilApi<SpkDetail>>
    kirimWaSpk(nomor: string, isian: KirimWaRequest): Promise<HasilApi<SpkDetail>>
    buatUlangTautanLacak(nomor: string): Promise<HasilApi<SpkDetail>>

    // Rekap (pemilik). Tanggal WIB YYYY-MM-DD.
    rekapHarian(tanggal: string): Promise<HasilApi<RekapHarian>>
}
