// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useState } from 'react'
import DialogKonfirmasi from '@/components/ui/DialogKonfirmasi'
import KotakPesan from '@/components/ui/KotakPesan'
import { LencanaStatusBooking } from '@/components/ui/Lencana'
import Tombol from '@/components/ui/Tombol'
import { useAksi } from '@/components/ui/useAksi'
import { useSegarBerkala } from '@/components/ui/useSegarBerkala'
import { klienPublik } from '@/klien/peramban'
import type { BookingPublik, StatusBooking } from '@/skema/booking'
import { LABEL_JENIS_KENDARAAN } from '@/skema/pelanggan'
import { formatTanggal, formatWaktuWib } from '@/utils/format'
import { simpanBooking } from '@/utils/penyimpanan'
import { bolehAksiBooking } from '@/utils/statusBooking'

// Penjelasan tiap status untuk pelanggan, dalam kalimat biasa.
const PENJELASAN: Record<StatusBooking, string> = {
    PENDING:
        'Booking sudah diterima dan menunggu dicek staf bengkel. Konfirmasi dikirim lewat WhatsApp.',
    CONFIRMED: 'Booking dikonfirmasi. Silakan datang ke bengkel pada tanggal yang dipilih.',
    CONVERTED: 'Kendaraanmu sudah dicatat sebagai SPK. Tautan lacak servis dikirim lewat WhatsApp.',
    REJECTED: 'Booking ini ditolak bengkel.',
    CANCELLED: 'Booking ini sudah kamu batalkan.',
}

// Selama booking masih bisa berubah oleh staf, halaman memuat ulang berkala supaya pelanggan
// melihat konfirmasi tanpa menekan apa pun.
const JEDA_MS = 30_000

type Props = { token: string; awal: BookingPublik }

export default function StatusBookingPublik({ token, awal }: Props) {
    const [booking, setBooking] = useState(awal)
    const [konfirmasiBatal, setKonfirmasiBatal] = useState(false)
    const { jalankan } = useAksi()

    // Halaman yang dibuka dari tautan (mis. dari HP lain) juga dicatat di daftar "Booking kamu".
    useEffect(() => {
        simpanBooking({ token, nomor: awal.number, dibuat: awal.createdAt })
    }, [token, awal.number, awal.createdAt])

    const bisaBerubah = booking.status === 'PENDING' || booking.status === 'CONFIRMED'
    useSegarBerkala(
        async () => {
            const hasil = await klienPublik().detailBookingPublik(token)
            if (hasil.ok) setBooking(hasil.data)
            if (!hasil.ok && hasil.status === 404) return 'henti'
            return hasil.ok ? 'ok' : 'gagal'
        },
        { jedaMs: JEDA_MS, aktif: bisaBerubah },
    )

    const batalkan = async () => {
        await jalankan('batal', () => klienPublik().batalkanBookingPublik(token), {
            berhasil: 'Booking dibatalkan.',
            sesudah: setBooking,
        })
        setKonfirmasiBatal(false)
    }

    const rincian: [string, string][] = [
        ['Nomor booking', booking.number],
        ['Tanggal datang', formatTanggal(booking.visitDate)],
        ['Nama', booking.customerName],
        ['Nomor WhatsApp', booking.phone],
        [
            'Kendaraan',
            `${LABEL_JENIS_KENDARAAN[booking.vehicleType]} · ${booking.plate} · ${[booking.vehicleBrand, booking.vehicleModel].filter(Boolean).join(' ')}`,
        ],
        ['Jasa', booking.serviceName ?? 'Belum memilih jasa'],
        ['Dibuat', formatWaktuWib(booking.createdAt)],
    ]

    return (
        <div className="space-y-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-extrabold leading-tight">Booking {booking.number}</h1>
                <LencanaStatusBooking status={booking.status} />
            </header>
            <KotakPesan
                jenis={
                    booking.status === 'REJECTED'
                        ? 'galat'
                        : booking.status === 'CANCELLED'
                          ? 'peringatan'
                          : booking.status === 'PENDING'
                            ? 'info'
                            : 'berhasil'
                }
            >
                {PENJELASAN[booking.status]}
                {booking.status === 'REJECTED' && booking.rejectReason && (
                    <span className="mt-1 block font-semibold">Alasan: {booking.rejectReason}</span>
                )}
                {booking.workOrderNumber && (
                    <span className="mt-1 block">Nomor SPK: {booking.workOrderNumber}</span>
                )}
            </KotakPesan>
            <dl className="divide-y divide-garis overflow-hidden rounded-2xl border border-garis bg-permukaan">
                {rincian.map(([label, isi]) => (
                    <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
                        <dt className="text-sm font-semibold text-redup">{label}</dt>
                        <dd className="break-words">{isi}</dd>
                    </div>
                ))}
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
                    <dt className="text-sm font-semibold text-redup">Keluhan</dt>
                    <dd className="whitespace-pre-line break-words">{booking.complaint}</dd>
                </div>
            </dl>
            {bolehAksiBooking(booking.status, 'batalPelanggan') && (
                <Tombol
                    varian="sekunder"
                    className="w-full"
                    onClick={() => setKonfirmasiBatal(true)}
                >
                    Batalkan booking
                </Tombol>
            )}
            <p className="text-sm leading-relaxed text-redup">
                Simpan tautan halaman ini untuk melihat status bookingmu lagi.
            </p>
            <DialogKonfirmasi
                terbuka={konfirmasiBatal}
                judul={`Batalkan booking ${booking.number}?`}
                deskripsi="Booking yang dibatalkan tidak bisa dibuka lagi. Kamu bisa booking ulang kapan saja."
                labelKonfirmasi="Batalkan booking"
                berbahaya
                onKonfirmasi={batalkan}
                onTutup={() => setKonfirmasiBatal(false)}
            />
        </div>
    )
}
