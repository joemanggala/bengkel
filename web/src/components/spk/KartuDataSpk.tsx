// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import Link from 'next/link'
import DialogForm, { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import Field, { atributField } from '@/components/ui/Field'
import Kartu from '@/components/ui/Kartu'
import Textarea from '@/components/ui/Textarea'
import Tombol from '@/components/ui/Tombol'
import { useAksi } from '@/components/ui/useAksi'
import { klienStaf } from '@/klien/peramban'
import { LABEL_JENIS_KENDARAAN } from '@/skema/pelanggan'
import type { SpkDetail } from '@/skema/spk'
import type { PeranStaf } from '@/skema/staf'
import { formatAngka, formatKendaraan, formatNomorHp, formatWaktuWib } from '@/utils/format'
import { spkTerbuka } from '@/utils/statusSpk'
import { periksaTeks, waktuApiKeLokal } from '@/utils/validasi'
import KolomDataSpk, { URUTAN_DATA_SPK, idDataSpk } from './KolomDataSpk'
import { ATURAN_DATA_SPK, periksaDataSpk, type IsianDataSpk } from './logika'

type Props = { spk: SpkDetail; peran: PeranStaf; onSpk: (spk: SpkDetail) => void }

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-0.5 py-2 sm:grid-cols-[9rem_1fr]">
            <dt className="text-sm font-semibold text-redup">{label}</dt>
            <dd className="min-w-0 whitespace-pre-line break-words">{children}</dd>
        </div>
    )
}

// Pelanggan, kendaraan, dan data SPK. Pemilik dan kasir mengubah mekanik, keluhan, odometer, dan
// estimasi; mekanik hanya mengisi diagnosis (spec: kunci lain dari mekanik ditolak 403). Semua
// perubahan hanya selama SPK belum selesai, supaya rekap tanggal yang sudah lewat tidak berubah.
export default function KartuDataSpk({ spk, peran, onSpk }: Props) {
    const kasir = peran !== 'mechanic'
    const terbuka = spkTerbuka(spk.status)
    const [ubah, setUbah] = useState(false)
    const [diagnosis, setDiagnosis] = useState(spk.diagnosis)
    const [galatDiagnosis, setGalatDiagnosis] = useState<string | null>(null)
    const { sibuk, jalankan } = useAksi()

    const simpanDiagnosis = async () => {
        const galat = periksaTeks(diagnosis, { ...ATURAN_DATA_SPK.diagnosis, opsional: true })
        setGalatDiagnosis(galat)
        if (galat) return
        await jalankan(
            'diagnosis',
            () => klienStaf().ubahSpk(spk.number, { diagnosis: diagnosis.trim() }),
            {
                berhasil: 'Diagnosis disimpan.',
                sesudah: onSpk,
            },
        )
    }

    return (
        <Kartu
            judul="Data SPK"
            aksi={
                kasir &&
                terbuka && (
                    <Tombol varian="kecil" onClick={() => setUbah(true)}>
                        Ubah
                    </Tombol>
                )
            }
        >
            <dl className="divide-y divide-garis">
                <Baris label="Kendaraan">
                    <span className="font-semibold">{formatKendaraan(spk.vehicle)}</span>
                    <span className="block text-sm text-redup">
                        {LABEL_JENIS_KENDARAAN[spk.vehicle.type]}
                        {spk.vehicle.year !== null && ` · ${spk.vehicle.year}`}
                        {spk.vehicle.color && ` · ${spk.vehicle.color}`}
                    </span>
                </Baris>
                <Baris label="Pelanggan">
                    {kasir ? (
                        <Link
                            href={`/admin/pelanggan/${spk.customer.customerId}`}
                            className="font-semibold text-utama-tua underline-offset-4 hover:underline"
                        >
                            {spk.customer.name}
                        </Link>
                    ) : (
                        spk.customer.name
                    )}
                    <span className="block text-sm text-redup">
                        {formatNomorHp(spk.customer.phone)}
                    </span>
                </Baris>
                <Baris label="Keluhan">{spk.complaint}</Baris>
                <Baris label="Mekanik">{spk.mechanic?.name ?? 'Belum ditugaskan'}</Baris>
                <Baris label="Odometer">
                    {spk.odometer === null ? '–' : `${formatAngka(spk.odometer)} km`}
                </Baris>
                <Baris label="Perkiraan selesai">
                    {spk.estimatedDoneAt ? formatWaktuWib(spk.estimatedDoneAt) : '–'}
                </Baris>
                <Baris label="Dibuat">
                    {formatWaktuWib(spk.createdAt)} · {spk.createdBy.name}
                </Baris>
                {spk.booking && (
                    <Baris label="Dari booking">
                        {kasir ? (
                            <Link
                                href={`/admin/booking/${spk.booking.bookingId}`}
                                className="font-semibold text-utama-tua underline-offset-4 hover:underline"
                            >
                                {spk.booking.number}
                            </Link>
                        ) : (
                            spk.booking.number
                        )}
                    </Baris>
                )}
            </dl>
            <div className="mt-4 border-t border-garis pt-4">
                {terbuka ? (
                    <form
                        noValidate
                        onSubmit={(e) => {
                            e.preventDefault()
                            void simpanDiagnosis()
                        }}
                        className="space-y-3"
                    >
                        <Field
                            id="spk-diagnosis"
                            label="Diagnosis"
                            galat={galatDiagnosis ?? undefined}
                            petunjuk="Hasil pemeriksaan mekanik. Tidak tampil ke pelanggan."
                        >
                            <Textarea
                                {...atributField(
                                    'spk-diagnosis',
                                    galatDiagnosis ?? undefined,
                                    true,
                                )}
                                value={diagnosis}
                                onChange={(e) => setDiagnosis(e.target.value)}
                                rows={3}
                            />
                        </Field>
                        <Tombol
                            varian="sekunder"
                            type="submit"
                            sibuk={sibuk === 'diagnosis'}
                            disabled={diagnosis.trim() === spk.diagnosis}
                        >
                            Simpan diagnosis
                        </Tombol>
                    </form>
                ) : (
                    <dl>
                        <Baris label="Diagnosis">{spk.diagnosis || '–'}</Baris>
                    </dl>
                )}
            </div>
            {ubah && <DialogUbahSpk spk={spk} onSpk={onSpk} onTutup={() => setUbah(false)} />}
        </Kartu>
    )
}

function DialogUbahSpk({
    spk,
    onSpk,
    onTutup,
}: {
    spk: SpkDetail
    onSpk: (s: SpkDetail) => void
    onTutup: () => void
}) {
    const f = useIsian<IsianDataSpk>({
        complaint: spk.complaint,
        odometer: spk.odometer === null ? '' : String(spk.odometer),
        estimatedDoneAt: waktuApiKeLokal(spk.estimatedDoneAt),
        mechanicId: spk.mechanic?.staffId ?? '',
    })
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)
    const simpan = () =>
        kirim({
            periksa: () => periksaDataSpk(f.isian),
            kirim: (badan) => klienStaf().ubahSpk(spk.number, badan),
            aturan: ATURAN_DATA_SPK,
            urutan: URUTAN_DATA_SPK,
            idKolom: idDataSpk,
            berhasil: (baru) => {
                onSpk(baru)
                onTutup()
            },
        })
    return (
        <DialogForm
            judul={`Ubah SPK ${spk.number}`}
            labelKirim="Simpan perubahan"
            sibuk={sibuk}
            pesan={f.pesan}
            onKirim={() => void simpan()}
            onTutup={onTutup}
        >
            <KolomDataSpk
                isian={f.isian}
                galat={f.galat}
                ubah={f.ubah}
                mekanikSekarang={spk.mechanic}
            />
        </DialogForm>
    )
}
