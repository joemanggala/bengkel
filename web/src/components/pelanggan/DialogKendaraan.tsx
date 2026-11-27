// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import DialogForm, { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import Pilihan from '@/components/ui/Pilihan'
import { klienStaf } from '@/klien/peramban'
import { JENIS_KENDARAAN, LABEL_JENIS_KENDARAAN, type Kendaraan } from '@/skema/pelanggan'
import { PESAN_BAKU } from '@/utils/galat'
import { tampilanPlat, kunciPlatMentah } from '@/utils/plat'
import { ATURAN_KENDARAAN, isianKendaraan, periksaKendaraan, type IsianKendaraan } from './logika'

const id = (nama: string) => `kendaraan-${nama}`
const URUTAN = ['type', 'plate', 'brand', 'model', 'year', 'color']

type Props = {
    // Pemilik kendaraan baru; untuk mengubah, pemilik tidak bisa diganti.
    customerId: string
    kendaraan?: Kendaraan
    // Plat yang sudah diketik di kotak cari, untuk mengisi awal form tambah.
    plateAwal?: string
    onSelesai: (k: Kendaraan) => void
    onTutup: () => void
}

// Tambah atau ubah kendaraan seorang pelanggan. Plat dinormalkan backend (B1234XYZ untuk keunikan,
// "B 1234 XYZ" untuk tampilan); pratinjau tampilannya muncul di bawah kotak selagi diketik.
export default function DialogKendaraan({
    customerId,
    kendaraan,
    plateAwal,
    onSelesai,
    onTutup,
}: Props) {
    const f = useIsian<IsianKendaraan>(() => ({
        ...isianKendaraan(kendaraan),
        ...(kendaraan ? {} : { plate: plateAwal ?? '' }),
    }))
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)
    const kunci = kunciPlatMentah(f.isian.plate)

    const simpan = () =>
        kirim({
            periksa: () => periksaKendaraan(f.isian),
            kirim: (badan) =>
                kendaraan
                    ? klienStaf().ubahKendaraan(kendaraan.vehicleId, badan)
                    : klienStaf().tambahKendaraan(customerId, badan),
            aturan: ATURAN_KENDARAAN,
            khusus: { plate_taken: { field: 'plate', pesan: `${PESAN_BAKU.plate_taken}.` } },
            urutan: URUTAN,
            idKolom: id,
            berhasil: onSelesai,
        })

    return (
        <DialogForm
            judul={kendaraan ? `Ubah ${kendaraan.plate}` : 'Tambah kendaraan'}
            labelKirim={kendaraan ? 'Simpan perubahan' : 'Tambah kendaraan'}
            sibuk={sibuk}
            pesan={f.pesan}
            onKirim={() => void simpan()}
            onTutup={onTutup}
        >
            <Field id={id('type')} label="Jenis kendaraan" galat={f.galat.type}>
                <Pilihan
                    {...atributField(id('type'), f.galat.type)}
                    opsi={JENIS_KENDARAAN.map((j) => ({
                        nilai: j,
                        label: LABEL_JENIS_KENDARAAN[j],
                    }))}
                    kosong="Pilih jenis"
                    value={f.isian.type}
                    onChange={(e) => f.ubah('type', e.target.value as IsianKendaraan['type'])}
                />
            </Field>
            <Field
                id={id('plate')}
                label="Plat nomor"
                galat={f.galat.plate}
                petunjuk={
                    /^[A-Z][A-Z0-9]{1,11}$/.test(kunci)
                        ? `Tersimpan sebagai ${tampilanPlat(kunci)}`
                        : undefined
                }
            >
                <Input
                    {...atributField(id('plate'), f.galat.plate, true)}
                    value={f.isian.plate}
                    onChange={(e) => f.ubah('plate', e.target.value)}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="B 1234 XYZ"
                />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
                <Field id={id('brand')} label="Merek" galat={f.galat.brand}>
                    <Input
                        {...atributField(id('brand'), f.galat.brand)}
                        value={f.isian.brand}
                        onChange={(e) => f.ubah('brand', e.target.value)}
                        placeholder="Honda"
                    />
                </Field>
                <Field
                    id={id('model')}
                    label="Tipe"
                    galat={f.galat.model}
                    samping={<span className="text-sm text-redup">Opsional</span>}
                >
                    <Input
                        {...atributField(id('model'), f.galat.model)}
                        value={f.isian.model}
                        onChange={(e) => f.ubah('model', e.target.value)}
                        placeholder="Vario 125"
                    />
                </Field>
                <Field
                    id={id('year')}
                    label="Tahun"
                    galat={f.galat.year}
                    samping={<span className="text-sm text-redup">Opsional</span>}
                >
                    <Input
                        {...atributField(id('year'), f.galat.year)}
                        value={f.isian.year}
                        onChange={(e) => f.ubah('year', e.target.value)}
                        inputMode="numeric"
                        placeholder="2021"
                    />
                </Field>
                <Field
                    id={id('color')}
                    label="Warna"
                    galat={f.galat.color}
                    samping={<span className="text-sm text-redup">Opsional</span>}
                >
                    <Input
                        {...atributField(id('color'), f.galat.color)}
                        value={f.isian.color}
                        onChange={(e) => f.ubah('color', e.target.value)}
                    />
                </Field>
            </div>
        </DialogForm>
    )
}
