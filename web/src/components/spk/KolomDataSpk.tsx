// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import Pilihan from '@/components/ui/Pilihan'
import Textarea from '@/components/ui/Textarea'
import { opsiMekanik, useMekanik } from '@/components/ui/useMekanik'
import type { StafRingkas } from '@/skema/staf'
import type { IsianDataSpk } from './logika'

export const idDataSpk = (nama: string) => `spk-${nama}`
export const URUTAN_DATA_SPK = [
    'vehicleId',
    'complaint',
    'odometer',
    'estimatedDoneAt',
    'mechanicId',
]

type Props = {
    isian: IsianDataSpk
    galat: Record<string, string>
    ubah: <K extends keyof IsianDataSpk>(kunci: K, nilai: IsianDataSpk[K]) => void
    // Menjadikan booking SPK: keluhan disalin dari booking, jadi kolomnya tidak ditampilkan.
    tanpaKeluhan?: boolean
    // Mekanik yang tertera sekarang (mungkin sudah nonaktif), untuk mengubah SPK.
    mekanikSekarang?: StafRingkas | null
}

// Kolom data SPK yang dipakai bersama: SPK baru, jadikan booking SPK, dan ubah SPK.
export default function KolomDataSpk({ isian, galat, ubah, tanpaKeluhan, mekanikSekarang }: Props) {
    const mekanik = useMekanik()
    const id = idDataSpk
    return (
        <>
            {!tanpaKeluhan && (
                <Field id={id('complaint')} label="Keluhan" galat={galat.complaint}>
                    <Textarea
                        {...atributField(id('complaint'), galat.complaint)}
                        value={isian.complaint}
                        onChange={(e) => ubah('complaint', e.target.value)}
                        rows={3}
                        placeholder="Mis. servis rutin, rem depan bunyi."
                    />
                </Field>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
                <Field
                    id={id('odometer')}
                    label="Odometer (km)"
                    galat={galat.odometer}
                    samping={<span className="text-sm text-redup">Opsional</span>}
                >
                    <Input
                        {...atributField(id('odometer'), galat.odometer)}
                        value={isian.odometer}
                        onChange={(e) => ubah('odometer', e.target.value)}
                        inputMode="numeric"
                        className="angka"
                        placeholder="18250"
                    />
                </Field>
                <Field
                    id={id('estimatedDoneAt')}
                    label="Perkiraan selesai"
                    galat={galat.estimatedDoneAt}
                    samping={<span className="text-sm text-redup">Opsional</span>}
                    petunjuk="Jam WIB. Tampil di halaman lacak pelanggan."
                >
                    <Input
                        {...atributField(id('estimatedDoneAt'), galat.estimatedDoneAt, true)}
                        type="datetime-local"
                        value={isian.estimatedDoneAt}
                        onChange={(e) => ubah('estimatedDoneAt', e.target.value)}
                    />
                </Field>
            </div>
            <Field
                id={id('mechanicId')}
                label="Mekanik"
                galat={galat.mechanicId}
                petunjuk="Bisa ditugaskan nanti. Mekanik hanya melihat SPK yang ditugaskan kepadanya."
            >
                <Pilihan
                    {...atributField(id('mechanicId'), galat.mechanicId, true)}
                    opsi={opsiMekanik(mekanik, mekanikSekarang)}
                    kosong="Belum ditugaskan"
                    value={isian.mechanicId}
                    onChange={(e) => ubah('mechanicId', e.target.value)}
                />
            </Field>
        </>
    )
}
