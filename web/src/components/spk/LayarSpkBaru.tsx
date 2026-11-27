// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import GalatDaftar from '@/components/panel/GalatDaftar'
import DialogKendaraan from '@/components/pelanggan/DialogKendaraan'
import DialogPelanggan from '@/components/pelanggan/DialogPelanggan'
import Ikon from '@/components/ui/Ikon'
import JudulHalaman from '@/components/ui/JudulHalaman'
import Kartu from '@/components/ui/Kartu'
import KeadaanKosong from '@/components/ui/KeadaanKosong'
import KotakCari from '@/components/ui/KotakCari'
import { SkeletonTabel } from '@/components/ui/Skeleton'
import Tombol from '@/components/ui/Tombol'
import { useDaftar } from '@/components/ui/useDaftar'
import { PATH_BERANDA } from '@/constants/menu'
import { klienStaf } from '@/klien/peramban'
import { LABEL_JENIS_KENDARAAN, type Kendaraan, type Pelanggan } from '@/skema/pelanggan'
import { formatKendaraan, formatNomorHp } from '@/utils/format'
import FormSpkBaru from './FormSpkBaru'

type Pilihan = { pelanggan: Pelanggan; kendaraan: Kendaraan }

type Props = {
    // Dari rincian pelanggan ("SPK baru untuk kendaraan ini"): langsung terpilih.
    awal?: Pilihan
}

// Isian cari yang tampak seperti nomor HP dipakai untuk mengisi awal form pelanggan baru, dan yang
// tampak seperti plat untuk form kendaraan baru.
const miripHp = (teks: string) => /^[+0-9][0-9 -]{5,}$/.test(teks)
const miripPlat = (teks: string) => /^[A-Za-z]{1,3}[ -]?[0-9]/.test(teks)

// SPK untuk pelanggan yang datang langsung. Langkah 1: cari pelanggan dari nama, nomor HP, atau
// plat (GET /api/customers mencocokkan ketiganya dan membawa semua kendaraannya), atau tambahkan
// pelanggan dan kendaraan baru. Langkah 2: keluhan, odometer, estimasi, dan mekanik.
export default function LayarSpkBaru({ awal }: Props) {
    const router = useRouter()
    const [cari, setCari] = useState('')
    const [pilihan, setPilihan] = useState<Pilihan | null>(awal ?? null)
    const [dialog, setDialog] = useState<
        { jenis: 'pelanggan' } | { jenis: 'kendaraan'; pelanggan: Pelanggan } | null
    >(null)

    const daftar = useDaftar(
        async () =>
            cari === ''
                ? { ok: true as const, data: [] as Pelanggan[] }
                : klienStaf().daftarPelanggan({ search: cari, limit: 10 }),
        cari,
    )
    const ubahCari = useCallback((t: string) => setCari(t), [])

    return (
        <>
            <JudulHalaman
                judul="SPK baru"
                petunjuk="Untuk pelanggan yang datang langsung. Pelanggan dari booking website dijadikan SPK dari halaman Booking."
                kembali={{ label: 'Papan servis', href: PATH_BERANDA }}
            />
            {pilihan ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
                    <Kartu
                        judul="Kendaraan"
                        aksi={
                            !awal && (
                                <Tombol varian="kecil" onClick={() => setPilihan(null)}>
                                    Ganti
                                </Tombol>
                            )
                        }
                    >
                        <p className="text-lg font-bold">{formatKendaraan(pilihan.kendaraan)}</p>
                        <p className="text-redup">
                            {LABEL_JENIS_KENDARAAN[pilihan.kendaraan.type]}
                            {pilihan.kendaraan.year !== null && ` · ${pilihan.kendaraan.year}`}
                            {pilihan.kendaraan.color && ` · ${pilihan.kendaraan.color}`}
                        </p>
                        <p className="mt-3 font-semibold">{pilihan.pelanggan.name}</p>
                        <p className="text-redup">{formatNomorHp(pilihan.pelanggan.phone)}</p>
                    </Kartu>
                    <Kartu judul="Data SPK">
                        <FormSpkBaru
                            vehicleId={pilihan.kendaraan.vehicleId}
                            onSelesai={(nomor) => router.push(`/admin/spk/${nomor}`)}
                        />
                    </Kartu>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <KotakCari
                            nilai={cari}
                            onCari={ubahCari}
                            label="Cari pelanggan"
                            placeholder="Plat, nomor HP, atau nama"
                        />
                        <Tombol varian="sekunder" onClick={() => setDialog({ jenis: 'pelanggan' })}>
                            <Ikon nama="tambah" />
                            Pelanggan baru
                        </Tombol>
                    </div>
                    {daftar.galat && (
                        <GalatDaftar
                            galat={daftar.galat}
                            onCobaLagi={() => void daftar.muatUlang()}
                        />
                    )}
                    {cari === '' ? (
                        <KeadaanKosong ikon="cari" judul="Cari kendaraan atau pelanggan">
                            Ketik plat (mis. B 1234), nomor HP, atau nama. Bila belum terdaftar,
                            tambahkan sebagai pelanggan baru.
                        </KeadaanKosong>
                    ) : daftar.data === null || daftar.memuat ? (
                        <SkeletonTabel baris={3} />
                    ) : daftar.data.length === 0 ? (
                        <KeadaanKosong
                            ikon="pelanggan"
                            judul="Belum terdaftar"
                            aksi={
                                <Tombol onClick={() => setDialog({ jenis: 'pelanggan' })}>
                                    Tambah pelanggan baru
                                </Tombol>
                            }
                        >
                            Tidak ada pelanggan atau plat yang cocok dengan &ldquo;{cari}&rdquo;.
                        </KeadaanKosong>
                    ) : (
                        <ul className="space-y-3">
                            {daftar.data.map((p) => (
                                <li
                                    key={p.customerId}
                                    className="rounded-2xl border border-garis bg-permukaan p-4"
                                >
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <p className="font-bold">{p.name}</p>
                                        <p className="text-redup">{formatNomorHp(p.phone)}</p>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {p.vehicles.map((k) => (
                                            <Tombol
                                                key={k.vehicleId}
                                                varian="kecil"
                                                onClick={() =>
                                                    setPilihan({ pelanggan: p, kendaraan: k })
                                                }
                                            >
                                                {formatKendaraan(k)}
                                            </Tombol>
                                        ))}
                                        <Tombol
                                            varian="hantu"
                                            className="min-h-11 px-3 text-[15px]"
                                            onClick={() =>
                                                setDialog({ jenis: 'kendaraan', pelanggan: p })
                                            }
                                        >
                                            <Ikon nama="tambah" />
                                            Kendaraan lain
                                        </Tombol>
                                    </div>
                                    {p.vehicles.length === 0 && (
                                        <p className="mt-2 text-sm text-redup">
                                            Belum ada kendaraan. Tambahkan dulu kendaraannya.
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {dialog?.jenis === 'pelanggan' && (
                <DialogPelanggan
                    phoneAwal={miripHp(cari) ? cari : ''}
                    onTutup={() => setDialog(null)}
                    // Pelanggan baru belum punya kendaraan: langsung lanjut menambahkannya.
                    onSelesai={(p) => setDialog({ jenis: 'kendaraan', pelanggan: p })}
                />
            )}
            {dialog?.jenis === 'kendaraan' && (
                <DialogKendaraan
                    customerId={dialog.pelanggan.customerId}
                    plateAwal={miripPlat(cari) ? cari : ''}
                    onTutup={() => setDialog(null)}
                    onSelesai={(k) => {
                        setPilihan({
                            pelanggan: {
                                ...dialog.pelanggan,
                                vehicles: [...dialog.pelanggan.vehicles, k],
                            },
                            kendaraan: k,
                        })
                        setDialog(null)
                    }}
                />
            )}
        </>
    )
}
