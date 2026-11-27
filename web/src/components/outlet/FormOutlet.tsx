// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import JudulHalaman from '@/components/ui/JudulHalaman'
import Kartu from '@/components/ui/Kartu'
import KotakPesan from '@/components/ui/KotakPesan'
import Textarea from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import { klienStaf } from '@/klien/peramban'
import { pangkas } from '@/skema/form/aturan'
import type { Outlet, UbahOutletRequest } from '@/skema/outlet'
import { formatNomorHp } from '@/utils/format'
import { pesanKodeField, type AturanField } from '@/utils/galat'
import { periksaNomorHp, periksaTeks, saringGalat } from '@/utils/validasi'

const ATURAN = {
    name: { label: 'Nama bengkel', min: 2, maks: 100 },
    tagline: { label: 'Tagline', maks: 200 },
    address: { label: 'Alamat', maks: 500 },
    phone: {
        label: 'Nomor WhatsApp',
        petunjukFormat: 'Gunakan nomor Indonesia, mis. 0812-3456-7890.',
    },
    openingHours: { label: 'Jam buka', maks: 200 },
    mapsUrl: {
        label: 'Tautan peta',
        maks: 500,
        petunjukFormat: 'Diawali https:// atau http://, tanpa spasi.',
    },
    receiptFooter: { label: 'Kaki nota', maks: 500 },
} satisfies Record<keyof UbahOutletRequest, AturanField>

type Isian = Record<keyof UbahOutletRequest, string>

const id = (nama: string) => `outlet-${nama}`
const URUTAN = Object.keys(ATURAN)

// Profil bengkel (khusus pemilik). Semua isian tampil di website, layar masuk, nota, halaman lacak,
// dan pesan WhatsApp; PUT mengganti seluruh profil sekaligus.
export default function FormOutlet({ awal }: { awal: Outlet }) {
    const { tampilkanToast } = useToast()
    const f = useIsian<Isian>({
        ...awal,
        phone: awal.phone ? formatNomorHp(awal.phone) : '',
    })
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)
    const a = ATURAN

    const simpan = () =>
        kirim({
            periksa: () => {
                const peta = pangkas(f.isian.mapsUrl)
                const fields = saringGalat({
                    name: periksaTeks(f.isian.name, a.name),
                    tagline: periksaTeks(f.isian.tagline, { ...a.tagline, opsional: true }),
                    address: periksaTeks(f.isian.address, { ...a.address, opsional: true }),
                    phone:
                        pangkas(f.isian.phone) === ''
                            ? null
                            : periksaNomorHp(f.isian.phone, a.phone),
                    openingHours: periksaTeks(f.isian.openingHours, {
                        ...a.openingHours,
                        opsional: true,
                    }),
                    mapsUrl:
                        periksaTeks(f.isian.mapsUrl, { ...a.mapsUrl, opsional: true }) ??
                        (peta === '' || /^https?:\/\/[^\s]+$/.test(peta)
                            ? null
                            : pesanKodeField('invalid_format', a.mapsUrl)),
                    receiptFooter: periksaTeks(f.isian.receiptFooter, {
                        ...a.receiptFooter,
                        opsional: true,
                    }),
                })
                if (Object.keys(fields).length > 0) return { ok: false as const, fields }
                const badan: UbahOutletRequest = {
                    name: pangkas(f.isian.name),
                    tagline: pangkas(f.isian.tagline),
                    address: pangkas(f.isian.address),
                    // Kosong = outlet belum punya nomor WhatsApp (null di API).
                    phone: pangkas(f.isian.phone) === '' ? null : f.isian.phone,
                    openingHours: pangkas(f.isian.openingHours),
                    mapsUrl: peta,
                    receiptFooter: pangkas(f.isian.receiptFooter),
                }
                return { ok: true as const, badan }
            },
            kirim: (badan) => klienStaf().ubahOutlet(badan),
            aturan: a,
            urutan: URUTAN,
            idKolom: id,
            berhasil: () => tampilkanToast('Profil bengkel disimpan.'),
        })

    const kolom = (
        nama: keyof Isian,
        label: string,
        opsi: { panjang?: boolean; petunjuk?: string; opsional?: boolean; tipe?: string } = {},
    ) => (
        <Field
            id={id(nama)}
            label={label}
            galat={f.galat[nama]}
            petunjuk={opsi.petunjuk}
            samping={
                opsi.opsional ? <span className="text-sm text-redup">Opsional</span> : undefined
            }
        >
            {opsi.panjang ? (
                <Textarea
                    {...atributField(id(nama), f.galat[nama], Boolean(opsi.petunjuk))}
                    value={f.isian[nama]}
                    onChange={(e) => f.ubah(nama, e.target.value)}
                    rows={3}
                />
            ) : (
                <Input
                    {...atributField(id(nama), f.galat[nama], Boolean(opsi.petunjuk))}
                    value={f.isian[nama]}
                    onChange={(e) => f.ubah(nama, e.target.value)}
                    type={opsi.tipe ?? 'text'}
                />
            )}
        </Field>
    )

    return (
        <>
            <JudulHalaman
                judul="Outlet"
                petunjuk="Profil bengkel yang tampil di website, nota, halaman lacak servis, dan pesan WhatsApp."
            />
            <form
                noValidate
                onSubmit={(e) => {
                    e.preventDefault()
                    void simpan()
                }}
                className="max-w-3xl space-y-5"
            >
                {f.pesan && <KotakPesan jenis="galat">{f.pesan}</KotakPesan>}
                <fieldset disabled={sibuk} className="min-w-0 space-y-5">
                    <Kartu judul="Identitas">
                        <div className="space-y-5">
                            {kolom('name', 'Nama bengkel')}
                            {kolom('tagline', 'Tagline', {
                                opsional: true,
                                petunjuk: 'Kalimat pendek di bawah nama di halaman depan.',
                            })}
                        </div>
                    </Kartu>
                    <Kartu judul="Kontak dan lokasi">
                        <div className="space-y-5">
                            {kolom('phone', 'Nomor WhatsApp', {
                                opsional: true,
                                tipe: 'tel',
                                petunjuk:
                                    'Untuk tombol WhatsApp di website. Kosongkan bila belum ada.',
                            })}
                            {kolom('address', 'Alamat', { panjang: true, opsional: true })}
                            {kolom('openingHours', 'Jam buka', {
                                panjang: true,
                                opsional: true,
                                petunjuk: 'Mis. Senin–Sabtu 08.00–17.00.',
                            })}
                            {kolom('mapsUrl', 'Tautan peta', {
                                opsional: true,
                                tipe: 'url',
                                petunjuk: 'Mis. tautan bagikan dari Google Maps.',
                            })}
                        </div>
                    </Kartu>
                    <Kartu judul="Nota">
                        {kolom('receiptFooter', 'Kaki nota', {
                            panjang: true,
                            opsional: true,
                            petunjuk:
                                'Dicetak di nota dan dikirim di WhatsApp nota, mis. "Garansi servis 7 hari".',
                        })}
                    </Kartu>
                </fieldset>
                <Tombol type="submit" sibuk={sibuk}>
                    Simpan profil
                </Tombol>
            </form>
        </>
    )
}
