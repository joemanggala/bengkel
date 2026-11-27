// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useState } from 'react'
import GalatDaftar from '@/components/panel/GalatDaftar'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import JudulHalaman from '@/components/ui/JudulHalaman'
import Kartu, { KartuAngka } from '@/components/ui/Kartu'
import KotakPesan from '@/components/ui/KotakPesan'
import Skeleton from '@/components/ui/Skeleton'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import Tombol from '@/components/ui/Tombol'
import { klienStaf } from '@/klien/peramban'
import type { GalatApi } from '@/skema/galat'
import type { JasaTerlaris, PartTerlaris, RekapHarian, SelesaiPerMekanik } from '@/skema/rekap'
import { LABEL_METODE_BAYAR, METODE_BAYAR } from '@/skema/spk'
import { formatAngka, formatRupiah, formatTanggal } from '@/utils/format'
import { tambahHari, tanggalSah, tanggalWib } from '@/utils/kalender'

const KOLOM_JASA: KolomTabel<JasaTerlaris>[] = [
    { kunci: 'nama', judul: 'Jasa', isi: (j) => j.name },
    { kunci: 'jumlah', judul: 'Jumlah', angka: true, isi: (j) => formatAngka(j.quantity) },
    { kunci: 'nilai', judul: 'Nilai', angka: true, isi: (j) => formatRupiah(j.revenue) },
]

const KOLOM_PART: KolomTabel<PartTerlaris>[] = [
    { kunci: 'nama', judul: 'Sparepart', isi: (p) => p.name },
    { kunci: 'jumlah', judul: 'Jumlah', angka: true, isi: (p) => formatAngka(p.quantity) },
    { kunci: 'nilai', judul: 'Nilai', angka: true, isi: (p) => formatRupiah(p.revenue) },
    {
        kunci: 'modal',
        judul: 'Modal',
        angka: true,
        sembunyiSempit: true,
        isi: (p) => formatRupiah(p.cost),
    },
    { kunci: 'laba', judul: 'Laba', angka: true, isi: (p) => formatRupiah(p.profit) },
]

const KOLOM_MEKANIK: KolomTabel<SelesaiPerMekanik>[] = [
    { kunci: 'nama', judul: 'Mekanik', isi: (m) => m.mechanic?.name ?? 'Tanpa mekanik' },
    { kunci: 'jumlah', judul: 'SPK selesai', angka: true, isi: (m) => formatAngka(m.doneCount) },
]

// Rekap harian (khusus pemilik) untuk satu tanggal WIB. Nilai, modal, laba, dan terlaris dari SPK
// yang selesai pada tanggal itu; uang diterima dari pembayaran pada tanggal itu (termasuk uang
// muka SPK yang belum selesai), sesuai keputusan Bagian 0a nomor 0a-9.
export default function TampilanRekap() {
    const [tanggal, setTanggal] = useState(() => tanggalWib())
    const [rekap, setRekap] = useState<RekapHarian | null>(null)
    const [galat, setGalat] = useState<GalatApi | null>(null)
    const [percobaan, setPercobaan] = useState(0)

    useEffect(() => {
        if (!tanggalSah(tanggal)) return
        let batal = false
        setRekap(null)
        setGalat(null)
        void klienStaf()
            .rekapHarian(tanggal)
            .then((hasil) => {
                if (batal) return
                if (hasil.ok) setRekap(hasil.data)
                else setGalat(hasil.galat)
            })
        return () => {
            batal = true
        }
    }, [tanggal, percobaan])

    return (
        <>
            <JudulHalaman
                judul="Rekap"
                deskripsi={
                    tanggalSah(tanggal) ? `Tanggal ${formatTanggal(tanggal)} (WIB)` : undefined
                }
                petunjuk="Nilai SPK, modal, dan laba dihitung dari SPK yang selesai pada tanggal itu. Uang diterima dihitung dari pembayaran pada tanggal itu, termasuk uang muka."
            >
                <div className="flex flex-wrap items-end gap-2">
                    <div className="w-52">
                        <Field id="rekap-tanggal" label="Tanggal">
                            <Input
                                {...atributField('rekap-tanggal')}
                                type="date"
                                value={tanggal}
                                onChange={(e) => setTanggal(e.target.value)}
                            />
                        </Field>
                    </div>
                    <Tombol
                        varian="kecil"
                        onClick={() => setTanggal(tambahHari(tanggal, -1))}
                        disabled={!tanggalSah(tanggal)}
                    >
                        Sebelumnya
                    </Tombol>
                    <Tombol varian="kecil" onClick={() => setTanggal(tanggalWib())}>
                        Hari ini
                    </Tombol>
                </div>
            </JudulHalaman>
            {galat && <GalatDaftar galat={galat} onCobaLagi={() => setPercobaan((n) => n + 1)} />}
            {!rekap ? (
                !galat && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[1, 2, 3, 4].map((n) => (
                            <Skeleton key={n} className="h-28 w-full rounded-2xl" />
                        ))}
                    </div>
                )
            ) : (
                <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <KartuAngka
                            label="Uang diterima"
                            nilai={formatRupiah(rekap.paymentTotal)}
                            ikon="rekap"
                            sorot
                        />
                        <KartuAngka
                            label="Nilai SPK selesai"
                            nilai={formatRupiah(rekap.salesTotal)}
                            ikon="berhasil"
                            keterangan={`Jasa ${formatRupiah(rekap.serviceTotal)} · Part ${formatRupiah(rekap.partTotal)}`}
                        />
                        <KartuAngka
                            label="Laba kotor"
                            nilai={formatRupiah(rekap.grossProfit)}
                            ikon="rekap"
                            keterangan={`Modal part ${formatRupiah(rekap.partCostTotal)}`}
                        />
                        <KartuAngka
                            label="SPK"
                            nilai={`${formatAngka(rekap.doneCount)} selesai`}
                            ikon="papan"
                            keterangan={`${formatAngka(rekap.workOrderCount)} masuk · ${formatAngka(rekap.pickedUpCount)} diambil · ${formatAngka(rekap.cancelledCount)} batal`}
                        />
                    </div>
                    {rekap.partItemsWithoutCost > 0 && (
                        <KotakPesan jenis="peringatan" judul="Harga beli belum lengkap">
                            {formatAngka(rekap.partItemsWithoutCost)} item sparepart di SPK selesai
                            hari itu belum punya harga beli, jadi dihitung bermodal 0 dan laba
                            kotornya terlalu besar. Lengkapi harga beli di halaman Sparepart untuk
                            SPK berikutnya.
                        </KotakPesan>
                    )}
                    <div className="grid gap-5 lg:grid-cols-2">
                        <Kartu judul="Uang diterima per metode">
                            <dl className="angka space-y-2">
                                {METODE_BAYAR.map((m) => (
                                    <div key={m} className="flex justify-between">
                                        <dt>{LABEL_METODE_BAYAR[m]}</dt>
                                        <dd className="font-semibold">
                                            {formatRupiah(rekap.paymentsByMethod[m])}
                                        </dd>
                                    </div>
                                ))}
                                <div className="flex justify-between border-t border-garis pt-2 text-lg font-bold">
                                    <dt>Total</dt>
                                    <dd>{formatRupiah(rekap.paymentTotal)}</dd>
                                </div>
                            </dl>
                        </Kartu>
                        <Kartu judul="SPK selesai per mekanik" rapat>
                            <div className="p-4 sm:p-5">
                                <Tabel
                                    keterangan="SPK selesai per mekanik"
                                    kolom={KOLOM_MEKANIK}
                                    baris={rekap.doneByMechanic}
                                    kunciBaris={(m) => m.mechanic?.staffId ?? 'tanpa'}
                                    nomorAwal={1}
                                    kosong="Belum ada SPK selesai."
                                />
                            </div>
                        </Kartu>
                        <Kartu judul="Jasa terlaris" rapat>
                            <div className="p-4 sm:p-5">
                                <Tabel
                                    keterangan="Jasa terlaris"
                                    kolom={KOLOM_JASA}
                                    baris={rekap.topServices}
                                    kunciBaris={(j) => j.serviceId}
                                    nomorAwal={1}
                                    kosong="Belum ada."
                                />
                            </div>
                        </Kartu>
                        <Kartu judul="Sparepart terlaris" rapat>
                            <div className="p-4 sm:p-5">
                                <Tabel
                                    keterangan="Sparepart terlaris"
                                    kolom={KOLOM_PART}
                                    baris={rekap.topParts}
                                    kunciBaris={(p) => p.partId}
                                    nomorAwal={1}
                                    kosong="Belum ada."
                                />
                            </div>
                        </Kartu>
                    </div>
                </div>
            )}
        </>
    )
}
