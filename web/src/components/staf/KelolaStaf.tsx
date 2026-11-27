// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import GalatDaftar from '@/components/panel/GalatDaftar'
import DialogForm, { useIsian, useKirimForm } from '@/components/ui/DialogForm'
import Field, { atributField } from '@/components/ui/Field'
import Ikon from '@/components/ui/Ikon'
import Input from '@/components/ui/Input'
import InputSandi from '@/components/ui/InputSandi'
import JudulHalaman from '@/components/ui/JudulHalaman'
import KotakPesan from '@/components/ui/KotakPesan'
import { Lencana } from '@/components/ui/Lencana'
import Pilihan from '@/components/ui/Pilihan'
import { SkeletonTabel } from '@/components/ui/Skeleton'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import TombolIkon from '@/components/ui/TombolIkon'
import { useDaftar } from '@/components/ui/useDaftar'
import { klienStaf } from '@/klien/peramban'
import { pangkas } from '@/skema/form/aturan'
import { ATURAN_SETUP, POLA_EMAIL } from '@/skema/form/auth'
import {
    LABEL_PERAN,
    PERAN_STAF,
    type PeranStaf,
    type Staf,
    type UbahStafRequest,
} from '@/skema/staf'
import { formatWaktu } from '@/utils/format'
import { PESAN_BAKU, type AturanField } from '@/utils/galat'
import { periksaTeks, saringGalat } from '@/utils/validasi'

const ATURAN = {
    name: ATURAN_SETUP.name,
    email: ATURAN_SETUP.email,
    password: ATURAN_SETUP.password,
    role: { label: 'Peran', pilihan: true },
    isActive: { label: 'Status', pilihan: true },
} satisfies Record<string, AturanField>

const PENJELASAN_PERAN: Record<PeranStaf, string> = {
    owner: 'Pemilik bisa semuanya, termasuk jasa, sparepart dan harga beli, staf, outlet, dan rekap.',
    cashier:
        'Kasir menerima booking, membuat SPK, mengurus pelanggan, item, pembayaran, dan WhatsApp. Tidak melihat harga beli dan rekap.',
    mechanic:
        'Mekanik hanya melihat SPK yang ditugaskan kepadanya, mengubah statusnya, dan mengisi diagnosis.',
}

const id = (nama: string) => `staf-${nama}`

// Akun staf (khusus pemilik). Staf yang berhenti dinonaktifkan, tidak dihapus, supaya namanya tetap
// tercatat di SPK lama. Harus selalu ada satu pemilik aktif (last_owner).
export default function KelolaStaf({ staffIdSaya }: { staffIdSaya: string }) {
    const { tampilkanToast } = useToast()
    const [dialog, setDialog] = useState<Staf | 'tambah' | null>(null)
    const daftar = useDaftar(() => klienStaf().daftarStaf(), 'staf')

    const kolom: KolomTabel<Staf>[] = [
        {
            kunci: 'nama',
            judul: 'Nama',
            isi: (s) => (
                <span>
                    <span className="block font-semibold">
                        {s.name}
                        {s.staffId === staffIdSaya && (
                            <span className="font-normal text-redup"> (kamu)</span>
                        )}
                    </span>
                    <span className="text-sm text-redup">{s.email}</span>
                </span>
            ),
        },
        { kunci: 'peran', judul: 'Peran', isi: (s) => LABEL_PERAN[s.role] },
        {
            kunci: 'status',
            judul: 'Status',
            isi: (s) =>
                s.isActive ? (
                    <Lencana nada="sukses">Aktif</Lencana>
                ) : (
                    <Lencana nada="bahaya">Nonaktif</Lencana>
                ),
        },
        {
            kunci: 'dibuat',
            judul: 'Dibuat',
            sembunyiSempit: true,
            isi: (s) => formatWaktu(s.createdAt),
        },
        {
            kunci: 'aksi',
            judul: 'Aksi',
            kelas: 'w-16',
            isi: (s) => (
                <TombolIkon
                    ikon="pensil"
                    label={`Ubah ${s.name}`}
                    teks="Ubah"
                    onClick={() => setDialog(s)}
                />
            ),
        },
    ]

    return (
        <>
            <JudulHalaman
                judul="Staf"
                petunjuk="Akun pemilik, kasir, dan mekanik. Peran yang diubah langsung berlaku tanpa masuk ulang."
                aksi={
                    <Tombol onClick={() => setDialog('tambah')}>
                        <Ikon nama="tambah" />
                        Tambah staf
                    </Tombol>
                }
            />
            {daftar.galat && (
                <GalatDaftar galat={daftar.galat} onCobaLagi={() => void daftar.muatUlang()} />
            )}
            {daftar.data === null ? (
                <SkeletonTabel />
            ) : (
                <Tabel
                    keterangan="Daftar staf"
                    kolom={kolom}
                    baris={daftar.data}
                    kunciBaris={(s) => s.staffId}
                    nomorAwal={1}
                />
            )}
            {dialog && (
                <DialogStaf
                    staf={dialog === 'tambah' ? undefined : dialog}
                    diriSendiri={dialog !== 'tambah' && dialog.staffId === staffIdSaya}
                    onTutup={() => setDialog(null)}
                    onSelesai={(s) => {
                        setDialog(null)
                        tampilkanToast(`Akun ${s.name} disimpan.`)
                        void daftar.muatUlang(true)
                    }}
                />
            )}
        </>
    )
}

type Isian = { name: string; email: string; password: string; role: PeranStaf; isActive: boolean }

function DialogStaf({
    staf,
    diriSendiri,
    onSelesai,
    onTutup,
}: {
    staf?: Staf
    diriSendiri: boolean
    onSelesai: (s: Staf) => void
    onTutup: () => void
}) {
    const f = useIsian<Isian>({
        name: staf?.name ?? '',
        email: staf?.email ?? '',
        password: '',
        role: staf?.role ?? 'cashier',
        isActive: staf?.isActive ?? true,
    })
    const { sibuk, kirim } = useKirimForm(f.setGalat, f.setPesan)

    const simpan = () =>
        kirim({
            periksa: () => {
                const fields = saringGalat({
                    name: periksaTeks(f.isian.name, ATURAN.name),
                    email: periksaTeks(f.isian.email, {
                        ...ATURAN.email,
                        kecilkanAscii: true,
                        pola: POLA_EMAIL,
                    }),
                    // Saat mengubah, sandi kosong = tidak diganti.
                    password: periksaTeks(f.isian.password, {
                        ...ATURAN.password,
                        dipangkas: false,
                        opsional: Boolean(staf),
                    }),
                })
                if (Object.keys(fields).length > 0) return { ok: false as const, fields }
                const badan: UbahStafRequest = {
                    name: pangkas(f.isian.name),
                    email: pangkas(f.isian.email).toLowerCase(),
                    role: f.isian.role,
                    ...(f.isian.password ? { password: f.isian.password } : {}),
                    ...(staf ? { isActive: f.isian.isActive } : {}),
                }
                return { ok: true as const, badan }
            },
            kirim: (badan) =>
                staf
                    ? klienStaf().ubahStaf(staf.staffId, badan)
                    : klienStaf().buatStaf({
                          name: badan.name ?? '',
                          email: badan.email ?? '',
                          password: badan.password ?? '',
                          role: badan.role ?? 'cashier',
                      }),
            aturan: ATURAN,
            khusus: {
                email_taken: { field: 'email', pesan: `${PESAN_BAKU.email_taken}.` },
                last_owner: { pesan: `${PESAN_BAKU.last_owner}.` },
            },
            urutan: ['name', 'email', 'password', 'role'],
            idKolom: id,
            berhasil: onSelesai,
        })

    return (
        <DialogForm
            judul={staf ? `Ubah ${staf.name}` : 'Tambah staf'}
            deskripsi={
                staf
                    ? 'Kosongkan kata sandi bila tidak ingin menggantinya.'
                    : 'Staf baru langsung aktif dan bisa masuk dengan email dan kata sandi ini.'
            }
            labelKirim={staf ? 'Simpan perubahan' : 'Tambah staf'}
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
            <Field
                id={id('email')}
                label="Email"
                galat={f.galat.email}
                petunjuk="Dipakai untuk masuk."
            >
                <Input
                    {...atributField(id('email'), f.galat.email, true)}
                    type="email"
                    value={f.isian.email}
                    onChange={(e) => f.ubah('email', e.target.value)}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                />
            </Field>
            <Field
                id={id('password')}
                label={staf ? 'Kata sandi baru' : 'Kata sandi'}
                galat={f.galat.password}
                samping={staf && <span className="text-sm text-redup">Opsional</span>}
                petunjuk="8 sampai 72 byte. Tidak ditampilkan lagi sesudah disimpan."
            >
                <InputSandi
                    {...atributField(id('password'), f.galat.password, true)}
                    value={f.isian.password}
                    onChange={(e) => f.ubah('password', e.target.value)}
                    autoComplete="new-password"
                />
            </Field>
            <Field
                id={id('role')}
                label="Peran"
                galat={f.galat.role}
                petunjuk={PENJELASAN_PERAN[f.isian.role]}
            >
                <Pilihan
                    {...atributField(id('role'), f.galat.role, true)}
                    opsi={PERAN_STAF.map((p) => ({ nilai: p, label: LABEL_PERAN[p] }))}
                    value={f.isian.role}
                    onChange={(e) => f.ubah('role', e.target.value as PeranStaf)}
                />
            </Field>
            {staf && (
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                    <input
                        type="checkbox"
                        checked={f.isian.isActive}
                        onChange={(e) => f.ubah('isActive', e.target.checked)}
                        className="h-5 w-5 accent-utama"
                    />
                    <span>Aktif (bisa masuk)</span>
                </label>
            )}
            {diriSendiri && (f.isian.role !== 'owner' || !f.isian.isActive) && (
                <KotakPesan jenis="peringatan" judul="Ini akunmu sendiri">
                    Bila disimpan, kamu langsung kehilangan akses ke halaman khusus pemilik.
                </KotakPesan>
            )}
        </DialogForm>
    )
}
