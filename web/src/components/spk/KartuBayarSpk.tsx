// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import Field, { atributField } from '@/components/ui/Field'
import InputRupiah from '@/components/ui/InputRupiah'
import Kartu from '@/components/ui/Kartu'
import KotakPesan from '@/components/ui/KotakPesan'
import Pilihan from '@/components/ui/Pilihan'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import { klienStaf } from '@/klien/peramban'
import { LABEL_METODE_BAYAR, METODE_BAYAR, type MetodeBayar, type SpkDetail } from '@/skema/spk'
import { formatRupiah, formatWaktu, rapikanIsianRupiah } from '@/utils/format'
import { cekBayarSpk, kembalian } from '@/utils/statusSpk'
import { bacaBilangan, periksaBilangan, saringGalat } from '@/utils/validasi'
import { ATURAN_BAYAR } from './logika'

type Props = { spk: SpkDetail; bolehBayar: boolean; onSpk: (spk: SpkDetail) => void }

type Isian = { amount: string; method: MetodeBayar; diterima: string }

const id = (nama: string) => `bayar-${nama}`

// Pembayaran SPK: daftar pembayaran, sisa tagihan, dan form bayar (uang muka atau cicilan sejak
// SPK dibuat, sampai lunas). Uang kembalian hanya dihitung di layar ini, tidak dikirim ke API.
export default function KartuBayarSpk({ spk, bolehBayar, onSpk }: Props) {
    const { tampilkanToast } = useToast()
    const sisa = spk.remainingAmount
    const f = useIsian<Isian>({
        amount: rapikanIsianRupiah(String(sisa)),
        method: 'cash',
        diterima: '',
    })
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)
    const [sisaTerakhir, setSisaTerakhir] = useState(sisa)
    // Sisa berubah (item ditambah, dibayar dari perangkat lain): isian jumlah ikut menyesuaikan.
    if (sisa !== sisaTerakhir) {
        setSisaTerakhir(sisa)
        f.ubah('amount', rapikanIsianRupiah(String(sisa)))
    }
    const bisa = bolehBayar && cekBayarSpk({ status: spk.status, sisa }) === null
    const jumlah = bacaBilangan(f.isian.amount)
    const diterima = bacaBilangan(f.isian.diterima)
    const uangKembali =
        f.isian.method === 'cash' &&
        jumlah !== null &&
        diterima !== null &&
        !Number.isNaN(jumlah) &&
        !Number.isNaN(diterima)
            ? kembalian(diterima, jumlah)
            : undefined

    const bayar = () =>
        kirim({
            periksa: () => {
                const cek = periksaBilangan(f.isian.amount, {
                    ...ATURAN_BAYAR.amount,
                    min: 1,
                    maks: sisa,
                })
                const fields = saringGalat({
                    amount: cek.ok ? null : cek.pesan,
                    diterima:
                        uangKembali === null ? 'Uang diterima kurang dari jumlah bayar.' : null,
                })
                if (!cek.ok || cek.nilai === null || Object.keys(fields).length > 0)
                    return { ok: false as const, fields }
                return { ok: true as const, badan: { amount: cek.nilai, method: f.isian.method } }
            },
            kirim: (badan) => klienStaf().catatPembayaran(spk.number, badan),
            aturan: { ...ATURAN_BAYAR, amount: { ...ATURAN_BAYAR.amount, maks: sisa } },
            urutan: ['amount', 'method', 'diterima'],
            idKolom: id,
            berhasil: (baru) => {
                onSpk(baru)
                f.ubah('diterima', '')
                tampilkanToast(
                    baru.paymentStatus === 'paid'
                        ? `Pembayaran dicatat. SPK ${baru.number} lunas.`
                        : `Pembayaran dicatat. Sisa ${formatRupiah(baru.remainingAmount)}.`,
                )
            },
        })

    return (
        <Kartu judul="Pembayaran">
            {spk.payments.length > 0 ? (
                <ol className="divide-y divide-garis">
                    {spk.payments.map((p, i) => (
                        <li
                            key={p.paymentId}
                            className="flex items-center justify-between gap-3 py-2.5"
                        >
                            <span>
                                <span className="block font-semibold">
                                    {i + 1}. {LABEL_METODE_BAYAR[p.method]}
                                </span>
                                <span className="text-sm text-redup">
                                    {formatWaktu(p.createdAt)} · {p.recordedBy.name}
                                </span>
                            </span>
                            <span className="angka font-semibold">{formatRupiah(p.amount)}</span>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-redup">Belum ada pembayaran.</p>
            )}
            <dl className="angka mt-3 space-y-1 border-t border-garis pt-3">
                <div className="flex justify-between">
                    <dt>Terbayar</dt>
                    <dd>{formatRupiah(spk.paidAmount)}</dd>
                </div>
                <div className="flex justify-between text-lg font-bold">
                    <dt>Sisa</dt>
                    <dd>{formatRupiah(sisa)}</dd>
                </div>
            </dl>
            {bisa && (
                <form
                    noValidate
                    onSubmit={(e) => {
                        e.preventDefault()
                        void bayar()
                    }}
                    className="mt-5 space-y-4 border-t border-garis pt-4"
                >
                    {f.pesan && <KotakPesan jenis="galat">{f.pesan}</KotakPesan>}
                    <fieldset disabled={sibuk} className="grid min-w-0 gap-4 sm:grid-cols-2">
                        <Field id={id('amount')} label="Jumlah bayar" galat={f.galat.amount}>
                            <InputRupiah
                                {...atributField(id('amount'), f.galat.amount)}
                                value={f.isian.amount}
                                onChange={(v) => f.ubah('amount', v)}
                            />
                        </Field>
                        <Field id={id('method')} label="Metode" galat={f.galat.method}>
                            <Pilihan
                                {...atributField(id('method'), f.galat.method)}
                                opsi={METODE_BAYAR.map((m) => ({
                                    nilai: m,
                                    label: LABEL_METODE_BAYAR[m],
                                }))}
                                value={f.isian.method}
                                onChange={(e) => f.ubah('method', e.target.value as MetodeBayar)}
                            />
                        </Field>
                        {f.isian.method === 'cash' && (
                            <Field
                                id={id('diterima')}
                                label="Uang diterima"
                                galat={f.galat.diterima}
                                samping={<span className="text-sm text-redup">Opsional</span>}
                                petunjuk={
                                    typeof uangKembali === 'number'
                                        ? `Kembalian ${formatRupiah(uangKembali)}`
                                        : 'Untuk menghitung kembalian.'
                                }
                            >
                                <InputRupiah
                                    {...atributField(id('diterima'), f.galat.diterima, true)}
                                    value={f.isian.diterima}
                                    onChange={(v) => f.ubah('diterima', v)}
                                />
                            </Field>
                        )}
                    </fieldset>
                    <Tombol type="submit" sibuk={sibuk}>
                        Catat pembayaran
                    </Tombol>
                </form>
            )}
        </Kartu>
    )
}
