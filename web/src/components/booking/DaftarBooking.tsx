// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import GalatDaftar from '@/components/panel/GalatDaftar'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import JudulHalaman from '@/components/ui/JudulHalaman'
import KotakCari from '@/components/ui/KotakCari'
import { LencanaStatusBooking } from '@/components/ui/Lencana'
import Paginasi from '@/components/ui/Paginasi'
import { SkeletonTabel } from '@/components/ui/Skeleton'
import Tab from '@/components/ui/Tab'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import Tombol from '@/components/ui/Tombol'
import { useDaftar } from '@/components/ui/useDaftar'
import { useSegarBerkala } from '@/components/ui/useSegarBerkala'
import { klienStaf } from '@/klien/peramban'
import {
    LABEL_STATUS_BOOKING,
    STATUS_BOOKING,
    type Booking,
    type StatusBooking,
} from '@/skema/booking'
import { formatNomorHp, formatTanggal, formatWaktu } from '@/utils/format'
import { tanggalWib } from '@/utils/kalender'
import { UKURAN_BAWAAN, nomorAwal } from '@/utils/query'

// Booking masuk dimuat ulang berkala (polling, tanpa WebSocket) supaya booking baru dari website terlihat
// tanpa menekan apa pun.
const JEDA_MS = 30_000

type Saring = StatusBooking | 'semua'

const KOLOM: KolomTabel<Booking>[] = [
    {
        kunci: 'nomor',
        judul: 'Nomor',
        isi: (b) => (
            <Link
                href={`/admin/booking/${b.bookingId}`}
                className="font-bold text-utama-tua underline-offset-4 hover:underline"
            >
                {b.number}
            </Link>
        ),
    },
    { kunci: 'tanggal', judul: 'Datang', isi: (b) => formatTanggal(b.visitDate) },
    {
        kunci: 'pemesan',
        judul: 'Pemesan',
        isi: (b) => (
            <span>
                <span className="block font-semibold">{b.customerName}</span>
                <span className="text-sm text-redup">{formatNomorHp(b.phone)}</span>
            </span>
        ),
    },
    { kunci: 'plat', judul: 'Kendaraan', isi: (b) => `${b.plate} · ${b.vehicleBrand}` },
    { kunci: 'jasa', judul: 'Jasa', sembunyiSempit: true, isi: (b) => b.service?.name ?? '–' },
    { kunci: 'status', judul: 'Status', isi: (b) => <LencanaStatusBooking status={b.status} /> },
    { kunci: 'masuk', judul: 'Masuk', sembunyiSempit: true, isi: (b) => formatWaktu(b.createdAt) },
]

// Daftar booking dari website (pemilik dan kasir), bawaannya yang menunggu konfirmasi. Buka
// nomornya untuk mengonfirmasi, menolak, atau menjadikannya SPK.
export default function DaftarBooking() {
    const [status, setStatus] = useState<Saring>('PENDING')
    const [tanggal, setTanggal] = useState('')
    const [cari, setCari] = useState('')
    const [halaman, setHalaman] = useState(1)
    const [ukuran, setUkuran] = useState(UKURAN_BAWAAN)

    const daftar = useDaftar(
        () =>
            klienStaf().daftarBooking({
                status: status === 'semua' ? undefined : status,
                visitDate: tanggal || undefined,
                search: cari || undefined,
                page: halaman,
                limit: ukuran,
            }),
        JSON.stringify([status, tanggal, cari, halaman, ukuran]),
    )
    useSegarBerkala(() => daftar.muatUlang(true), { jedaMs: JEDA_MS, aktif: true })

    const ubahCari = useCallback((t: string) => {
        setCari(t)
        setHalaman(1)
    }, [])

    return (
        <>
            <JudulHalaman
                judul="Booking"
                petunjuk="Booking dari website mulai berstatus Menunggu dan harus dikonfirmasi atau ditolak. Pelanggan dikirimi WhatsApp saat kamu mengonfirmasi atau menolak."
            >
                <div className="space-y-3">
                    <Tab
                        label="Saring status"
                        opsi={[
                            ...STATUS_BOOKING.map((s) => ({
                                nilai: s as Saring,
                                label: LABEL_STATUS_BOOKING[s],
                            })),
                            { nilai: 'semua' as Saring, label: 'Semua' },
                        ]}
                        nilai={status}
                        onUbah={(s) => {
                            setStatus(s)
                            setHalaman(1)
                        }}
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="sm:w-52">
                            <Field id="booking-tanggal" label="Tanggal datang">
                                <Input
                                    {...atributField('booking-tanggal')}
                                    type="date"
                                    value={tanggal}
                                    onChange={(e) => {
                                        setTanggal(e.target.value)
                                        setHalaman(1)
                                    }}
                                />
                            </Field>
                        </div>
                        <div className="flex gap-2">
                            <Tombol varian="kecil" onClick={() => setTanggal(tanggalWib())}>
                                Hari ini
                            </Tombol>
                            {tanggal && (
                                <Tombol varian="kecil" onClick={() => setTanggal('')}>
                                    Semua tanggal
                                </Tombol>
                            )}
                        </div>
                        <div className="sm:ml-auto">
                            <KotakCari
                                nilai={cari}
                                onCari={ubahCari}
                                label="Cari booking"
                                placeholder="Nomor, nama, HP, atau plat"
                            />
                        </div>
                    </div>
                </div>
            </JudulHalaman>
            {daftar.galat && (
                <GalatDaftar galat={daftar.galat} onCobaLagi={() => void daftar.muatUlang()} />
            )}
            {daftar.data === null ? (
                <SkeletonTabel />
            ) : (
                <Tabel
                    keterangan="Daftar booking"
                    kolom={KOLOM}
                    baris={daftar.data}
                    kunciBaris={(b) => b.bookingId}
                    nomorAwal={daftar.meta ? nomorAwal(daftar.meta) : 1}
                    kosong={
                        status === 'PENDING' && !cari && !tanggal
                            ? 'Tidak ada booking yang menunggu konfirmasi.'
                            : 'Tidak ada booking yang cocok dengan saringan ini.'
                    }
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
