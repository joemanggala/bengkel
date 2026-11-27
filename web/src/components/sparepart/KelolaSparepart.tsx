// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useCallback, useState } from 'react'
import GalatDaftar from '@/components/panel/GalatDaftar'
import Ikon from '@/components/ui/Ikon'
import JudulHalaman from '@/components/ui/JudulHalaman'
import KotakCari from '@/components/ui/KotakCari'
import { Lencana, LencanaLevelStok } from '@/components/ui/Lencana'
import Paginasi from '@/components/ui/Paginasi'
import { SkeletonTabel } from '@/components/ui/Skeleton'
import Tab from '@/components/ui/Tab'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import TombolIkon from '@/components/ui/TombolIkon'
import { useDaftar } from '@/components/ui/useDaftar'
import { klienStaf } from '@/klien/peramban'
import { punyaHargaBeli, type SparepartPemilik } from '@/skema/sparepart'
import { formatAngka, formatRupiah } from '@/utils/format'
import { UKURAN_BAWAAN, nomorAwal } from '@/utils/query'
import DialogKartuStok from './DialogKartuStok'
import DialogSparepart from './DialogSparepart'
import DialogStok, { type JenisStok } from './DialogStok'

type Saring = 'semua' | 'menipis' | 'nonaktif'

type Dialog =
    | { jenis: 'tambah' }
    | { jenis: 'ubah'; part: SparepartPemilik }
    | { jenis: 'kartu'; part: SparepartPemilik }
    | { jenis: JenisStok; part: SparepartPemilik }

// Sparepart dan stok (khusus pemilik, karena memuat harga beli). Tab "Stok menipis" = sparepart
// yang perlu dibeli (stok <= stok minimum).
export default function KelolaSparepart() {
    const { tampilkanToast } = useToast()
    const [saring, setSaring] = useState<Saring>('semua')
    const [cari, setCari] = useState('')
    const [halaman, setHalaman] = useState(1)
    const [ukuran, setUkuran] = useState(UKURAN_BAWAAN)
    const [dialog, setDialog] = useState<Dialog | null>(null)
    const daftar = useDaftar(
        () =>
            klienStaf().daftarSparepart({
                search: cari || undefined,
                lowStock: saring === 'menipis' ? 'true' : undefined,
                isActive:
                    saring === 'nonaktif' ? 'false' : saring === 'menipis' ? 'true' : undefined,
                page: halaman,
                limit: ukuran,
            }),
        JSON.stringify([saring, cari, halaman, ukuran]),
    )
    const ubahCari = useCallback((t: string) => {
        setCari(t)
        setHalaman(1)
    }, [])
    // Halaman ini khusus pemilik, jadi setiap baris semestinya membawa harga beli.
    const baris = (daftar.data ?? []).filter(punyaHargaBeli)

    const selesai = (p: SparepartPemilik, pesan: string) => {
        setDialog(null)
        tampilkanToast(pesan.replace('{nama}', p.name))
        void daftar.muatUlang(true)
    }

    const kolom: KolomTabel<SparepartPemilik>[] = [
        {
            kunci: 'nama',
            judul: 'Sparepart',
            isi: (p) => (
                <span>
                    <span className="block font-semibold">{p.name}</span>
                    <span className="text-sm text-redup">
                        {p.sku}
                        {!p.isActive && ' · nonaktif'}
                    </span>
                </span>
            ),
        },
        { kunci: 'jual', judul: 'Harga jual', angka: true, isi: (p) => formatRupiah(p.price) },
        {
            kunci: 'beli',
            judul: 'Harga beli',
            angka: true,
            sembunyiSempit: true,
            isi: (p) =>
                p.costPrice === 0 ? (
                    <Lencana nada="peringatan">Belum diisi</Lencana>
                ) : (
                    formatRupiah(p.costPrice)
                ),
        },
        {
            kunci: 'stok',
            judul: 'Stok',
            angka: true,
            kelas: 'whitespace-nowrap',
            isi: (p) => `${formatAngka(p.stock)} ${p.unit}`,
        },
        { kunci: 'level', judul: 'Level', isi: (p) => <LencanaLevelStok level={p.stockLevel} /> },
        {
            kunci: 'aksi',
            judul: 'Aksi',
            isi: (p) => (
                <div className="flex gap-1.5">
                    <TombolIkon
                        ikon="tambah"
                        nada="berhasil"
                        label={`Stok masuk ${p.name}`}
                        teks="Stok masuk"
                        onClick={() => setDialog({ jenis: 'masuk', part: p })}
                    />
                    <TombolIkon
                        ikon="kurang"
                        nada="peringatan"
                        label={`Stok keluar ${p.name}`}
                        teks="Stok keluar"
                        onClick={() => setDialog({ jenis: 'keluar', part: p })}
                    />
                    <TombolIkon
                        ikon="putar"
                        label={`Hitung ulang ${p.name}`}
                        teks="Hitung ulang"
                        onClick={() => setDialog({ jenis: 'hitung', part: p })}
                    />
                    <TombolIkon
                        ikon="dokumen"
                        label={`Kartu stok ${p.name}`}
                        teks="Kartu stok"
                        onClick={() => setDialog({ jenis: 'kartu', part: p })}
                    />
                    <TombolIkon
                        ikon="pensil"
                        label={`Ubah ${p.name}`}
                        teks="Ubah"
                        onClick={() => setDialog({ jenis: 'ubah', part: p })}
                    />
                </div>
            ),
        },
    ]

    return (
        <>
            <JudulHalaman
                judul="Sparepart"
                petunjuk="Stok berkurang saat sparepart ditambahkan ke SPK dan kembali bila item dihapus atau SPK dibatalkan. Harga beli hanya terlihat di halaman ini."
                aksi={
                    <Tombol onClick={() => setDialog({ jenis: 'tambah' })}>
                        <Ikon nama="tambah" />
                        Tambah sparepart
                    </Tombol>
                }
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Tab
                        label="Saring sparepart"
                        opsi={[
                            { nilai: 'semua', label: 'Semua' },
                            { nilai: 'menipis', label: 'Stok menipis' },
                            { nilai: 'nonaktif', label: 'Nonaktif' },
                        ]}
                        nilai={saring}
                        onUbah={(s) => {
                            setSaring(s)
                            setHalaman(1)
                        }}
                    />
                    <KotakCari
                        nilai={cari}
                        onCari={ubahCari}
                        label="Cari sparepart"
                        placeholder="Nama atau SKU"
                    />
                </div>
            </JudulHalaman>
            {daftar.galat && (
                <GalatDaftar galat={daftar.galat} onCobaLagi={() => void daftar.muatUlang()} />
            )}
            {daftar.data === null ? (
                <SkeletonTabel />
            ) : (
                <Tabel
                    keterangan="Daftar sparepart"
                    kolom={kolom}
                    baris={baris}
                    kunciBaris={(p) => p.partId}
                    nomorAwal={daftar.meta ? nomorAwal(daftar.meta) : 1}
                    kosong={
                        saring === 'menipis'
                            ? 'Tidak ada stok yang menipis.'
                            : 'Belum ada sparepart.'
                    }
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
            {dialog?.jenis === 'tambah' && (
                <DialogSparepart
                    onTutup={() => setDialog(null)}
                    onSelesai={(p) => selesai(p, 'Sparepart {nama} ditambahkan.')}
                />
            )}
            {dialog?.jenis === 'ubah' && (
                <DialogSparepart
                    part={dialog.part}
                    onTutup={() => setDialog(null)}
                    onSelesai={(p) => selesai(p, 'Sparepart {nama} disimpan.')}
                />
            )}
            {dialog?.jenis === 'kartu' && (
                <DialogKartuStok part={dialog.part} onTutup={() => setDialog(null)} />
            )}
            {(dialog?.jenis === 'masuk' ||
                dialog?.jenis === 'keluar' ||
                dialog?.jenis === 'hitung') && (
                <DialogStok
                    jenis={dialog.jenis}
                    part={dialog.part}
                    onTutup={() => setDialog(null)}
                    onSelesai={(p) =>
                        selesai(p, `Stok {nama} sekarang ${formatAngka(p.stock)} ${p.unit}.`)
                    }
                />
            )}
        </>
    )
}
