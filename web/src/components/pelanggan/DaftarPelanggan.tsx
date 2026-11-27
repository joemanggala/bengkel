// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import GalatDaftar from '@/components/panel/GalatDaftar'
import Ikon from '@/components/ui/Ikon'
import JudulHalaman from '@/components/ui/JudulHalaman'
import KotakCari from '@/components/ui/KotakCari'
import Paginasi from '@/components/ui/Paginasi'
import { SkeletonTabel } from '@/components/ui/Skeleton'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import Tombol from '@/components/ui/Tombol'
import { useDaftar } from '@/components/ui/useDaftar'
import { klienStaf } from '@/klien/peramban'
import type { Pelanggan } from '@/skema/pelanggan'
import { formatNomorHp } from '@/utils/format'
import { UKURAN_BAWAAN, nomorAwal } from '@/utils/query'
import DialogPelanggan from './DialogPelanggan'

const KOLOM: KolomTabel<Pelanggan>[] = [
    {
        kunci: 'nama',
        judul: 'Nama',
        isi: (p) => (
            <Link
                href={`/admin/pelanggan/${p.customerId}`}
                className="font-bold text-utama-tua underline-offset-4 hover:underline"
            >
                {p.name}
            </Link>
        ),
    },
    { kunci: 'hp', judul: 'Nomor HP', isi: (p) => formatNomorHp(p.phone) },
    {
        kunci: 'kendaraan',
        judul: 'Kendaraan',
        isi: (p) => (p.vehicles.length === 0 ? '–' : p.vehicles.map((k) => k.plate).join(', ')),
    },
    { kunci: 'alamat', judul: 'Alamat', sembunyiSempit: true, isi: (p) => p.address || '–' },
]

// Daftar pelanggan (pemilik dan kasir): cari dari nama, nomor HP, atau plat kendaraannya.
export default function DaftarPelanggan() {
    const router = useRouter()
    const [cari, setCari] = useState('')
    const [halaman, setHalaman] = useState(1)
    const [ukuran, setUkuran] = useState(UKURAN_BAWAAN)
    const [tambah, setTambah] = useState(false)
    const daftar = useDaftar(
        () =>
            klienStaf().daftarPelanggan({
                search: cari || undefined,
                page: halaman,
                limit: ukuran,
            }),
        JSON.stringify([cari, halaman, ukuran]),
    )
    const ubahCari = useCallback((t: string) => {
        setCari(t)
        setHalaman(1)
    }, [])

    return (
        <>
            <JudulHalaman
                judul="Pelanggan"
                petunjuk="Pelanggan dan kendaraannya. Pelanggan dari booking dibuat otomatis saat booking dijadikan SPK."
                aksi={
                    <Tombol onClick={() => setTambah(true)}>
                        <Ikon nama="tambah" />
                        Tambah pelanggan
                    </Tombol>
                }
            >
                <KotakCari
                    nilai={cari}
                    onCari={ubahCari}
                    label="Cari pelanggan"
                    placeholder="Nama, nomor HP, atau plat"
                />
            </JudulHalaman>
            {daftar.galat && (
                <GalatDaftar galat={daftar.galat} onCobaLagi={() => void daftar.muatUlang()} />
            )}
            {daftar.data === null ? (
                <SkeletonTabel />
            ) : (
                <Tabel
                    keterangan="Daftar pelanggan"
                    kolom={KOLOM}
                    baris={daftar.data}
                    kunciBaris={(p) => p.customerId}
                    nomorAwal={daftar.meta ? nomorAwal(daftar.meta) : 1}
                    kosong={cari ? 'Tidak ada pelanggan yang cocok.' : 'Belum ada pelanggan.'}
                    bawah={
                        daftar.meta && (
                            <Paginasi
                                meta={daftar.meta}
                                disabled={daftar.memuat}
                                onHalaman={setHalaman}
                                onUkuran={(u) => {
                                    setUkuran(u)
                                    setHalaman(1)
                                }}
                            />
                        )
                    }
                />
            )}
            {tambah && (
                <DialogPelanggan
                    onTutup={() => setTambah(false)}
                    onSelesai={(p) => router.push(`/admin/pelanggan/${p.customerId}`)}
                />
            )}
        </>
    )
}
