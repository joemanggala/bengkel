// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import DialogForm, { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import { klienStaf } from '@/klien/peramban'
import type { Pelanggan } from '@/skema/pelanggan'
import { PESAN_BAKU } from '@/utils/galat'
import { ATURAN_PELANGGAN, isianPelanggan, periksaPelanggan } from './logika'

const id = (nama: string) => `pelanggan-${nama}`
const URUTAN = ['name', 'phone', 'address', 'notes']

type Props = {
    // Pelanggan yang diubah; kosong = tambah pelanggan baru.
    pelanggan?: Pelanggan
    // Nomor HP yang sudah diketik di kotak cari, untuk mengisi awal form tambah.
    phoneAwal?: string
    onSelesai: (p: Pelanggan) => void
    onTutup: () => void
}

// Tambah atau ubah pelanggan. Nomor HP diterima 08..., +628..., atau 628... dan disimpan seragam
// oleh backend; nomor yang sudah dipakai pelanggan lain ditolak (phone_taken) di kolom nomor HP.
export default function DialogPelanggan({ pelanggan, phoneAwal, onSelesai, onTutup }: Props) {
    const f = useIsian(() => ({
        ...isianPelanggan(pelanggan),
        ...(pelanggan ? {} : { phone: phoneAwal ?? '' }),
    }))
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)

    const simpan = () =>
        kirim({
            periksa: () => periksaPelanggan(f.isian),
            kirim: (badan) =>
                pelanggan
                    ? klienStaf().ubahPelanggan(pelanggan.customerId, badan)
                    : klienStaf().buatPelanggan(badan),
            aturan: ATURAN_PELANGGAN,
            khusus: { phone_taken: { field: 'phone', pesan: `${PESAN_BAKU.phone_taken}.` } },
            urutan: URUTAN,
            idKolom: id,
            berhasil: onSelesai,
        })

    return (
        <DialogForm
            judul={pelanggan ? `Ubah ${pelanggan.name}` : 'Tambah pelanggan'}
            labelKirim={pelanggan ? 'Simpan perubahan' : 'Tambah pelanggan'}
            sibuk={sibuk}
            pesan={f.pesan}
            onKirim={() => void simpan()}
            onTutup={onTutup}
        >
            <Field id={id('name')} label="Nama" galat={f.galat.name}>
                <Input
                    {...atributField(id('name'), f.galat.name)}
                    value={f.isian.name}
                    onChange={(e) => f.ubah('name', e.target.value)}
                    autoComplete="off"
                />
            </Field>
            <Field id={id('phone')} label="Nomor HP (WhatsApp)" galat={f.galat.phone}>
                <Input
                    {...atributField(id('phone'), f.galat.phone)}
                    value={f.isian.phone}
                    onChange={(e) => f.ubah('phone', e.target.value)}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="0812-3456-7890"
                />
            </Field>
            <Field
                id={id('address')}
                label="Alamat"
                galat={f.galat.address}
                samping={<span className="text-sm text-redup">Opsional</span>}
            >
                <Textarea
                    {...atributField(id('address'), f.galat.address)}
                    value={f.isian.address}
                    onChange={(e) => f.ubah('address', e.target.value)}
                    rows={2}
                />
            </Field>
            <Field
                id={id('notes')}
                label="Catatan"
                galat={f.galat.notes}
                samping={<span className="text-sm text-redup">Opsional</span>}
                petunjuk="Catatan internal, tidak pernah tampil ke pelanggan."
            >
                <Textarea
                    {...atributField(id('notes'), f.galat.notes, true)}
                    value={f.isian.notes}
                    onChange={(e) => f.ubah('notes', e.target.value)}
                    rows={2}
                />
            </Field>
        </DialogForm>
    )
}
