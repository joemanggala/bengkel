// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import GalatDaftar from '@/components/panel/GalatDaftar'
import Field, { atributField } from '@/components/ui/Field'
import JudulHalaman from '@/components/ui/JudulHalaman'
import KeadaanKosong from '@/components/ui/KeadaanKosong'
import KotakCari from '@/components/ui/KotakCari'
import { LencanaBayar, LencanaStatusSpk } from '@/components/ui/Lencana'
import Paginasi from '@/components/ui/Paginasi'
import Pilihan from '@/components/ui/Pilihan'
import { SkeletonKartu, SkeletonTabel } from '@/components/ui/Skeleton'
import Tab from '@/components/ui/Tab'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import { TOMBOL_PRIMER } from '@/components/ui/gaya'
import { useDaftar } from '@/components/ui/useDaftar'
import { opsiMekanik, useMekanik } from '@/components/ui/useMekanik'
import { useSegarBerkala } from '@/components/ui/useSegarBerkala'
import { klienStaf } from '@/klien/peramban'
import { LABEL_STATUS_SPK, type SpkRingkas, type StatusSpk } from '@/skema/spk'
import type { PeranStaf } from '@/skema/staf'
import { formatKendaraan, formatRupiah, formatWaktu } from '@/utils/format'
import { UKURAN_BAWAAN, nomorAwal } from '@/utils/query'
import { STATUS_AKTIF } from '@/utils/statusSpk'
import KartuSpk from './KartuSpk'

type Props = { peran: PeranStaf; pesan?: React.ReactNode }

// Papan memuat ulang berkala (polling, tanpa WebSocket). Batas 50 = limit terbesar API; papan bengkel satu
// outlet jarang berisi lebih dari itu, dan yang terlama tampil lebih dulu.
const JEDA_MS = 20_000
const MAKS_PAPAN = 50

const PENJELASAN_KOLOM: Partial<Record<StatusSpk, string>> = {
    QUEUED: 'Menunggu dikerjakan',
    IN_PROGRESS: 'Sedang dikerjakan mekanik',
    WAITING_PARTS: 'Berhenti menunggu sparepart',
    DONE: 'Siap diambil setelah lunas',
}

const KOLOM_RIWAYAT: KolomTabel<SpkRingkas>[] = [
    {
        kunci: 'nomor',
        judul: 'Nomor',
        isi: (s) => (
            <Link
                href={`/admin/spk/${s.number}`}
                className="font-bold text-utama-tua underline-offset-4 hover:underline"
            >
                {s.number}
            </Link>
        ),
    },
    { kunci: 'kendaraan', judul: 'Kendaraan', isi: (s) => formatKendaraan(s.vehicle) },
    { kunci: 'pelanggan', judul: 'Pelanggan', isi: (s) => s.customer.name },
    { kunci: 'status', judul: 'Status', isi: (s) => <LencanaStatusSpk status={s.status} /> },
    {
        kunci: 'bayar',
        judul: 'Bayar',
        isi: (s) => (s.itemCount > 0 ? <LencanaBayar status={s.paymentStatus} /> : '–'),
    },
    { kunci: 'masuk', judul: 'Masuk', sembunyiSempit: true, isi: (s) => formatWaktu(s.createdAt) },
    { kunci: 'total', judul: 'Total', angka: true, isi: (s) => formatRupiah(s.total) },
]

// Papan servis: SPK yang masih di bengkel per status (aktif), dan riwayat SPK yang sudah diambil
// atau dibatalkan. Mekanik hanya menerima SPK miliknya (backend yang menyaring) dan tidak melihat
// uang; pemilik dan kasir bisa menyaring per mekanik.
export default function PapanServis({ peran, pesan }: Props) {
    const kasir = peran !== 'mechanic'
    const [tab, setTab] = useState<'aktif' | 'riwayat'>('aktif')
    const [cari, setCari] = useState('')
    const [mekanikId, setMekanikId] = useState('')
    const [halaman, setHalaman] = useState(1)
    const [ukuran, setUkuran] = useState(UKURAN_BAWAAN)
    const mekanik = useMekanik(kasir)

    const parameter =
        tab === 'aktif'
            ? { scope: 'active' as const, sort: 'oldest' as const, limit: MAKS_PAPAN }
            : { scope: 'history' as const, page: halaman, limit: ukuran }
    const daftar = useDaftar(
        () =>
            klienStaf().daftarSpk({
                ...parameter,
                search: cari || undefined,
                mechanicId: mekanikId || undefined,
            }),
        JSON.stringify([parameter, cari, mekanikId]),
    )

    useSegarBerkala(() => daftar.muatUlang(true), { jedaMs: JEDA_MS, aktif: tab === 'aktif' })

    const ubahCari = useCallback((teks: string) => {
        setCari(teks)
        setHalaman(1)
    }, [])

    const perStatus = (status: StatusSpk) => (daftar.data ?? []).filter((s) => s.status === status)

    return (
        <>
            <JudulHalaman
                judul="Papan servis"
                petunjuk={
                    kasir
                        ? 'SPK yang masih di bengkel, dikelompokkan per status dan dimuat ulang otomatis. Buka SPK untuk mengubah status, menambah item, dan mencatat pembayaran.'
                        : 'SPK yang ditugaskan kepadamu. Buka SPK untuk mengubah status atau mengisi diagnosis.'
                }
                aksi={
                    kasir ? (
                        <Link href="/admin/spk/baru" className={TOMBOL_PRIMER}>
                            SPK baru
                        </Link>
                    ) : undefined
                }
            >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <Tab
                        label="Tampilan papan"
                        opsi={[
                            { nilai: 'aktif', label: 'Di bengkel' },
                            { nilai: 'riwayat', label: 'Riwayat' },
                        ]}
                        nilai={tab}
                        onUbah={(t) => {
                            setTab(t)
                            setHalaman(1)
                        }}
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        {kasir && (
                            <div className="sm:w-56 sm:shrink-0">
                                <Field id="papan-mekanik" label="Mekanik">
                                    <Pilihan
                                        {...atributField('papan-mekanik')}
                                        opsi={opsiMekanik(mekanik)}
                                        kosong="Semua mekanik"
                                        value={mekanikId}
                                        onChange={(e) => setMekanikId(e.target.value)}
                                    />
                                </Field>
                            </div>
                        )}
                        <KotakCari
                            nilai={cari}
                            onCari={ubahCari}
                            label="Cari SPK"
                            placeholder="Nomor SPK, plat, nama, atau HP"
                        />
                    </div>
                </div>
            </JudulHalaman>
            {pesan && <div className="mb-5">{pesan}</div>}
            {daftar.galat && (
                <GalatDaftar galat={daftar.galat} onCobaLagi={() => void daftar.muatUlang()} />
            )}

            {tab === 'aktif' ? (
                daftar.data === null ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {STATUS_AKTIF.map((s) => (
                            <SkeletonKartu key={s} />
                        ))}
                    </div>
                ) : daftar.data.length === 0 && !daftar.galat ? (
                    <KeadaanKosong ikon="papan" judul="Tidak ada SPK di bengkel">
                        {cari || mekanikId
                            ? 'Tidak ada SPK aktif yang cocok dengan pencarian ini.'
                            : kasir
                              ? 'SPK baru dan booking yang dijadikan SPK muncul di sini.'
                              : 'Belum ada SPK yang ditugaskan kepadamu.'}
                    </KeadaanKosong>
                ) : (
                    <>
                        {daftar.meta && daftar.meta.total > MAKS_PAPAN && (
                            <p className="mb-3 text-sm text-redup">
                                Menampilkan {MAKS_PAPAN} SPK terlama dari {daftar.meta.total}. Pakai
                                kotak cari untuk menemukan SPK lain.
                            </p>
                        )}
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {STATUS_AKTIF.map((status) => {
                                const isi = perStatus(status)
                                return (
                                    <section
                                        key={status}
                                        aria-labelledby={`kolom-${status}`}
                                        className="rounded-2xl bg-garis/40 p-3"
                                    >
                                        <header className="mb-3 flex items-center justify-between gap-2 px-1">
                                            <div>
                                                <h2 id={`kolom-${status}`} className="font-bold">
                                                    <LencanaStatusSpk status={status} />
                                                </h2>
                                                <p className="mt-1 text-sm text-redup">
                                                    {PENJELASAN_KOLOM[status]}
                                                </p>
                                            </div>
                                            <span className="angka text-lg font-bold">
                                                {isi.length}
                                                <span className="sr-only">
                                                    {' '}
                                                    SPK {LABEL_STATUS_SPK[status]}
                                                </span>
                                            </span>
                                        </header>
                                        <ul className="space-y-3">
                                            {isi.map((s) => (
                                                <li key={s.number}>
                                                    <KartuSpk spk={s} tampilUang={kasir} />
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )
                            })}
                        </div>
                    </>
                )
            ) : daftar.data === null ? (
                <SkeletonTabel />
            ) : (
                <Tabel
                    keterangan="Riwayat SPK"
                    kolom={
                        kasir
                            ? KOLOM_RIWAYAT
                            : KOLOM_RIWAYAT.filter(
                                  (k) => k.kunci !== 'bayar' && k.kunci !== 'total',
                              )
                    }
                    baris={daftar.data}
                    kunciBaris={(s) => s.number}
                    nomorAwal={daftar.meta ? nomorAwal(daftar.meta) : 1}
                    kosong="Belum ada SPK yang diambil atau dibatalkan."
                    bawah={
                        daftar.meta && (
                            <Paginasi
                                meta={daftar.meta}
                                disabled={daftar.memuat}
                                onHalaman={setHalaman}
                                onUkuran={(u) => {
                                    setUkuran(u)
                                    setHalaman(1)
                                }}
                            />
                        )
                    }
                />
            )}
        </>
    )
}
