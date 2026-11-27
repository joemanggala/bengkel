// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import Link from 'next/link'
import Ikon from '@/components/ui/Ikon'
import JudulHalaman from '@/components/ui/JudulHalaman'
import Kartu from '@/components/ui/Kartu'
import KeadaanKosong from '@/components/ui/KeadaanKosong'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import { TOMBOL_KECIL } from '@/components/ui/gaya'
import { LABEL_JENIS_KENDARAAN, type Kendaraan, type Pelanggan } from '@/skema/pelanggan'
import { formatNomorHp } from '@/utils/format'
import DialogKendaraan from './DialogKendaraan'
import DialogPelanggan from './DialogPelanggan'
import RiwayatServis from './RiwayatServis'

// Rincian pelanggan: data diri, kendaraannya, dan riwayat servis tiap kendaraan. Dari sini kasir
// bisa langsung membuat SPK untuk kendaraan yang dipilih.
export default function RincianPelanggan({ awal }: { awal: Pelanggan }) {
    const { tampilkanToast } = useToast()
    const [pelanggan, setPelanggan] = useState(awal)
    const [dialog, setDialog] = useState<'ubah' | 'kendaraan' | Kendaraan | null>(null)
    const [riwayat, setRiwayat] = useState<string | null>(awal.vehicles[0]?.vehicleId ?? null)

    const pasangKendaraan = (k: Kendaraan) => {
        setPelanggan((p) => ({
            ...p,
            vehicles: p.vehicles.some((x) => x.vehicleId === k.vehicleId)
                ? p.vehicles.map((x) => (x.vehicleId === k.vehicleId ? k : x))
                : [...p.vehicles, k],
        }))
        setDialog(null)
        tampilkanToast(`Kendaraan ${k.plate} disimpan.`)
    }

    return (
        <>
            <JudulHalaman
                judul={pelanggan.name}
                kembali={{ label: 'Pelanggan', href: '/admin/pelanggan' }}
                deskripsi={formatNomorHp(pelanggan.phone)}
                aksi={
                    <Tombol varian="sekunder" onClick={() => setDialog('ubah')}>
                        <Ikon nama="pensil" />
                        Ubah data
                    </Tombol>
                }
            />
            <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
                <div className="space-y-5">
                    <Kartu judul="Data pelanggan">
                        <dl className="space-y-3">
                            <div>
                                <dt className="text-sm font-semibold text-redup">Alamat</dt>
                                <dd className="whitespace-pre-line">{pelanggan.address || '–'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-semibold text-redup">
                                    Catatan internal
                                </dt>
                                <dd className="whitespace-pre-line">{pelanggan.notes || '–'}</dd>
                            </div>
                        </dl>
                    </Kartu>
                    <Kartu
                        judul="Kendaraan"
                        aksi={
                            <Tombol varian="kecil" onClick={() => setDialog('kendaraan')}>
                                <Ikon nama="tambah" className="h-4 w-4" />
                                Tambah
                            </Tombol>
                        }
                    >
                        {pelanggan.vehicles.length === 0 ? (
                            <p className="text-redup">Belum ada kendaraan.</p>
                        ) : (
                            <ul className="space-y-3">
                                {pelanggan.vehicles.map((k) => (
                                    <li
                                        key={k.vehicleId}
                                        className={`rounded-xl border p-3 ${riwayat === k.vehicleId ? 'border-utama bg-utama-pucat/40' : 'border-garis'}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setRiwayat(k.vehicleId)}
                                            className="block w-full text-left"
                                        >
                                            <span className="block font-bold">{k.plate}</span>
                                            <span className="block text-sm text-redup">
                                                {LABEL_JENIS_KENDARAAN[k.type]} ·{' '}
                                                {[k.brand, k.model].filter(Boolean).join(' ')}
                                                {k.year !== null && ` · ${k.year}`}
                                                {k.color && ` · ${k.color}`}
                                            </span>
                                        </button>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <Link
                                                href={`/admin/spk/baru?pelanggan=${pelanggan.customerId}&kendaraan=${k.vehicleId}`}
                                                className={TOMBOL_KECIL}
                                            >
                                                SPK baru
                                            </Link>
                                            <Tombol varian="kecil" onClick={() => setDialog(k)}>
                                                Ubah
                                            </Tombol>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Kartu>
                </div>
                <div>
                    {riwayat ? (
                        <RiwayatServis
                            key={riwayat}
                            vehicleId={riwayat}
                            plat={
                                pelanggan.vehicles.find((k) => k.vehicleId === riwayat)?.plate ?? ''
                            }
                        />
                    ) : (
                        <KeadaanKosong ikon="dokumen" judul="Belum ada riwayat servis">
                            Tambahkan kendaraan untuk mulai mencatat servisnya.
                        </KeadaanKosong>
                    )}
                </div>
            </div>
            {dialog === 'ubah' && (
                <DialogPelanggan
                    pelanggan={pelanggan}
                    onTutup={() => setDialog(null)}
                    onSelesai={(p) => {
                        setPelanggan(p)
                        setDialog(null)
                        tampilkanToast('Data pelanggan disimpan.')
                    }}
                />
            )}
            {dialog !== null && dialog !== 'ubah' && (
                <DialogKendaraan
                    customerId={pelanggan.customerId}
                    kendaraan={dialog === 'kendaraan' ? undefined : dialog}
                    onTutup={() => setDialog(null)}
                    onSelesai={pasangKendaraan}
                />
            )}
        </>
    )
}
