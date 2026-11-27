// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Field, { atributField } from '@/components/ui/Field'
import { fokusKolomGalat } from '@/components/ui/fokusGalat'
import Input from '@/components/ui/Input'
import KotakPesan from '@/components/ui/KotakPesan'
import Pilihan from '@/components/ui/Pilihan'
import Textarea from '@/components/ui/Textarea'
import Tombol from '@/components/ui/Tombol'
import { useTerhidrasi } from '@/components/ui/useTerhidrasi'
import { alamatStatusBooking } from '@/constants/publik'
import { PESAN_TIDAK_PASTI, hasilTidakPasti, klienPublik } from '@/klien/peramban'
import type { JasaPublik } from '@/skema/jasa'
import { JENIS_KENDARAAN, LABEL_JENIS_KENDARAAN, type JenisKendaraan } from '@/skema/pelanggan'
import { formatRupiah } from '@/utils/format'
import { petakanGalatForm } from '@/utils/galat'
import { rentangTanggalBooking } from '@/utils/kalender'
import { simpanBooking } from '@/utils/penyimpanan'
import {
    ATURAN_BOOKING,
    URUTAN_KOLOM_BOOKING,
    isianBookingKosong,
    periksaBooking,
    type IsianBooking,
} from './logika/booking'

const id = (nama: string) => `booking-${nama}`

type Props = {
    jasa: readonly JasaPublik[]
    // Jasa yang dipilih dari halaman depan (?jasa=<serviceId>), bila masih ada di daftar.
    jasaAwal?: string
}

// Form booking publik, mobile first. Diperiksa di browser dengan aturan yang sama dengan backend,
// lalu dikirim lewat BFF publik (tanpa cookie). bookingToken hanya diterima sekali, jadi sebelum
// pindah ke halaman status token disimpan juga di penyimpanan lokal browser.
export default function FormBooking({ jasa, jasaAwal = '' }: Props) {
    const router = useRouter()
    const terhidrasi = useTerhidrasi()
    const [isian, setIsian] = useState<IsianBooking>(() => ({
        ...isianBookingKosong(),
        serviceId: jasa.some((j) => j.serviceId === jasaAwal) ? jasaAwal : '',
    }))
    const [galat, setGalat] = useState<Record<string, string>>({})
    const [pesan, setPesan] = useState<string | null>(null)
    const [sibuk, setSibuk] = useState(false)
    // Dihitung sekali saat form dibuka; backend tetap memeriksa batasnya saat booking diterima.
    const [rentang] = useState(() => rentangTanggalBooking())

    const ubah = <K extends keyof IsianBooking>(kunci: K, nilai: IsianBooking[K]) => {
        setIsian((lama) => ({ ...lama, [kunci]: nilai }))
        setGalat((lama) => {
            const sisa = { ...lama }
            delete sisa[kunci]
            return sisa
        })
    }

    const kirim = async () => {
        setPesan(null)
        const cek = periksaBooking(isian, rentang)
        if (!cek.ok) {
            setGalat(cek.fields)
            fokusKolomGalat(URUTAN_KOLOM_BOOKING, cek.fields, id)
            return
        }
        setSibuk(true)
        const hasil = await klienPublik().buatBookingPublik(cek.badan)
        if (hasil.ok) {
            simpanBooking({
                token: hasil.data.bookingToken,
                nomor: hasil.data.booking.number,
                dibuat: hasil.data.booking.createdAt,
            })
            router.replace(alamatStatusBooking(hasil.data.bookingToken))
            return
        }
        setSibuk(false)
        if (hasilTidakPasti(hasil)) {
            setPesan(
                `${PESAN_TIDAK_PASTI} Bila booking ternyata sudah tercatat, staf bengkel akan menghubungimu lewat WhatsApp.`,
            )
            return
        }
        const peta = petakanGalatForm(hasil.galat, ATURAN_BOOKING)
        setGalat(peta.fields ?? {})
        setPesan(peta.pesan ?? null)
        fokusKolomGalat(URUTAN_KOLOM_BOOKING, peta.fields ?? {}, id, id('kirim'))
    }

    const opsiJasa = jasa.map((j) => ({
        nilai: j.serviceId,
        label: `${j.name} · ${formatRupiah(j.price)}`,
    }))

    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault()
                void kirim()
            }}
            className="space-y-5"
        >
            <fieldset disabled={!terhidrasi || sibuk} className="min-w-0 space-y-5">
                {pesan && <KotakPesan jenis="galat">{pesan}</KotakPesan>}
                <Field id={id('customerName')} label="Nama" galat={galat.customerName}>
                    <Input
                        {...atributField(id('customerName'), galat.customerName)}
                        value={isian.customerName}
                        onChange={(e) => ubah('customerName', e.target.value)}
                        autoComplete="name"
                    />
                </Field>
                <Field
                    id={id('phone')}
                    label="Nomor WhatsApp"
                    galat={galat.phone}
                    petunjuk="Konfirmasi booking dikirim ke nomor ini."
                >
                    <Input
                        {...atributField(id('phone'), galat.phone, true)}
                        value={isian.phone}
                        onChange={(e) => ubah('phone', e.target.value)}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="0812-3456-7890"
                    />
                </Field>
                <fieldset
                    aria-describedby={galat.vehicleType ? id('vehicleType-galat') : undefined}
                >
                    <legend className="mb-2 text-[15px] font-semibold text-tinta">
                        Jenis kendaraan
                    </legend>
                    <div className="grid grid-cols-2 gap-2" id={id('vehicleType')} tabIndex={-1}>
                        {JENIS_KENDARAAN.map((j: JenisKendaraan) => (
                            <label
                                key={j}
                                className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-fokus ${
                                    isian.vehicleType === j
                                        ? 'border-utama-tua bg-utama text-white'
                                        : 'border-garis-kuat bg-permukaan text-tinta hover:bg-latar'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="vehicleType"
                                    value={j}
                                    checked={isian.vehicleType === j}
                                    onChange={() => ubah('vehicleType', j)}
                                    className="sr-only"
                                />
                                {LABEL_JENIS_KENDARAAN[j]}
                            </label>
                        ))}
                    </div>
                    {galat.vehicleType && (
                        <p
                            id={id('vehicleType-galat')}
                            className="mt-2 text-sm font-semibold text-bahaya-tua"
                        >
                            {galat.vehicleType}
                        </p>
                    )}
                </fieldset>
                <Field id={id('plate')} label="Plat nomor" galat={galat.plate}>
                    <Input
                        {...atributField(id('plate'), galat.plate)}
                        value={isian.plate}
                        onChange={(e) => ubah('plate', e.target.value)}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="B 1234 XYZ"
                    />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                    <Field id={id('vehicleBrand')} label="Merek" galat={galat.vehicleBrand}>
                        <Input
                            {...atributField(id('vehicleBrand'), galat.vehicleBrand)}
                            value={isian.vehicleBrand}
                            onChange={(e) => ubah('vehicleBrand', e.target.value)}
                            placeholder="Honda"
                        />
                    </Field>
                    <Field
                        id={id('vehicleModel')}
                        label="Tipe"
                        galat={galat.vehicleModel}
                        samping={<span className="text-sm text-redup">Opsional</span>}
                    >
                        <Input
                            {...atributField(id('vehicleModel'), galat.vehicleModel)}
                            value={isian.vehicleModel}
                            onChange={(e) => ubah('vehicleModel', e.target.value)}
                            placeholder="Vario 125"
                        />
                    </Field>
                </div>
                {opsiJasa.length > 0 && (
                    <Field
                        id={id('serviceId')}
                        label="Jasa"
                        galat={galat.serviceId}
                        samping={<span className="text-sm text-redup">Opsional</span>}
                        petunjuk="Belum yakin? Kosongkan saja dan tulis keluhannya di bawah."
                    >
                        <Pilihan
                            {...atributField(id('serviceId'), galat.serviceId, true)}
                            opsi={opsiJasa}
                            kosong="Belum memilih jasa"
                            value={isian.serviceId}
                            onChange={(e) => ubah('serviceId', e.target.value)}
                        />
                    </Field>
                )}
                <Field
                    id={id('visitDate')}
                    label="Tanggal datang"
                    galat={galat.visitDate}
                    petunjuk="Hari ini sampai 30 hari ke depan."
                >
                    <Input
                        {...atributField(id('visitDate'), galat.visitDate, true)}
                        type="date"
                        min={rentang.awal}
                        max={rentang.akhir}
                        value={isian.visitDate}
                        onChange={(e) => ubah('visitDate', e.target.value)}
                    />
                </Field>
                <Field id={id('complaint')} label="Keluhan" galat={galat.complaint}>
                    <Textarea
                        {...atributField(id('complaint'), galat.complaint)}
                        value={isian.complaint}
                        onChange={(e) => ubah('complaint', e.target.value)}
                        rows={4}
                        placeholder="Mis. rem depan bunyi, sekalian ganti oli."
                    />
                </Field>
                <Tombol id={id('kirim')} type="submit" sibuk={sibuk} className="w-full">
                    {sibuk ? 'Mengirim booking…' : 'Kirim booking'}
                </Tombol>
                <p className="text-sm leading-relaxed text-redup">
                    Booking belum pasti sampai dikonfirmasi staf bengkel lewat WhatsApp.
                </p>
            </fieldset>
        </form>
    )
}
