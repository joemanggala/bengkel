// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import KotakPesan from '@/components/ui/KotakPesan'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import { klienStaf } from '@/klien/peramban'
import KolomDataSpk, { URUTAN_DATA_SPK, idDataSpk } from './KolomDataSpk'
import { ATURAN_DATA_SPK, periksaDataSpk, type IsianDataSpk } from './logika'

type Props = { vehicleId: string; onSelesai: (nomor: string) => void }

// Langkah terakhir SPK baru. Sesudah tersimpan backend mengirim WhatsApp berisi tautan lacak;
// gagal kirim tidak menggagalkan SPK (bisa dikirim ulang dari rincian SPK).
export default function FormSpkBaru({ vehicleId, onSelesai }: Props) {
    const { tampilkanToast } = useToast()
    const f = useIsian<IsianDataSpk>({
        complaint: '',
        odometer: '',
        estimatedDoneAt: '',
        mechanicId: '',
    })
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)

    const simpan = () =>
        kirim({
            periksa: () => periksaDataSpk(f.isian),
            kirim: (badan) => klienStaf().buatSpk({ vehicleId, ...badan }),
            aturan: ATURAN_DATA_SPK,
            urutan: URUTAN_DATA_SPK,
            idKolom: idDataSpk,
            berhasil: (spk) => {
                const wa = spk.wa.workOrderCreated?.status
                tampilkanToast(
                    wa === 'sent'
                        ? `SPK ${spk.number} dibuat. Tautan lacak terkirim lewat WhatsApp.`
                        : `SPK ${spk.number} dibuat, tetapi WhatsApp belum terkirim. Kirim ulang dari rincian SPK.`,
                    wa === 'sent' ? 'berhasil' : 'galat',
                )
                onSelesai(spk.number)
            },
        })

    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault()
                void simpan()
            }}
            className="space-y-5"
        >
            {f.pesan && <KotakPesan jenis="galat">{f.pesan}</KotakPesan>}
            {f.galat.vehicleId && <KotakPesan jenis="galat">{f.galat.vehicleId}</KotakPesan>}
            <fieldset disabled={sibuk} className="min-w-0 space-y-5">
                <KolomDataSpk isian={f.isian} galat={f.galat} ubah={f.ubah} />
            </fieldset>
            <Tombol type="submit" sibuk={sibuk} className="w-full sm:w-auto">
                Buat SPK
            </Tombol>
        </form>
    )
}
