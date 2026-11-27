// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import DialogKonfirmasi from '@/components/ui/DialogKonfirmasi'
import Ikon from '@/components/ui/Ikon'
import Kartu from '@/components/ui/Kartu'
import Tabel, { type KolomTabel } from '@/components/ui/Tabel'
import Tombol from '@/components/ui/Tombol'
import TombolIkon from '@/components/ui/TombolIkon'
import { useAksi } from '@/components/ui/useAksi'
import { klienStaf } from '@/klien/peramban'
import { LABEL_JENIS_ITEM, MAKS_BARIS_ITEM, type ItemSpk, type SpkDetail } from '@/skema/spk'
import { formatAngka, formatRupiah } from '@/utils/format'
import { spkTerbuka } from '@/utils/statusSpk'
import DialogItem from './DialogItem'

type Props = { spk: SpkDetail; bolehUbah: boolean; onSpk: (spk: SpkDetail) => void }

// Item jasa dan sparepart SPK. Hanya pemilik dan kasir yang menambah atau menghapus, dan hanya
// selama SPK belum selesai (sejak Selesai item terkunci, spec: work_order_locked).
export default function KartuItemSpk({ spk, bolehUbah, onSpk }: Props) {
    const [tambah, setTambah] = useState(false)
    const [hapus, setHapus] = useState<ItemSpk | null>(null)
    const { jalankan } = useAksi()
    const terbuka = bolehUbah && spkTerbuka(spk.status)
    const penuh = spk.items.length >= MAKS_BARIS_ITEM

    const kolom: KolomTabel<ItemSpk>[] = [
        {
            kunci: 'nama',
            judul: 'Item',
            isi: (i) => (
                <span>
                    <span className="block font-semibold">{i.name}</span>
                    <span className="text-sm text-redup">{LABEL_JENIS_ITEM[i.type]}</span>
                </span>
            ),
        },
        { kunci: 'jumlah', judul: 'Jumlah', angka: true, isi: (i) => formatAngka(i.quantity) },
        {
            kunci: 'harga',
            judul: 'Harga',
            angka: true,
            sembunyiSempit: true,
            isi: (i) => formatRupiah(i.price),
        },
        { kunci: 'subtotal', judul: 'Subtotal', angka: true, isi: (i) => formatRupiah(i.subtotal) },
    ]
    if (terbuka) {
        kolom.push({
            kunci: 'aksi',
            judul: 'Aksi',
            kelas: 'w-16',
            isi: (i) => (
                <TombolIkon
                    ikon="sampah"
                    nada="bahaya"
                    label={`Hapus ${i.name}`}
                    teks="Hapus"
                    onClick={() => setHapus(i)}
                />
            ),
        })
    }

    return (
        <Kartu
            judul="Item jasa dan sparepart"
            rapat
            aksi={
                terbuka && (
                    <Tombol varian="kecil" onClick={() => setTambah(true)} disabled={penuh}>
                        <Ikon nama="tambah" className="h-4 w-4" />
                        Tambah item
                    </Tombol>
                )
            }
        >
            <div className="p-4 sm:p-5">
                <Tabel
                    keterangan={`Item SPK ${spk.number}`}
                    kolom={kolom}
                    baris={spk.items}
                    kunciBaris={(i) => i.itemId}
                    nomorAwal={1}
                    kosong={
                        terbuka
                            ? 'Belum ada item. Tambahkan jasa atau sparepart.'
                            : 'Tidak ada item.'
                    }
                />
                <dl className="angka mt-4 space-y-1 text-right">
                    <div className="flex justify-end gap-6 text-redup">
                        <dt>Jasa</dt>
                        <dd className="min-w-28">{formatRupiah(spk.serviceSubtotal)}</dd>
                    </div>
                    <div className="flex justify-end gap-6 text-redup">
                        <dt>Sparepart</dt>
                        <dd className="min-w-28">{formatRupiah(spk.partSubtotal)}</dd>
                    </div>
                    <div className="flex justify-end gap-6 text-lg font-bold">
                        <dt>Total</dt>
                        <dd className="min-w-28">{formatRupiah(spk.total)}</dd>
                    </div>
                </dl>
                {penuh && terbuka && (
                    <p className="mt-2 text-sm text-redup">
                        SPK sudah berisi {MAKS_BARIS_ITEM} item, batas terbanyak.
                    </p>
                )}
            </div>
            {tambah && <DialogItem spk={spk} onSpk={onSpk} onTutup={() => setTambah(false)} />}
            <DialogKonfirmasi
                terbuka={hapus !== null}
                judul={`Hapus ${hapus?.name ?? 'item'}?`}
                deskripsi={
                    hapus?.type === 'PART'
                        ? `Stok ${formatAngka(hapus.quantity)} sparepart ini kembali ke rak.`
                        : 'Item ini dihapus dari SPK.'
                }
                labelKonfirmasi="Hapus item"
                berbahaya
                onTutup={() => setHapus(null)}
                onKonfirmasi={async () => {
                    if (!hapus) return
                    await jalankan(
                        'hapus',
                        () => klienStaf().hapusItemSpk(spk.number, hapus.itemId),
                        {
                            berhasil: `${hapus.name} dihapus.`,
                            sesudah: onSpk,
                        },
                    )
                    setHapus(null)
                }}
            />
        </Kartu>
    )
}
