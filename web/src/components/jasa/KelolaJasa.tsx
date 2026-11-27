// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useCallback, useState } from 'react'
import GalatDaftar from '@/components/panel/GalatDaftar'
import Ikon from '@/components/ui/Ikon'
import JudulHalaman from '@/components/ui/JudulHalaman'
import KotakCari from '@/components/ui/KotakCari'
import { Lencana } from '@/components/ui/Lencana'
import { SkeletonTabel } from '@/components/ui/Skeleton'
import Tab from '@/components/ui/Tab'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import TombolIkon from '@/components/ui/TombolIkon'
import { useDaftar } from '@/components/ui/useDaftar'
import { klienStaf } from '@/klien/peramban'
import type { Jasa } from '@/skema/jasa'
import { formatRupiah } from '@/utils/format'
import DialogJasa from './DialogJasa'

type Saring = 'true' | 'false' | 'semua'

// Katalog jasa (khusus pemilik). Daftar jasa satu bengkel kecil, jadi API membalasnya sekaligus
// tanpa paginasi. Jasa tidak pernah dihapus; yang tidak dipakai lagi dinonaktifkan.
export default function KelolaJasa() {
    const { tampilkanToast } = useToast()
    const [cari, setCari] = useState('')
    const [aktif, setAktif] = useState<Saring>('semua')
    const [dialog, setDialog] = useState<Jasa | 'tambah' | null>(null)
    const daftar = useDaftar(
        () =>
            klienStaf().daftarJasa({
                search: cari || undefined,
                isActive: aktif === 'semua' ? undefined : aktif,
            }),
        JSON.stringify([cari, aktif]),
    )
    const ubahCari = useCallback((t: string) => setCari(t), [])

    const kolom: KolomTabel<Jasa>[] = [
        {
            kunci: 'nama',
            judul: 'Jasa',
            isi: (j) => (
                <span>
                    <span className="block font-semibold">{j.name}</span>
                    {j.description && (
                        <span className="line-clamp-1 text-sm text-redup">{j.description}</span>
                    )}
                </span>
            ),
        },
        { kunci: 'harga', judul: 'Harga', angka: true, isi: (j) => formatRupiah(j.price) },
        {
            kunci: 'durasi',
            judul: 'Durasi',
            sembunyiSempit: true,
            isi: (j) => (j.durationMinutes ? `${j.durationMinutes} menit` : '–'),
        },
        {
            kunci: 'tampil',
            judul: 'Website',
            isi: (j) =>
                j.isPublic ? (
                    <Lencana nada="info">Tampil</Lencana>
                ) : (
                    <Lencana>Disembunyikan</Lencana>
                ),
        },
        {
            kunci: 'aktif',
            judul: 'Status',
            isi: (j) =>
                j.isActive ? (
                    <Lencana nada="sukses">Aktif</Lencana>
                ) : (
                    <Lencana nada="bahaya">Nonaktif</Lencana>
                ),
        },
        {
            kunci: 'aksi',
            judul: 'Aksi',
            kelas: 'w-16',
            isi: (j) => (
                <TombolIkon
                    ikon="pensil"
                    label={`Ubah jasa ${j.name}`}
                    teks="Ubah"
                    onClick={() => setDialog(j)}
                />
            ),
        },
    ]

    return (
        <>
            <JudulHalaman
                judul="Jasa"
                petunjuk="Katalog jasa servis. Jasa bertanda Tampil muncul di halaman depan website dan bisa dipilih saat booking. Urutan tampil kecil dulu."
                aksi={
                    <Tombol onClick={() => setDialog('tambah')}>
                        <Ikon nama="tambah" />
                        Tambah jasa
                    </Tombol>
                }
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Tab
                        label="Saring status"
                        opsi={[
                            { nilai: 'semua', label: 'Semua' },
                            { nilai: 'true', label: 'Aktif' },
                            { nilai: 'false', label: 'Nonaktif' },
                        ]}
                        nilai={aktif}
                        onUbah={setAktif}
                    />
                    <KotakCari nilai={cari} onCari={ubahCari} label="Cari jasa" />
                </div>
            </JudulHalaman>
            {daftar.galat && (
                <GalatDaftar galat={daftar.galat} onCobaLagi={() => void daftar.muatUlang()} />
            )}
            {daftar.data === null ? (
                <SkeletonTabel />
            ) : (
                <Tabel
                    keterangan="Daftar jasa"
                    kolom={kolom}
                    baris={daftar.data}
                    kunciBaris={(j) => j.serviceId}
                    nomorAwal={1}
                    kosong={
                        cari
                            ? 'Tidak ada jasa yang cocok.'
                            : 'Belum ada jasa. Tambahkan jasa pertama.'
                    }
                />
            )}
            {dialog && (
                <DialogJasa
                    jasa={dialog === 'tambah' ? undefined : dialog}
                    onTutup={() => setDialog(null)}
                    onSelesai={(j) => {
                        setDialog(null)
                        tampilkanToast(`Jasa ${j.name} disimpan.`)
                        void daftar.muatUlang(true)
                    }}
                />
            )}
        </>
    )
}
