// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import DialogKonfirmasi from '@/components/ui/DialogKonfirmasi'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import Kartu from '@/components/ui/Kartu'
import KotakPesan from '@/components/ui/KotakPesan'
import { Lencana } from '@/components/ui/Lencana'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import { useAksi } from '@/components/ui/useAksi'
import { klienStaf } from '@/klien/peramban'
import {
    JENIS_PESAN_WA_SPK,
    LABEL_JENIS_PESAN_WA_SPK,
    type JenisPesanWaSpk,
    type SpkDetail,
    type StatusWa,
} from '@/skema/spk'
import { formatWaktu } from '@/utils/format'
import type { TautanLacak } from '@/utils/tautanLacak'
import { periksaNomorHp } from '@/utils/validasi'

type Props = { spk: SpkDetail; tautanLacak: TautanLacak; onSpk: (spk: SpkDetail) => void }

const KUNCI: Record<JenisPesanWaSpk, keyof SpkDetail['wa']> = {
    work_order_created: 'workOrderCreated',
    work_order_done: 'workOrderDone',
    receipt: 'receipt',
}

// Apakah jenis pesan ini boleh dikirim untuk status SPK sekarang (spec: kirimWaSpk).
const bolehKirim = (jenis: JenisPesanWaSpk, status: SpkDetail['status']): boolean => {
    if (status === 'CANCELLED') return false
    if (jenis === 'work_order_done') return status === 'DONE' || status === 'PICKED_UP'
    return true
}

function StatusKirim({ wa }: { wa: StatusWa | null }) {
    if (!wa) return <Lencana nada="netral">Belum dikirim</Lencana>
    return wa.status === 'sent' ? (
        <Lencana nada="sukses">Terkirim {formatWaktu(wa.createdAt)}</Lencana>
    ) : (
        <Lencana nada="bahaya">Gagal {formatWaktu(wa.createdAt)}</Lencana>
    )
}

// WhatsApp SPK dan tautan lacak (pemilik dan kasir). Status kirim terakhir tiap jenis pesan dari
// `wa` di rincian SPK; pesan yang gagal bisa dikirim ulang, boleh ke nomor lain untuk sekali kirim.
// Tautan lacak disimpan apa adanya oleh backend (supaya bisa dikirim ulang di pesan WhatsApp), jadi
// bisa disalin kapan saja; membuat ulang mematikan tautan lama. Tautannya disusun RincianSpk dari
// PUBLIC_WEB_URL (src/utils/tautanLacak.ts), jadi sama dengan tautan di pesan WhatsApp dan di nota.
export default function KartuWaSpk({ spk, tautanLacak, onSpk }: Props) {
    const { tampilkanToast } = useToast()
    const { sibuk, jalankan } = useAksi()
    const [nomorLain, setNomorLain] = useState('')
    const [galatNomor, setGalatNomor] = useState<string | null>(null)
    const [buatUlang, setBuatUlang] = useState(false)
    const { tautan, catatan, galat } = tautanLacak

    const kirim = async (jenis: JenisPesanWaSpk) => {
        const phone = nomorLain.trim() === '' ? null : nomorLain
        const galat = phone === null ? null : periksaNomorHp(phone, { label: 'Nomor tujuan' })
        setGalatNomor(galat)
        if (galat) return
        await jalankan(jenis, () => klienStaf().kirimWaSpk(spk.number, { type: jenis, phone }), {
            berhasil: `Pesan "${LABEL_JENIS_PESAN_WA_SPK[jenis]}" terkirim.`,
            sesudah: onSpk,
        })
    }

    const salin = async () => {
        if (!tautan) return
        try {
            await navigator.clipboard.writeText(tautan)
            tampilkanToast('Tautan lacak disalin.')
        } catch {
            tampilkanToast(
                'Tautan belum bisa disalin otomatis. Pilih teksnya lalu salin manual.',
                'galat',
            )
        }
    }

    return (
        <Kartu judul="WhatsApp dan tautan lacak">
            <ul className="divide-y divide-garis">
                {JENIS_PESAN_WA_SPK.map((jenis) => (
                    <li
                        key={jenis}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    >
                        <span className="min-w-0">
                            <span className="block font-semibold">
                                {LABEL_JENIS_PESAN_WA_SPK[jenis]}
                            </span>
                            <StatusKirim wa={spk.wa[KUNCI[jenis]]} />
                        </span>
                        {bolehKirim(jenis, spk.status) && (
                            <Tombol
                                varian="kecil"
                                sibuk={sibuk === jenis}
                                disabled={sibuk !== null && sibuk !== jenis}
                                onClick={() => void kirim(jenis)}
                            >
                                {spk.wa[KUNCI[jenis]] ? 'Kirim ulang' : 'Kirim'}
                            </Tombol>
                        )}
                    </li>
                ))}
            </ul>
            {spk.status !== 'CANCELLED' && (
                <div className="mt-3">
                    <Field
                        id="wa-nomor"
                        label="Kirim ke nomor lain"
                        galat={galatNomor ?? undefined}
                        samping={<span className="text-sm text-redup">Opsional</span>}
                        petunjuk="Hanya untuk pengiriman ini; nomor pelanggan tidak berubah."
                    >
                        <Input
                            {...atributField('wa-nomor', galatNomor ?? undefined, true)}
                            value={nomorLain}
                            onChange={(e) => setNomorLain(e.target.value)}
                            type="tel"
                            inputMode="tel"
                            placeholder="0812-3456-7890"
                        />
                    </Field>
                </div>
            )}
            <div className="mt-5 border-t border-garis pt-4">
                <p className="text-sm font-semibold text-redup">Tautan lacak pelanggan</p>
                {galat ? (
                    <div className="mt-2">
                        <KotakPesan jenis="galat">{galat}</KotakPesan>
                    </div>
                ) : (
                    <p
                        className="mt-1 min-h-9 break-all rounded-lg bg-latar px-3 py-2 font-mono text-[13px]"
                        data-tautan-lacak
                    >
                        {tautan}
                    </p>
                )}
                {catatan && <p className="mt-1.5 text-sm text-redup">{catatan}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                    {tautan && (
                        <>
                            <Tombol varian="kecil" onClick={() => void salin()}>
                                Salin
                            </Tombol>
                            <a
                                href={tautan}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-11 items-center rounded-lg px-3.5 text-[15px] font-semibold text-utama-tua underline-offset-4 hover:underline"
                            >
                                Buka
                            </a>
                        </>
                    )}
                    <Tombol varian="kecil" onClick={() => setBuatUlang(true)}>
                        Buat ulang
                    </Tombol>
                </div>
            </div>
            <DialogKonfirmasi
                terbuka={buatUlang}
                judul="Buat ulang tautan lacak?"
                deskripsi="Tautan lama langsung tidak berlaku. Kirim ulang pesan WhatsApp supaya pelanggan menerima tautan baru."
                labelKonfirmasi="Buat tautan baru"
                berbahaya
                onTutup={() => setBuatUlang(false)}
                onKonfirmasi={async () => {
                    await jalankan('tautan', () => klienStaf().buatUlangTautanLacak(spk.number), {
                        berhasil: 'Tautan lacak baru dibuat. Tautan lama tidak berlaku lagi.',
                        sesudah: onSpk,
                    })
                    setBuatUlang(false)
                }}
            />
        </Kartu>
    )
}
