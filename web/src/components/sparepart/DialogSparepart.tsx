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
import { formatRupiah, rapikanIsianRupiah } from '@/utils/format'
import { PESAN_BAKU, pesanKodeField, type AturanField } from '@/utils/galat'
import { periksaBilangan, periksaTeks, saringGalat } from '@/utils/validasi'

const id = (nama: string) => `part-${nama}`
const URUTAN = ['sku', 'name', 'unit', 'price', 'costPrice', 'minStock', 'initialStock']

const RUPIAH = { min: 0, maks: 100_000_000, jenis: 'angka rupiah', formatNilai: formatRupiah }
const JUMLAH = { min: 0, maks: MAKS_JUMLAH_STOK, jenis: 'angka bulat' }

export const ATURAN_SPAREPART = {
    sku: {
        label: 'SKU',
        maks: 40,
        petunjukFormat:
            'Huruf, angka, titik, garis bawah, garis miring, atau tanda hubung, tanpa spasi.',
    },
    name: { label: 'Nama sparepart', min: 2, maks: 100 },
    unit: { label: 'Satuan', maks: 20 },
    price: { label: 'Harga jual', ...RUPIAH },
    costPrice: { label: 'Harga beli', ...RUPIAH },
    minStock: { label: 'Stok minimum', ...JUMLAH },
    initialStock: { label: 'Stok awal', ...JUMLAH },
} satisfies Record<string, AturanField>

type Isian = {
    sku: string
    name: string
    unit: string
    price: string
    costPrice: string
    minStock: string
    initialStock: string
    isActive: boolean
}

type Props = {
    part?: SparepartPemilik
    onSelesai: (p: SparepartPemilik) => void
    onTutup: () => void
}

// Tambah atau ubah sparepart (khusus pemilik). Stok tidak bisa diubah di sini (spec): stok awal
// hanya saat menambah, sesudahnya lewat stok masuk, keluar, dan hitung ulang supaya setiap
// perubahan tercatat di kartu stok.
export default function DialogSparepart({ part, onSelesai, onTutup }: Props) {
    const f = useIsian<Isian>({
        sku: part?.sku ?? '',
        name: part?.name ?? '',
        unit: part?.unit ?? 'pcs',
        price: part ? rapikanIsianRupiah(String(part.price)) : '',
        costPrice: part ? rapikanIsianRupiah(String(part.costPrice)) : '',
        minStock: String(part?.minStock ?? 0),
        initialStock: '0',
        isActive: part?.isActive ?? true,
    })
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)
    const a = ATURAN_SPAREPART

    const periksa = () => {
        const sku = pangkas(f.isian.sku).toUpperCase()
        const harga = periksaBilangan(f.isian.price, a.price)
        const beli = periksaBilangan(f.isian.costPrice, { ...a.costPrice, opsional: true })
        const minimum = periksaBilangan(f.isian.minStock, { ...a.minStock, opsional: true })
        const awal = periksaBilangan(f.isian.initialStock, { ...a.initialStock, opsional: true })
        const galatSku =
            periksaTeks(f.isian.sku, a.sku) ??
            (/^[A-Z0-9][A-Z0-9._/-]*$/.test(sku) ? null : pesanKodeField('invalid_format', a.sku))
        const fields = saringGalat({
            sku: galatSku,
            name: periksaTeks(f.isian.name, a.name),
            unit: periksaTeks(f.isian.unit, { ...a.unit, min: 1 }),
            price: harga.ok ? null : harga.pesan,
            costPrice: beli.ok ? null : beli.pesan,
            minStock: minimum.ok ? null : minimum.pesan,
            initialStock: part || awal.ok ? null : awal.pesan,
        })
        if (
            !harga.ok ||
            !beli.ok ||
            !minimum.ok ||
            !awal.ok ||
            harga.nilai === null ||
            Object.keys(fields).length > 0
        ) {
            return { ok: false as const, fields }
        }
        return {
            ok: true as const,
            badan: {
                sku,
                name: pangkas(f.isian.name),
                unit: pangkas(f.isian.unit),
                price: harga.nilai,
                costPrice: beli.nilai ?? 0,
                minStock: minimum.nilai ?? 0,
                initialStock: awal.nilai ?? 0,
                isActive: f.isian.isActive,
            },
        }
    }

    const simpan = () =>
        kirim({
            periksa,
            kirim: ({ initialStock, isActive, ...badan }) =>
                part
                    ? klienStaf().ubahSparepart(part.partId, { ...badan, isActive })
                    : klienStaf().buatSparepart({ ...badan, initialStock }),
            aturan: a,
            khusus: { sku_taken: { field: 'sku', pesan: `${PESAN_BAKU.sku_taken}.` } },
            urutan: URUTAN,
            idKolom: id,
            berhasil: onSelesai,
        })

    return (
        <DialogForm
            judul={part ? `Ubah ${part.name}` : 'Tambah sparepart'}
            labelKirim={part ? 'Simpan perubahan' : 'Tambah sparepart'}
            sibuk={sibuk}
            pesan={f.pesan}
            onKirim={() => void simpan()}
            onTutup={onTutup}
        >
            <div className="grid gap-5 sm:grid-cols-2">
                <Field id={id('sku')} label="SKU" galat={f.galat.sku} petunjuk="Kode barang, unik.">
                    <Input
                        {...atributField(id('sku'), f.galat.sku, true)}
                        value={f.isian.sku}
                        onChange={(e) => f.ubah('sku', e.target.value)}
                        autoCapitalize="characters"
                        spellCheck={false}
                    />
                </Field>
                <Field
                    id={id('unit')}
                    label="Satuan"
                    galat={f.galat.unit}
                    petunjuk="Satuan jual, mis. botol, set, pcs."
                >
                    <Input
                        {...atributField(id('unit'), f.galat.unit, true)}
                        value={f.isian.unit}
                        onChange={(e) => f.ubah('unit', e.target.value)}
                    />
                </Field>
            </div>
            <Field id={id('name')} label="Nama sparepart" galat={f.galat.name}>
                <Input
                    {...atributField(id('name'), f.galat.name)}
                    value={f.isian.name}
                    onChange={(e) => f.ubah('name', e.target.value)}
                />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
                <Field id={id('price')} label="Harga jual" galat={f.galat.price}>
                    <InputRupiah
                        {...atributField(id('price'), f.galat.price)}
                        value={f.isian.price}
                        onChange={(v) => f.ubah('price', v)}
                    />
                </Field>
                <Field
                    id={id('costPrice')}
                    label="Harga beli"
                    galat={f.galat.costPrice}
                    petunjuk="Rahasia pemilik; kasir dan mekanik tidak melihatnya. Dipakai menghitung laba kotor."
                >
                    <InputRupiah
                        {...atributField(id('costPrice'), f.galat.costPrice, true)}
                        value={f.isian.costPrice}
                        onChange={(v) => f.ubah('costPrice', v)}
                    />
                </Field>
                <Field
                    id={id('minStock')}
                    label="Stok minimum"
                    galat={f.galat.minStock}
                    petunjuk="Di bawah atau sama dengan ini ditandai menipis."
                >
                    <Input
                        {...atributField(id('minStock'), f.galat.minStock, true)}
                        value={f.isian.minStock}
                        onChange={(e) => f.ubah('minStock', e.target.value)}
                        inputMode="numeric"
                    />
                </Field>
                {!part && (
                    <Field
                        id={id('initialStock')}
                        label="Stok awal"
                        galat={f.galat.initialStock}
                        petunjuk="Dicatat di kartu stok sebagai Stok awal."
                    >
                        <Input
                            {...atributField(id('initialStock'), f.galat.initialStock, true)}
                            value={f.isian.initialStock}
                            onChange={(e) => f.ubah('initialStock', e.target.value)}
                            inputMode="numeric"
                        />
                    </Field>
                )}
            </div>
            {part && (
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                    <input
                        type="checkbox"
                        checked={f.isian.isActive}
                        onChange={(e) => f.ubah('isActive', e.target.checked)}
                        className="h-5 w-5 accent-utama"
                    />
                    <span>Aktif (bisa ditambahkan ke SPK)</span>
                </label>
            )}
        </DialogForm>
    )
}
