// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useState } from 'react'
import DialogForm, { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import InputRupiah from '@/components/ui/InputRupiah'
import KotakCari from '@/components/ui/KotakCari'
import { LencanaLevelStok } from '@/components/ui/Lencana'
import Pilihan from '@/components/ui/Pilihan'
import Tab from '@/components/ui/Tab'
import { useDaftar } from '@/components/ui/useDaftar'
import { klienStaf } from '@/klien/peramban'
import type { Jasa } from '@/skema/jasa'
import type { Sparepart } from '@/skema/sparepart'
import type { SpkDetail, TambahItemRequest } from '@/skema/spk'
import { formatAngka, formatRupiah, rapikanIsianRupiah } from '@/utils/format'
import { pesanKodeField } from '@/utils/galat'
import { periksaBilangan, saringGalat } from '@/utils/validasi'
import { ATURAN_ITEM } from './logika'

const id = (nama: string) => `item-${nama}`
const URUTAN = ['serviceId', 'partId', 'quantity', 'price']

type Isian = { type: 'SERVICE' | 'PART'; serviceId: string; quantity: string; price: string }

type Props = { spk: SpkDetail; onSpk: (spk: SpkDetail) => void; onTutup: () => void }

// Tambah satu item jasa atau sparepart ke SPK. Harga jasa boleh diganti untuk item ini (mis.
// pekerjaan tambahan); harga sparepart selalu harga jual katalog. Stok sparepart terlihat sebelum
// dipilih, dan stok yang kurang ditolak backend dengan pesan yang menyebut sparepart-nya.
export default function DialogItem({ spk, onSpk, onTutup }: Props) {
    const f = useIsian<Isian>({ type: 'SERVICE', serviceId: '', quantity: '1', price: '' })
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)
    const [jasa, setJasa] = useState<Jasa[]>([])
    const [cariPart, setCariPart] = useState('')
    const [part, setPart] = useState<Sparepart | null>(null)

    useEffect(() => {
        void klienStaf()
            .daftarJasa({ isActive: 'true' })
            .then((h) => h.ok && setJasa(h.data))
    }, [])

    const daftarPart = useDaftar(
        () =>
            klienStaf().daftarSparepart({
                search: cariPart || undefined,
                isActive: 'true',
                limit: 8,
            }),
        cariPart,
    )

    const pilihJasa = (serviceId: string) => {
        f.ubah('serviceId', serviceId)
        const j = jasa.find((x) => x.serviceId === serviceId)
        f.ubah('price', j ? rapikanIsianRupiah(String(j.price)) : '')
    }

    const periksa = ():
        { ok: true; badan: TambahItemRequest } | { ok: false; fields: Record<string, string> } => {
        const a = ATURAN_ITEM
        const jumlah = periksaBilangan(f.isian.quantity, { ...a.quantity, min: 1, maks: 99 })
        const harga =
            f.isian.type === 'SERVICE'
                ? periksaBilangan(f.isian.price, { ...a.price, min: 0, maks: 100_000_000 })
                : { ok: true as const, nilai: null }
        const fields = saringGalat({
            serviceId:
                f.isian.type === 'SERVICE' && !f.isian.serviceId
                    ? pesanKodeField('required', a.serviceId)
                    : null,
            partId: f.isian.type === 'PART' && !part ? pesanKodeField('required', a.partId) : null,
            quantity: jumlah.ok ? null : jumlah.pesan,
            price: harga.ok ? null : harga.pesan,
        })
        if (Object.keys(fields).length > 0 || !jumlah.ok || !harga.ok) return { ok: false, fields }
        const quantity = jumlah.nilai ?? 1
        if (f.isian.type === 'PART' && part)
            return { ok: true, badan: { type: 'PART', partId: part.partId, quantity } }
        return {
            ok: true,
            badan: {
                type: 'SERVICE',
                serviceId: f.isian.serviceId,
                quantity,
                ...(harga.nilai === null ? {} : { price: harga.nilai }),
            },
        }
    }

    const simpan = () =>
        kirim({
            periksa,
            kirim: (badan) => klienStaf().tambahItemSpk(spk.number, badan),
            aturan: ATURAN_ITEM,
            urutan: URUTAN,
            idKolom: id,
            berhasil: (baru) => {
                onSpk(baru)
                onTutup()
            },
        })

    return (
        <DialogForm
            judul={`Tambah item ke ${spk.number}`}
            deskripsi="Sparepart langsung mengurangi stok; stok kembali bila item dihapus atau SPK dibatalkan."
            labelKirim="Tambah item"
            sibuk={sibuk}
            pesan={f.pesan}
            onKirim={() => void simpan()}
            onTutup={onTutup}
        >
            <Tab
                label="Jenis item"
                opsi={[
                    { nilai: 'SERVICE', label: 'Jasa' },
                    { nilai: 'PART', label: 'Sparepart' },
                ]}
                nilai={f.isian.type}
                onUbah={(t) => {
                    f.ubah('type', t)
                    f.setGalat({})
                    f.setPesan(null)
                }}
            />
            {f.isian.type === 'SERVICE' ? (
                <>
                    <Field id={id('serviceId')} label="Jasa" galat={f.galat.serviceId}>
                        <Pilihan
                            {...atributField(id('serviceId'), f.galat.serviceId)}
                            opsi={jasa.map((j) => ({
                                nilai: j.serviceId,
                                label: `${j.name} · ${formatRupiah(j.price)}`,
                            }))}
                            kosong="Pilih jasa"
                            value={f.isian.serviceId}
                            onChange={(e) => pilihJasa(e.target.value)}
                        />
                    </Field>
                    <Field
                        id={id('price')}
                        label="Harga per satuan"
                        galat={f.galat.price}
                        petunjuk="Bawaannya harga katalog; boleh diganti untuk item ini saja."
                    >
                        <InputRupiah
                            {...atributField(id('price'), f.galat.price, true)}
                            value={f.isian.price}
                            onChange={(v) => f.ubah('price', v)}
                        />
                    </Field>
                </>
            ) : (
                <div className="space-y-3" id={id('partId')} tabIndex={-1}>
                    <KotakCari
                        nilai={cariPart}
                        onCari={setCariPart}
                        label="Cari sparepart"
                        placeholder="Nama atau SKU"
                    />
                    <ul className="max-h-64 divide-y divide-garis overflow-y-auto rounded-xl border border-garis">
                        {(daftarPart.data ?? []).map((p) => {
                            const terpilih = part?.partId === p.partId
                            return (
                                <li key={p.partId}>
                                    <button
                                        type="button"
                                        aria-pressed={terpilih}
                                        onClick={() => setPart(p)}
                                        disabled={p.stock === 0}
                                        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                            terpilih ? 'bg-utama-pucat' : 'hover:bg-latar'
                                        }`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block font-semibold">{p.name}</span>
                                            <span className="angka block text-sm text-redup">
                                                {p.sku} · {formatRupiah(p.price)} · stok{' '}
                                                {formatAngka(p.stock)} {p.unit}
                                            </span>
                                        </span>
                                        <LencanaLevelStok level={p.stockLevel} />
                                    </button>
                                </li>
                            )
                        })}
                        {daftarPart.data?.length === 0 && (
                            <li className="px-3 py-4 text-center text-redup">
                                Sparepart tidak ditemukan.
                            </li>
                        )}
                    </ul>
                    {f.galat.partId && (
                        <p className="text-sm font-semibold text-bahaya-tua">{f.galat.partId}</p>
                    )}
                    {part && (
                        <p className="text-[15px]">
                            Dipilih: <strong>{part.name}</strong> ({formatRupiah(part.price)} per{' '}
                            {part.unit})
                        </p>
                    )}
                </div>
            )}
            <Field id={id('quantity')} label="Jumlah" galat={f.galat.quantity ?? f.galat.items}>
                <Input
                    {...atributField(id('quantity'), f.galat.quantity ?? f.galat.items)}
                    value={f.isian.quantity}
                    onChange={(e) => f.ubah('quantity', e.target.value)}
                    inputMode="numeric"
                    className="angka max-w-32"
                />
            </Field>
        </DialogForm>
    )
}
