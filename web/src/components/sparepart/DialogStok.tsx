// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import DialogForm, { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import InputRupiah from '@/components/ui/InputRupiah'
import { klienStaf } from '@/klien/peramban'
import { pangkas } from '@/skema/form/aturan'
import { MAKS_JUMLAH_STOK, type SparepartPemilik } from '@/skema/sparepart'
import { formatAngka, formatRupiah } from '@/utils/format'
import type { AturanField } from '@/utils/galat'
import { periksaBilangan, periksaTeks, saringGalat } from '@/utils/validasi'

export type JenisStok = 'masuk' | 'keluar' | 'hitung'

const JUDUL: Record<JenisStok, string> = {
    masuk: 'Stok masuk',
    keluar: 'Stok keluar',
    hitung: 'Hitung ulang stok',
}

const ATURAN = {
    quantity: { label: 'Jumlah', min: 1, maks: MAKS_JUMLAH_STOK, jenis: 'angka bulat' },
    countedStock: {
        label: 'Stok hasil hitung',
        min: 0,
        maks: MAKS_JUMLAH_STOK,
        jenis: 'angka bulat',
    },
    costPrice: {
        label: 'Harga beli',
        min: 0,
        maks: 100_000_000,
        jenis: 'angka rupiah',
        formatNilai: formatRupiah,
    },
    note: { label: 'Catatan', maks: 200 },
} satisfies Record<string, AturanField>

const id = (nama: string) => `stok-${nama}`

type Props = {
    jenis: JenisStok
    part: SparepartPemilik
    onSelesai: (p: SparepartPemilik) => void
    onTutup: () => void
}

// Stok masuk (belanja; harga beli opsional menjadi harga beli terbaru), stok keluar manual
// (rusak, hilang; wajib catatan, tidak boleh melebihi stok), dan hitung ulang (opname; wajib
// catatan). Part yang dipasang ke kendaraan tidak lewat sini, tetapi lewat item SPK.
export default function DialogStok({ jenis, part, onSelesai, onTutup }: Props) {
    const f = useIsian({ jumlah: '', costPrice: '', note: '' })
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)
    const kolomJumlah = jenis === 'hitung' ? 'countedStock' : 'quantity'

    const simpan = () =>
        kirim({
            periksa: () => {
                const jumlah = periksaBilangan(f.isian.jumlah, ATURAN[kolomJumlah])
                const beli = periksaBilangan(f.isian.costPrice, {
                    ...ATURAN.costPrice,
                    opsional: true,
                })
                const fields = saringGalat({
                    [kolomJumlah]: jumlah.ok ? null : jumlah.pesan,
                    costPrice: jenis === 'masuk' && !beli.ok ? beli.pesan : null,
                    note: periksaTeks(f.isian.note, {
                        ...ATURAN.note,
                        opsional: jenis === 'masuk',
                    }),
                })
                if (!jumlah.ok || jumlah.nilai === null || Object.keys(fields).length > 0)
                    return { ok: false as const, fields }
                return {
                    ok: true as const,
                    badan: {
                        jumlah: jumlah.nilai,
                        costPrice: beli.ok ? beli.nilai : null,
                        note: pangkas(f.isian.note),
                    },
                }
            },
            kirim: ({ jumlah, costPrice, note }) => {
                const k = klienStaf()
                if (jenis === 'masuk') {
                    return k.stokMasuk(part.partId, {
                        quantity: jumlah,
                        note,
                        ...(costPrice === null ? {} : { costPrice }),
                    })
                }
                if (jenis === 'keluar') return k.stokKeluar(part.partId, { quantity: jumlah, note })
                return k.hitungStok(part.partId, { countedStock: jumlah, note })
            },
            aturan: ATURAN,
            urutan: [kolomJumlah, 'costPrice', 'note'],
            idKolom: (nama) => id(nama === kolomJumlah ? 'jumlah' : nama),
            berhasil: onSelesai,
        })

    return (
        <DialogForm
            judul={`${JUDUL[jenis]}: ${part.name}`}
            deskripsi={`Stok sekarang ${formatAngka(part.stock)} ${part.unit}.`}
            labelKirim={JUDUL[jenis]}
            sibuk={sibuk}
            pesan={f.pesan}
            onKirim={() => void simpan()}
            onTutup={onTutup}
        >
            <Field
                id={id('jumlah')}
                label={
                    jenis === 'hitung'
                        ? `Stok hasil hitung (${part.unit})`
                        : `Jumlah (${part.unit})`
                }
                galat={f.galat[kolomJumlah]}
            >
                <Input
                    {...atributField(id('jumlah'), f.galat[kolomJumlah])}
                    value={f.isian.jumlah}
                    onChange={(e) => f.ubah('jumlah', e.target.value)}
                    inputMode="numeric"
                    className="angka max-w-40"
                />
            </Field>
            {jenis === 'masuk' && (
                <Field
                    id={id('costPrice')}
                    label="Harga beli per satuan"
                    galat={f.galat.costPrice}
                    samping={<span className="text-sm text-redup">Opsional</span>}
                    petunjuk={`Kosongkan bila sama. Sekarang ${formatRupiah(part.costPrice)}.`}
                >
                    <InputRupiah
                        {...atributField(id('costPrice'), f.galat.costPrice, true)}
                        value={f.isian.costPrice}
                        onChange={(v) => f.ubah('costPrice', v)}
                    />
                </Field>
            )}
            <Field
                id={id('note')}
                label="Catatan"
                galat={f.galat.note}
                samping={
                    jenis === 'masuk' ? (
                        <span className="text-sm text-redup">Opsional</span>
                    ) : undefined
                }
            >
                <Input
                    {...atributField(id('note'), f.galat.note)}
                    value={f.isian.note}
                    onChange={(e) => f.ubah('note', e.target.value)}
                    placeholder={
                        jenis === 'keluar'
                            ? 'Mis. rusak saat dipasang'
                            : jenis === 'hitung'
                              ? 'Mis. opname akhir bulan'
                              : 'Mis. belanja di toko A'
                    }
                />
            </Field>
        </DialogForm>
    )
}
