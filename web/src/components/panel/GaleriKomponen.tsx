// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState, type ReactNode } from 'react'
import AreaCetak, { TombolCetak } from '@/components/cetak/AreaCetak'
import NotaThermal from '@/components/cetak/NotaThermal'
import Dialog from '@/components/ui/Dialog'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import JudulHalaman from '@/components/ui/JudulHalaman'
import KeadaanKosong from '@/components/ui/KeadaanKosong'
import Kartu, { KartuAngka } from '@/components/ui/Kartu'
import KotakPesan from '@/components/ui/KotakPesan'
import {
    LencanaBayar,
    LencanaLevelStok,
    LencanaStatusBooking,
    LencanaStatusSpk,
} from '@/components/ui/Lencana'
import Paginasi from '@/components/ui/Paginasi'
import Skeleton, { SkeletonTabel } from '@/components/ui/Skeleton'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import Textarea from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import TombolIkon from '@/components/ui/TombolIkon'
import { DAFTAR_SPK_CONTOH, OUTLET_CONTOH, SPK_CONTOH } from '@/constants/contoh'
import { STATUS_BOOKING } from '@/skema/booking'
import { LEVEL_STOK } from '@/skema/sparepart'
import { STATUS_BAYAR, STATUS_SPK, type SpkRingkas } from '@/skema/spk'
import { formatKendaraan, formatRupiah } from '@/utils/format'
import { nomorAwal } from '@/utils/query'

// Galeri komponen dasar: semua bahan UI dalam satu halaman, untuk memeriksa tampilan (HP 360 px,
// tablet 768 px, laptop 1280 px) dan sebagai contoh pemakaiannya. Datanya contoh, bukan dari
// backend. Halaman ini tidak ada di menu; buka lewat /admin/komponen. Aman dihapus bersama
// src/constants/contoh.ts bila tidak diperlukan.

function Bagian({ judul, children }: { judul: string; children: ReactNode }) {
    return (
        <section aria-labelledby={`g-${judul}`} className="mb-10">
            <h2 id={`g-${judul}`} className="mb-3 text-lg font-bold">
                {judul}
            </h2>
            {children}
        </section>
    )
}

const KOLOM: KolomTabel<SpkRingkas>[] = [
    {
        kunci: 'nomor',
        judul: 'Nomor',
        isi: (s) => <span className="whitespace-nowrap font-bold">{s.number}</span>,
    },
    { kunci: 'kendaraan', judul: 'Kendaraan', isi: (s) => formatKendaraan(s.vehicle) },
    { kunci: 'pelanggan', judul: 'Pelanggan', sembunyiSempit: true, isi: (s) => s.customer.name },
    { kunci: 'status', judul: 'Status', isi: (s) => <LencanaStatusSpk status={s.status} /> },
    { kunci: 'bayar', judul: 'Bayar', isi: (s) => <LencanaBayar status={s.paymentStatus} /> },
    { kunci: 'total', judul: 'Total', angka: true, isi: (s) => formatRupiah(s.total) },
]

export default function GaleriKomponen() {
    const { tampilkanToast } = useToast()
    const [dialog, setDialog] = useState(false)
    const [halaman, setHalaman] = useState(1)
    const [ukuran, setUkuran] = useState(10)
    // Paginasi contoh di atas enam baris yang sama, seolah-olah ada 45 SPK.
    const meta = { page: halaman, limit: ukuran, total: 45 }

    return (
        <>
            <JudulHalaman
                judul="Komponen"
                petunjuk="Contoh semua komponen dasar panel dan website. Data di halaman ini contoh, bukan dari server."
                aksi={<Tombol onClick={() => setDialog(true)}>Buka dialog</Tombol>}
            />

            <Bagian judul="Tombol">
                <div className="flex flex-wrap items-center gap-3">
                    <Tombol>Primer</Tombol>
                    <Tombol varian="sekunder">Sekunder</Tombol>
                    <Tombol varian="bahaya">Batalkan SPK</Tombol>
                    <Tombol varian="hantu">Hantu</Tombol>
                    <Tombol varian="kecil">Kecil</Tombol>
                    <Tombol sibuk>Menyimpan</Tombol>
                    <TombolIkon ikon="pensil" label="Ubah SPK S-0012" teks="Ubah" />
                    <TombolIkon ikon="tambah" label="Tambah item" nada="berhasil" />
                    <TombolIkon ikon="kurang" label="Stok keluar" nada="peringatan" />
                    <TombolIkon ikon="sampah" label="Hapus item" nada="bahaya" />
                </div>
            </Bagian>

            <Bagian judul="Isian">
                <div className="grid gap-5 md:grid-cols-2">
                    <Field id="g-plat" label="Plat nomor" petunjuk="Contoh: B 1234 XYZ">
                        <Input
                            {...atributField('g-plat', undefined, true)}
                            defaultValue="b1234xyz"
                        />
                    </Field>
                    <Field
                        id="g-hp"
                        label="Nomor WhatsApp"
                        galat="Nomor WhatsApp belum sesuai format."
                    >
                        <Input {...atributField('g-hp', 'galat')} defaultValue="021-555" />
                    </Field>
                    <div className="md:col-span-2">
                        <Field id="g-keluhan" label="Keluhan">
                            <Textarea id="g-keluhan" defaultValue="Rem depan bunyi saat dipakai." />
                        </Field>
                    </div>
                </div>
            </Bagian>

            <Bagian judul="Lencana">
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {STATUS_SPK.map((s) => (
                            <LencanaStatusSpk key={s} status={s} />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {STATUS_BOOKING.map((s) => (
                            <LencanaStatusBooking key={s} status={s} />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {STATUS_BAYAR.map((s) => (
                            <LencanaBayar key={s} status={s} />
                        ))}
                        {LEVEL_STOK.map((l) => (
                            <LencanaLevelStok key={l} level={l} />
                        ))}
                    </div>
                </div>
            </Bagian>

            <Bagian judul="Pesan dan notifikasi">
                <div className="space-y-3">
                    <KotakPesan jenis="info">
                        SPK baru otomatis mengirim tautan lacak ke pelanggan.
                    </KotakPesan>
                    <KotakPesan jenis="berhasil">Pembayaran Rp50.000 dicatat.</KotakPesan>
                    <KotakPesan jenis="peringatan" judul="Stok menipis">
                        Kampas Rem Depan Vario tinggal 2 set.
                    </KotakPesan>
                    <KotakPesan jenis="galat">
                        Stok sparepart tidak cukup: Kampas Rem Depan Vario (butuh 3 set, tersedia 2
                        set)
                    </KotakPesan>
                    <div className="flex flex-wrap gap-2">
                        <Tombol varian="sekunder" onClick={() => tampilkanToast('SPK disimpan.')}>
                            Toast berhasil
                        </Tombol>
                        <Tombol
                            varian="sekunder"
                            onClick={() => tampilkanToast('WhatsApp gagal dikirim.', 'galat')}
                        >
                            Toast galat
                        </Tombol>
                    </div>
                </div>
            </Bagian>

            <Bagian judul="Kartu">
                <div className="grid gap-3 sm:grid-cols-3">
                    <KartuAngka
                        label="Uang diterima"
                        nilai={formatRupiah(1250000)}
                        ikon="rekap"
                        sorot
                    />
                    <KartuAngka label="SPK selesai" nilai="7" ikon="berhasil" />
                    <KartuAngka label="Antre" nilai="3" ikon="jam" keterangan="2 menunggu part" />
                </div>
                <Kartu
                    judul="Kendaraan"
                    className="mt-3"
                    deskripsi={formatKendaraan(SPK_CONTOH.vehicle)}
                >
                    Keluhan: {SPK_CONTOH.complaint}
                </Kartu>
            </Bagian>

            <Bagian judul="Tabel dengan kolom No dan baris per halaman">
                <Tabel
                    keterangan="Contoh daftar SPK"
                    kolom={KOLOM}
                    baris={DAFTAR_SPK_CONTOH}
                    kunciBaris={(s) => s.number}
                    nomorAwal={nomorAwal(meta)}
                    bawah={
                        <Paginasi
                            meta={meta}
                            onHalaman={setHalaman}
                            onUkuran={(u) => {
                                setUkuran(u)
                                setHalaman(1)
                            }}
                        />
                    }
                />
            </Bagian>

            <Bagian judul="Memuat dan kosong">
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-1/2" />
                        <SkeletonTabel baris={3} />
                    </div>
                    <KeadaanKosong ikon="kalender" judul="Belum ada booking">
                        Booking dari website muncul di sini.
                    </KeadaanKosong>
                </div>
            </Bagian>

            <Bagian judul="Nota 58 mm">
                <div className="flex flex-wrap items-start gap-4">
                    <div className="rounded-xl border border-garis bg-white p-3">
                        <NotaThermal
                            spk={SPK_CONTOH}
                            outlet={OUTLET_CONTOH}
                            tautanLacak={`https://bengkelku.id/servis/${SPK_CONTOH.trackingToken}`}
                        />
                    </div>
                    <TombolCetak label="Cetak nota contoh" />
                </div>
                <AreaCetak>
                    <NotaThermal spk={SPK_CONTOH} outlet={OUTLET_CONTOH} />
                </AreaCetak>
            </Bagian>

            <Dialog
                terbuka={dialog}
                judul="Batalkan SPK S-0012?"
                deskripsi="Semua sparepart di SPK ini kembali ke stok. Alasan batal terlihat oleh pelanggan."
                onTutup={() => setDialog(false)}
            >
                <div className="flex justify-end gap-2">
                    <Tombol varian="hantu" onClick={() => setDialog(false)}>
                        Kembali
                    </Tombol>
                    <Tombol varian="bahaya" onClick={() => setDialog(false)}>
                        Batalkan SPK
                    </Tombol>
                </div>
            </Dialog>
        </>
    )
}
