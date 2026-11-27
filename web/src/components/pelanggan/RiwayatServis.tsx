// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import Link from 'next/link'
import GalatDaftar from '@/components/panel/GalatDaftar'
import Kartu from '@/components/ui/Kartu'
import { LencanaStatusSpk } from '@/components/ui/Lencana'
import Paginasi from '@/components/ui/Paginasi'
import { SkeletonTabel } from '@/components/ui/Skeleton'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import { useDaftar } from '@/components/ui/useDaftar'
import { klienStaf } from '@/klien/peramban'
import type { SpkRingkas } from '@/skema/spk'
import { formatRupiah, formatWaktu } from '@/utils/format'
import { nomorAwal } from '@/utils/query'

const KOLOM: KolomTabel<SpkRingkas>[] = [
    {
        kunci: 'nomor',
        judul: 'SPK',
        isi: (s) => (
            <Link
                href={`/admin/spk/${s.number}`}
                className="font-bold text-utama-tua underline-offset-4 hover:underline"
            >
                {s.number}
            </Link>
        ),
    },
    { kunci: 'masuk', judul: 'Masuk', isi: (s) => formatWaktu(s.createdAt) },
    {
        kunci: 'keluhan',
        judul: 'Keluhan',
        sembunyiSempit: true,
        isi: (s) => <span className="line-clamp-2">{s.complaint}</span>,
    },
    { kunci: 'status', judul: 'Status', isi: (s) => <LencanaStatusSpk status={s.status} /> },
    { kunci: 'total', judul: 'Total', angka: true, isi: (s) => formatRupiah(s.total) },
]

// Riwayat servis satu kendaraan (GET /api/vehicles/{id}/work-orders), terbaru dulu.
export default function RiwayatServis({ vehicleId, plat }: { vehicleId: string; plat: string }) {
    const [halaman, setHalaman] = useState(1)
    const [ukuran, setUkuran] = useState(10)
    const daftar = useDaftar(
        () => klienStaf().riwayatServisKendaraan(vehicleId, { page: halaman, limit: ukuran }),
        JSON.stringify([vehicleId, halaman, ukuran]),
    )
    return (
        <Kartu judul={`Riwayat servis ${plat}`} rapat>
            <div className="p-4 sm:p-5">
                {daftar.galat && (
                    <GalatDaftar galat={daftar.galat} onCobaLagi={() => void daftar.muatUlang()} />
                )}
                {daftar.data === null ? (
                    <SkeletonTabel baris={3} />
                ) : (
                    <Tabel
                        keterangan={`Riwayat servis ${plat}`}
                        kolom={KOLOM}
                        baris={daftar.data}
                        kunciBaris={(s) => s.number}
                        nomorAwal={daftar.meta ? nomorAwal(daftar.meta) : 1}
                        kosong="Kendaraan ini belum pernah diservis."
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
            </div>
        </Kartu>
    )
}
