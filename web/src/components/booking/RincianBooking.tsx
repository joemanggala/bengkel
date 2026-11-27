// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import KolomDataSpk, { URUTAN_DATA_SPK, idDataSpk } from '@/components/spk/KolomDataSpk'
import { ATURAN_DATA_SPK, periksaDataSpk, type IsianDataSpk } from '@/components/spk/logika'
import DialogAlasan from '@/components/ui/DialogAlasan'
import DialogForm, { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import JudulHalaman from '@/components/ui/JudulHalaman'
import Kartu from '@/components/ui/Kartu'
import KotakPesan from '@/components/ui/KotakPesan'
import { Lencana, LencanaStatusBooking } from '@/components/ui/Lencana'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import { useAksi } from '@/components/ui/useAksi'
import { klienStaf } from '@/klien/peramban'
import type { Booking } from '@/skema/booking'
import { LABEL_JENIS_KENDARAAN } from '@/skema/pelanggan'
import type { StatusWa } from '@/skema/spk'
import { formatNomorHp, formatTanggal, formatWaktu, formatWaktuWib } from '@/utils/format'
import { pesanGalat } from '@/utils/galat'
import { bolehAksiBooking } from '@/utils/statusBooking'

function StatusWaBooking({ label, wa }: { label: string; wa: StatusWa | null }) {
    if (!wa) return null
    return (
        <p className="flex flex-wrap items-center gap-2 text-[15px]">
            WhatsApp {label}:{' '}
            {wa.status === 'sent' ? (
                <Lencana nada="sukses">Terkirim {formatWaktu(wa.createdAt)}</Lencana>
            ) : (
                <Lencana nada="bahaya">Gagal {formatWaktu(wa.createdAt)}</Lencana>
            )}
        </p>
    )
}

// Rincian satu booking dengan aksi staf: konfirmasi (WhatsApp ke pelanggan), tolak dengan alasan
// (WhatsApp berisi alasannya), dan jadikan SPK saat pelanggan datang. Pesan booking yang gagal
// terkirim tidak punya tombol kirim ulang (keputusan Bagian 0a): hubungi pelanggan sendiri.
export default function RincianBooking({ awal }: { awal: Booking }) {
    const router = useRouter()
    const { tampilkanToast } = useToast()
    const { sibuk, jalankan } = useAksi()
    const [booking, setBooking] = useState(awal)
    const [dialog, setDialog] = useState<'tolak' | 'spk' | null>(null)

    const konfirmasi = () =>
        jalankan('konfirmasi', () => klienStaf().konfirmasiBooking(booking.bookingId), {
            sesudah: (b) => {
                setBooking(b)
                tampilkanToast(
                    b.wa.bookingConfirmed?.status === 'sent'
                        ? `Booking ${b.number} dikonfirmasi. Pelanggan dikirimi WhatsApp.`
                        : `Booking ${b.number} dikonfirmasi, tetapi WhatsApp gagal terkirim. Hubungi pelanggan langsung.`,
                    b.wa.bookingConfirmed?.status === 'sent' ? 'berhasil' : 'galat',
                )
            },
        })

    const rincian: [string, React.ReactNode][] = [
        ['Tanggal datang', formatTanggal(booking.visitDate)],
        ['Pemesan', booking.customerName],
        ['Nomor WhatsApp', formatNomorHp(booking.phone)],
        [
            'Kendaraan',
            `${LABEL_JENIS_KENDARAAN[booking.vehicleType]} · ${booking.plate} · ${[booking.vehicleBrand, booking.vehicleModel].filter(Boolean).join(' ')}`,
        ],
        ['Jasa', booking.service?.name ?? 'Tidak memilih jasa'],
        ['Keluhan', booking.complaint],
        ['Masuk', formatWaktuWib(booking.createdAt)],
    ]
    if (booking.handledBy) rincian.push(['Ditangani', booking.handledBy.name])

    return (
        <>
            <JudulHalaman
                judul={`Booking ${booking.number}`}
                kembali={{ label: 'Booking', href: '/admin/booking' }}
                deskripsi={<LencanaStatusBooking status={booking.status} />}
                aksi={
                    <>
                        {bolehAksiBooking(booking.status, 'konfirmasi') && (
                            <Tombol
                                sibuk={sibuk === 'konfirmasi'}
                                onClick={() => void konfirmasi()}
                            >
                                Konfirmasi
                            </Tombol>
                        )}
                        {bolehAksiBooking(booking.status, 'jadikanSpk') && (
                            <Tombol
                                varian={booking.status === 'CONFIRMED' ? 'primer' : 'sekunder'}
                                onClick={() => setDialog('spk')}
                            >
                                Jadikan SPK
                            </Tombol>
                        )}
                        {bolehAksiBooking(booking.status, 'tolak') && (
                            <Tombol
                                varian="hantu"
                                className="text-bahaya-tua hover:bg-bahaya-pucat"
                                onClick={() => setDialog('tolak')}
                            >
                                Tolak
                            </Tombol>
                        )}
                    </>
                }
            />
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                <Kartu judul="Data booking">
                    <dl className="divide-y divide-garis">
                        {rincian.map(([label, isi]) => (
                            <div key={label} className="grid gap-0.5 py-2 sm:grid-cols-[9rem_1fr]">
                                <dt className="text-sm font-semibold text-redup">{label}</dt>
                                <dd className="whitespace-pre-line break-words">{isi}</dd>
                            </div>
                        ))}
                    </dl>
                </Kartu>
                <div className="space-y-5">
                    {booking.status === 'REJECTED' && (
                        <KotakPesan jenis="galat" judul="Ditolak">
                            Alasan: {booking.rejectReason}
                        </KotakPesan>
                    )}
                    {booking.status === 'CANCELLED' && (
                        <KotakPesan jenis="peringatan">Booking dibatalkan pelanggan.</KotakPesan>
                    )}
                    {booking.workOrderNumber && (
                        <KotakPesan
                            jenis="berhasil"
                            judul="Sudah jadi SPK"
                            aksi={
                                <Link
                                    href={`/admin/spk/${booking.workOrderNumber}`}
                                    className="font-semibold underline"
                                >
                                    Buka SPK {booking.workOrderNumber}
                                </Link>
                            }
                        />
                    )}
                    {(booking.wa.bookingConfirmed || booking.wa.bookingRejected) && (
                        <Kartu judul="WhatsApp">
                            <StatusWaBooking label="konfirmasi" wa={booking.wa.bookingConfirmed} />
                            <StatusWaBooking label="penolakan" wa={booking.wa.bookingRejected} />
                            {(booking.wa.bookingConfirmed?.status === 'failed' ||
                                booking.wa.bookingRejected?.status === 'failed') && (
                                <p className="mt-2 text-sm text-redup">
                                    Pesan booking tidak bisa dikirim ulang dari sini. Hubungi
                                    pelanggan langsung di {formatNomorHp(booking.phone)}.
                                </p>
                            )}
                        </Kartu>
                    )}
                </div>
            </div>

            {dialog === 'tolak' && (
                <DialogAlasan
                    judul={`Tolak booking ${booking.number}?`}
                    deskripsi="Alasan ini dikirim ke pelanggan lewat WhatsApp dan tampil di halaman booking-nya."
                    labelAlasan="Alasan tolak"
                    labelKirim="Tolak booking"
                    contoh="Mis. bengkel tutup tanggal itu, silakan pilih tanggal lain."
                    onTutup={() => setDialog(null)}
                    onKirim={async (reason) => {
                        const hasil = await klienStaf().tolakBooking(booking.bookingId, { reason })
                        if (!hasil.ok) return pesanGalat(hasil.galat)
                        setBooking(hasil.data)
                        setDialog(null)
                        tampilkanToast(`Booking ${hasil.data.number} ditolak.`)
                        return null
                    }}
                />
            )}
            {dialog === 'spk' && (
                <DialogJadikanSpk
                    booking={booking}
                    onTutup={() => setDialog(null)}
                    onSelesai={(nomor) => {
                        tampilkanToast(`Booking dijadikan SPK ${nomor}.`)
                        router.push(`/admin/spk/${nomor}`)
                    }}
                />
            )}
        </>
    )
}

function DialogJadikanSpk({
    booking,
    onTutup,
    onSelesai,
}: {
    booking: Booking
    onTutup: () => void
    onSelesai: (nomor: string) => void
}) {
    const f = useIsian<IsianDataSpk>({
        complaint: '',
        odometer: '',
        estimatedDoneAt: '',
        mechanicId: '',
    })
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)
    const simpan = () =>
        kirim({
            periksa: () => {
                const cek = periksaDataSpk(f.isian, true)
                if (!cek.ok) return cek
                const { odometer, estimatedDoneAt, mechanicId } = cek.badan
                return { ok: true as const, badan: { odometer, estimatedDoneAt, mechanicId } }
            },
            kirim: (badan) => klienStaf().jadikanSpk(booking.bookingId, badan),
            aturan: ATURAN_DATA_SPK,
            urutan: URUTAN_DATA_SPK,
            idKolom: idDataSpk,
            berhasil: (hasil) => onSelesai(hasil.workOrder.number),
        })
    return (
        <DialogForm
            judul={`Jadikan SPK dari ${booking.number}`}
            deskripsi={`Pelanggan dicari dari nomor ${formatNomorHp(booking.phone)} dan kendaraan dari plat ${booking.plate}; dibuat bila belum ada. Keluhan disalin dari booking${booking.service ? `, dan ${booking.service.name} menjadi item pertama` : ''}.`}
            labelKirim="Jadikan SPK"
            sibuk={sibuk}
            pesan={f.pesan}
            onKirim={() => void simpan()}
            onTutup={onTutup}
        >
            <KolomDataSpk isian={f.isian} galat={f.galat} ubah={f.ubah} tanpaKeluhan />
        </DialogForm>
    )
}
