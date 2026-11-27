// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import Linimasa from '@/components/spk/Linimasa'
import KotakPesan from '@/components/ui/KotakPesan'
import { LencanaBayar, LencanaStatusSpk } from '@/components/ui/Lencana'
import { useSegarBerkala } from '@/components/ui/useSegarBerkala'
import { klienPublik } from '@/klien/peramban'
import { LABEL_JENIS_KENDARAAN } from '@/skema/pelanggan'
import { LABEL_JENIS_ITEM, type SpkPublik } from '@/skema/spk'
import { formatAngka, formatKendaraan, formatRupiah, formatWaktuWib } from '@/utils/format'

// Kalimat untuk pelanggan per status.
const KABAR: Record<SpkPublik['status'], string> = {
    QUEUED: 'Kendaraanmu sudah tercatat dan sedang antre.',
    IN_PROGRESS: 'Kendaraanmu sedang dikerjakan.',
    WAITING_PARTS: 'Pengerjaan menunggu sparepart datang.',
    DONE: 'Servis selesai. Kendaraan siap diambil setelah lunas.',
    PICKED_UP: 'Kendaraan sudah diambil. Terima kasih sudah servis di sini.',
    CANCELLED: 'SPK ini dibatalkan bengkel.',
}

// Selama kendaraan masih di bengkel halaman memuat ulang berkala (polling, tanpa WebSocket).
const JEDA_MS = 30_000

type Props = { token: string; awal: SpkPublik }

// Halaman lacak servis, sekaligus nota online (satu tautan WhatsApp untuk pelanggan, bukan dua): status, linimasa, kendaraan, rincian
// item, total, terbayar, dan sisa. Tidak ada nama mekanik, diagnosis, maupun harga beli: API
// publik memang tidak mengirimnya.
export default function LacakServis({ token, awal }: Props) {
    const [spk, setSpk] = useState(awal)
    const [hilang, setHilang] = useState(false)
    const masihDiBengkel = spk.status !== 'PICKED_UP' && spk.status !== 'CANCELLED'

    useSegarBerkala(
        async () => {
            const hasil = await klienPublik().lacakServisPublik(token)
            if (hasil.ok) {
                setSpk(hasil.data)
                return 'ok'
            }
            // Tautan dibuat ulang kasir selagi halaman terbuka: token lama mati.
            if (hasil.status === 404) {
                setHilang(true)
                return 'henti'
            }
            return 'gagal'
        },
        { jedaMs: JEDA_MS, aktif: masihDiBengkel && !hilang },
    )

    const adaItem = spk.items.length > 0
    return (
        <div className="space-y-5">
            {hilang && (
                <KotakPesan jenis="peringatan" judul="Tautan ini sudah diganti bengkel">
                    Data di bawah mungkin bukan yang terbaru. Minta tautan lacak baru lewat WhatsApp
                    bengkel.
                </KotakPesan>
            )}
            <header className="rounded-2xl border border-garis bg-permukaan p-5">
                <p className="text-sm font-semibold text-redup">SPK {spk.number}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-extrabold leading-tight">
                        {formatKendaraan(spk.vehicle)}
                    </h1>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <LencanaStatusSpk status={spk.status} />
                    {/* SPK tanpa item bertotal 0 dianggap lunas oleh API; lencana bayar
                        disembunyikan supaya tidak membingungkan. */}
                    {adaItem && <LencanaBayar status={spk.paymentStatus} />}
                </div>
                <p className="mt-3 leading-relaxed">{KABAR[spk.status]}</p>
                {spk.status === 'CANCELLED' && spk.cancelReason && (
                    <p className="mt-1 font-semibold">Alasan: {spk.cancelReason}</p>
                )}
                {spk.estimatedDoneAt && masihDiBengkel && spk.status !== 'DONE' && (
                    <p className="mt-1 text-sm text-redup">
                        Perkiraan selesai: {formatWaktuWib(spk.estimatedDoneAt)}
                    </p>
                )}
            </header>

            <section
                className="rounded-2xl border border-garis bg-permukaan p-5"
                aria-labelledby="judul-rincian"
            >
                <h2 id="judul-rincian" className="text-lg font-bold">
                    Rincian biaya
                </h2>
                {adaItem ? (
                    <ul className="mt-3 divide-y divide-garis">
                        {spk.items.map((item, i) => (
                            <li
                                key={`${item.name}-${i}`}
                                className="flex justify-between gap-3 py-2.5"
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="angka text-sm text-redup">
                                        {LABEL_JENIS_ITEM[item.type]} · {formatAngka(item.quantity)}{' '}
                                        × {formatRupiah(item.price)}
                                    </p>
                                </div>
                                <p className="angka shrink-0 font-semibold">
                                    {formatRupiah(item.subtotal)}
                                </p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-2 text-redup">
                        Belum ada item. Rincian jasa dan sparepart muncul di sini setelah diperiksa
                        mekanik.
                    </p>
                )}
                <dl className="angka mt-3 space-y-1 border-t border-garis pt-3">
                    {[
                        ['Jasa', spk.serviceSubtotal],
                        ['Sparepart', spk.partSubtotal],
                    ].map(([label, nilai]) => (
                        <div key={label} className="flex justify-between text-redup">
                            <dt>{label}</dt>
                            <dd>{formatRupiah(Number(nilai))}</dd>
                        </div>
                    ))}
                    <div className="flex justify-between text-lg font-bold">
                        <dt>Total</dt>
                        <dd>{formatRupiah(spk.total)}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt>Terbayar</dt>
                        <dd>{formatRupiah(spk.paidAmount)}</dd>
                    </div>
                    <div className="flex justify-between font-semibold">
                        <dt>Sisa</dt>
                        <dd>{formatRupiah(spk.remainingAmount)}</dd>
                    </div>
                </dl>
            </section>

            <section
                className="rounded-2xl border border-garis bg-permukaan p-5"
                aria-labelledby="judul-linimasa"
            >
                <h2 id="judul-linimasa" className="mb-4 text-lg font-bold">
                    Perjalanan servis
                </h2>
                <Linimasa baris={spk.timeline} />
            </section>

            <dl className="space-y-1 rounded-2xl border border-garis bg-permukaan p-5 text-[15px]">
                <div className="flex justify-between gap-3">
                    <dt className="text-redup">Pelanggan</dt>
                    <dd className="text-right">{spk.customerName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                    <dt className="text-redup">Nomor WhatsApp</dt>
                    <dd className="text-right">{spk.customerPhone}</dd>
                </div>
                <div className="flex justify-between gap-3">
                    <dt className="text-redup">Jenis</dt>
                    <dd className="text-right">{LABEL_JENIS_KENDARAAN[spk.vehicle.type]}</dd>
                </div>
                <div className="flex justify-between gap-3">
                    <dt className="text-redup">Masuk</dt>
                    <dd className="text-right">{formatWaktuWib(spk.createdAt)}</dd>
                </div>
                <div className="pt-2">
                    <dt className="text-redup">Keluhan</dt>
                    <dd className="whitespace-pre-line">{spk.complaint}</dd>
                </div>
            </dl>
            {spk.outlet.receiptFooter && (
                <p className="whitespace-pre-line text-center text-sm text-redup">
                    {spk.outlet.receiptFooter}
                </p>
            )}
        </div>
    )
}
