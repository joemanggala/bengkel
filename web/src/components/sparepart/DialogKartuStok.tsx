// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import Link from 'next/link'
import GalatDaftar from '@/components/panel/GalatDaftar'
import Dialog from '@/components/ui/Dialog'
import Paginasi from '@/components/ui/Paginasi'
import { SkeletonTabel } from '@/components/ui/Skeleton'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import { useDaftar } from '@/components/ui/useDaftar'
import { klienStaf } from '@/klien/peramban'
import {
    LABEL_JENIS_PERGERAKAN,
    type PergerakanStok,
    type SparepartPemilik,
} from '@/skema/sparepart'
import { formatAngka, formatWaktu } from '@/utils/format'
import { nomorAwal } from '@/utils/query'

const KOLOM: KolomTabel<PergerakanStok>[] = [
    { kunci: 'waktu', judul: 'Waktu', isi: (m) => formatWaktu(m.createdAt) },
    { kunci: 'jenis', judul: 'Jenis', isi: (m) => LABEL_JENIS_PERGERAKAN[m.type] },
    {
        kunci: 'jumlah',
        judul: 'Perubahan',
        angka: true,
        isi: (m) => (m.quantity > 0 ? `+${formatAngka(m.quantity)}` : formatAngka(m.quantity)),
    },
    { kunci: 'sesudah', judul: 'Stok', angka: true, isi: (m) => formatAngka(m.stockAfter) },
    {
        kunci: 'ket',
        judul: 'Keterangan',
        isi: (m) =>
            m.workOrderNumber ? (
                <Link
                    href={`/admin/spk/${m.workOrderNumber}`}
                    className="font-semibold text-utama-tua underline-offset-4 hover:underline"
                >
                    {m.workOrderNumber}
                </Link>
            ) : (
                m.note || '–'
            ),
    },
    { kunci: 'staf', judul: 'Staf', sembunyiSempit: true, isi: (m) => m.staff.name },
]

// Kartu stok satu sparepart: setiap perubahan stok beserta stok sesudahnya, terbaru dulu.
export default function DialogKartuStok({
    part,
    onTutup,
}: {
    part: SparepartPemilik
    onTutup: () => void
}) {
    const [halaman, setHalaman] = useState(1)
    const [ukuran, setUkuran] = useState(10)
    const daftar = useDaftar(
        () => klienStaf().daftarPergerakanStok(part.partId, { page: halaman, limit: ukuran }),
        JSON.stringify([halaman, ukuran]),
    )
    return (
        <Dialog
            terbuka
            lebar
            judul={`Kartu stok ${part.name}`}
            deskripsi={`${part.sku} · stok ${formatAngka(part.stock)} ${part.unit}`}
            onTutup={onTutup}
        >
            {daftar.galat && (
                <GalatDaftar galat={daftar.galat} onCobaLagi={() => void daftar.muatUlang()} />
            )}
            {daftar.data === null ? (
                <SkeletonTabel />
            ) : (
                <Tabel
                    keterangan={`Kartu stok ${part.name}`}
                    kolom={KOLOM}
                    baris={daftar.data}
                    kunciBaris={(m) => m.movementId}
                    nomorAwal={daftar.meta ? nomorAwal(daftar.meta) : 1}
                    kosong="Belum ada perubahan stok."
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
        </Dialog>
    )
}
