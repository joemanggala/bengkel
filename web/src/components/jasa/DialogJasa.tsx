// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import DialogForm, { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import InputRupiah from '@/components/ui/InputRupiah'
import Textarea from '@/components/ui/Textarea'
import { klienStaf } from '@/klien/peramban'
import { pangkas } from '@/skema/form/aturan'
import type { BuatJasaRequest, Jasa } from '@/skema/jasa'
import { formatRupiah, rapikanIsianRupiah } from '@/utils/format'
import { PESAN_BAKU, type AturanField } from '@/utils/galat'
import { periksaBilangan, periksaTeks, saringGalat } from '@/utils/validasi'

const id = (nama: string) => `jasa-${nama}`
const URUTAN = ['name', 'price', 'durationMinutes', 'sortOrder', 'description']

const ATURAN = {
    name: { label: 'Nama jasa', min: 2, maks: 100 },
    description: { label: 'Deskripsi', maks: 1000 },
    price: {
        label: 'Harga',
        min: 0,
        maks: 100_000_000,
        jenis: 'angka rupiah',
        formatNilai: formatRupiah,
    },
    durationMinutes: { label: 'Durasi', min: 1, maks: 1440, jenis: 'angka menit' },
    sortOrder: { label: 'Urutan tampil', min: 0, maks: 100_000, jenis: 'angka bulat' },
    isPublic: { label: 'Tampil di website', pilihan: true },
    isActive: { label: 'Aktif', pilihan: true },
} satisfies Record<string, AturanField>

type Isian = {
    name: string
    description: string
    price: string
    durationMinutes: string
    sortOrder: string
    isPublic: boolean
    isActive: boolean
}

type Props = { jasa?: Jasa; onSelesai: (j: Jasa) => void; onTutup: () => void }

// Tambah atau ubah jasa (khusus pemilik). Mengubah nama atau harga tidak mengubah SPK dan booking
// yang sudah ada, karena keduanya menyimpan salinan.
export default function DialogJasa({ jasa, onSelesai, onTutup }: Props) {
    const f = useIsian<Isian>({
        name: jasa?.name ?? '',
        description: jasa?.description ?? '',
        price: jasa ? rapikanIsianRupiah(String(jasa.price)) : '',
        durationMinutes: jasa?.durationMinutes ? String(jasa.durationMinutes) : '',
        sortOrder: String(jasa?.sortOrder ?? 0),
        isPublic: jasa?.isPublic ?? true,
        isActive: jasa?.isActive ?? true,
    })
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)

    const periksa = () => {
        const harga = periksaBilangan(f.isian.price, ATURAN.price)
        const durasi = periksaBilangan(f.isian.durationMinutes, {
            ...ATURAN.durationMinutes,
            opsional: true,
        })
        const urut = periksaBilangan(f.isian.sortOrder, { ...ATURAN.sortOrder, opsional: true })
        const fields = saringGalat({
            name: periksaTeks(f.isian.name, ATURAN.name),
            description: periksaTeks(f.isian.description, {
                ...ATURAN.description,
                opsional: true,
            }),
            price: harga.ok ? null : harga.pesan,
            durationMinutes: durasi.ok ? null : durasi.pesan,
            sortOrder: urut.ok ? null : urut.pesan,
        })
        if (
            !harga.ok ||
            !durasi.ok ||
            !urut.ok ||
            harga.nilai === null ||
            Object.keys(fields).length > 0
        ) {
            return { ok: false as const, fields }
        }
        const badan: Required<BuatJasaRequest> = {
            name: pangkas(f.isian.name),
            description: pangkas(f.isian.description),
            price: harga.nilai,
            durationMinutes: durasi.nilai,
            sortOrder: urut.nilai ?? 0,
            isPublic: f.isian.isPublic,
            isActive: f.isian.isActive,
        }
        return { ok: true as const, badan }
    }

    const simpan = () =>
        kirim({
            periksa,
            kirim: (badan) =>
                jasa ? klienStaf().ubahJasa(jasa.serviceId, badan) : klienStaf().buatJasa(badan),
            aturan: ATURAN,
            khusus: {
                service_name_taken: { field: 'name', pesan: `${PESAN_BAKU.service_name_taken}.` },
            },
            urutan: URUTAN,
            idKolom: id,
            berhasil: onSelesai,
        })

    return (
        <DialogForm
            judul={jasa ? `Ubah ${jasa.name}` : 'Tambah jasa'}
            labelKirim={jasa ? 'Simpan perubahan' : 'Tambah jasa'}
            sibuk={sibuk}
            pesan={f.pesan}
            onKirim={() => void simpan()}
            onTutup={onTutup}
        >
            <Field id={id('name')} label="Nama jasa" galat={f.galat.name}>
                <Input
                    {...atributField(id('name'), f.galat.name)}
                    value={f.isian.name}
                    onChange={(e) => f.ubah('name', e.target.value)}
                />
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
                <Field id={id('price')} label="Harga" galat={f.galat.price}>
                    <InputRupiah
                        {...atributField(id('price'), f.galat.price)}
                        value={f.isian.price}
                        onChange={(v) => f.ubah('price', v)}
                    />
                </Field>
                <Field
                    id={id('durationMinutes')}
                    label="Durasi (menit)"
                    galat={f.galat.durationMinutes}
                    samping={<span className="text-sm text-redup">Opsional</span>}
                >
                    <Input
                        {...atributField(id('durationMinutes'), f.galat.durationMinutes)}
                        value={f.isian.durationMinutes}
                        onChange={(e) => f.ubah('durationMinutes', e.target.value)}
                        inputMode="numeric"
                    />
                </Field>
                <Field id={id('sortOrder')} label="Urutan tampil" galat={f.galat.sortOrder}>
                    <Input
                        {...atributField(id('sortOrder'), f.galat.sortOrder)}
                        value={f.isian.sortOrder}
                        onChange={(e) => f.ubah('sortOrder', e.target.value)}
                        inputMode="numeric"
                    />
                </Field>
            </div>
            <Field
                id={id('description')}
                label="Deskripsi"
                galat={f.galat.description}
                samping={<span className="text-sm text-redup">Opsional</span>}
                petunjuk="Tampil di halaman depan website."
            >
                <Textarea
                    {...atributField(id('description'), f.galat.description, true)}
                    value={f.isian.description}
                    onChange={(e) => f.ubah('description', e.target.value)}
                    rows={2}
                />
            </Field>
            <div className="space-y-3">
                {(
                    [
                        ['isPublic', 'Tampil di website dan bisa dipilih saat booking'],
                        ['isActive', 'Aktif (bisa dipakai di SPK baru)'],
                    ] as const
                ).map(([kunci, label]) => (
                    <label key={kunci} className="flex min-h-11 cursor-pointer items-center gap-3">
                        <input
                            type="checkbox"
                            checked={f.isian[kunci]}
                            onChange={(e) => f.ubah(kunci, e.target.checked)}
                            className="h-5 w-5 accent-utama"
                        />
                        <span>{label}</span>
                    </label>
                ))}
            </div>
        </DialogForm>
    )
}
