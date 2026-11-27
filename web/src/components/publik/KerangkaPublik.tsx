// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'
import Link from 'next/link'
import Logo from '@/components/panel/Logo'
import Ikon from '@/components/ui/Ikon'
import { PenyediaToast } from '@/components/ui/Toast'
import { TOMBOL_PRIMER } from '@/components/ui/gaya'
import { PATH_BOOKING } from '@/constants/publik'
import type { Outlet } from '@/skema/outlet'
import { formatNomorHp } from '@/utils/format'
import { tautanWhatsApp } from '@/utils/nomorHp'

type Props = {
    namaOutlet: string
    // Profil outlet untuk kaki halaman; null bila backend belum bisa dibaca (kaki cukup nama).
    outlet: Outlet | null
    // sempit = satu kolom 32 rem (form booking, status booking, lacak servis), seperti halaman
    // pelanggan di produk lain; lebar = halaman depan yang bisa memakai dua kolom di laptop.
    lebar?: 'sempit' | 'lebar'
    // Tombol Booking di kepala halaman disembunyikan di halaman booking itu sendiri.
    tanpaTombolBooking?: boolean
    children: ReactNode
}

// Spec menjamin mapsUrl kosong atau diawali http(s)://, tetapi teks itu tetap dari isian staf dan
// masuk ke href, jadi diperiksa lagi: tautan javascript: tidak boleh sampai ke pengunjung.
export const tautanPetaAman = (url: string): boolean => /^https?:\/\/[^\s]+$/.test(url)

const TAUTAN_KAKI =
    'inline-flex min-h-11 items-center gap-2 text-white/90 underline-offset-4 transition-colors hover:text-white hover:underline'

// Kerangka website publik bengkel, dirancang dari layar HP 360 px ke atas (mobile first): kepala
// ringkas yang menempel di atas (logo, nama bengkel, tombol Booking), isi satu kolom, dan kaki
// berisi kontak dari profil outlet. Tanpa menu panjang: pengunjung hanya punya tiga tujuan
// (halaman depan, booking, dan tautan status yang diterimanya), dan staf masuk lewat tautan kecil
// di kaki halaman. Semua teks identitas (nama, alamat, jam buka) dari profil outlet, bukan
// ditulis di kode, jadi tetap netral ("Nama Bengkel" sampai pemilik mengisinya).
export default function KerangkaPublik({
    namaOutlet,
    outlet,
    lebar = 'sempit',
    tanpaTombolBooking,
    children,
}: Props) {
    const lebarIsi = lebar === 'lebar' ? 'max-w-5xl' : 'max-w-lg'
    return (
        <PenyediaToast>
            <div className="flex min-h-screen flex-col bg-latar text-tinta">
                <a
                    href="#konten"
                    className="sr-only rounded-lg bg-tinta px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50"
                >
                    Lewati ke konten
                </a>
                <header className="sticky top-0 z-20 border-b border-garis bg-permukaan">
                    <div
                        className={`mx-auto flex h-16 w-full ${lebarIsi} items-center justify-between gap-3 px-4`}
                    >
                        <Link
                            href="/"
                            aria-label={`${namaOutlet}, ke halaman depan`}
                            className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg"
                        >
                            <Logo className="h-9 w-9 shrink-0" />
                            <span className="truncate text-lg font-bold tracking-tight">
                                {namaOutlet}
                            </span>
                        </Link>
                        {!tanpaTombolBooking && (
                            <Link
                                href={PATH_BOOKING}
                                className={`${TOMBOL_PRIMER} min-h-11 shrink-0 px-4 py-2 text-[15px]`}
                            >
                                Booking
                            </Link>
                        )}
                    </div>
                </header>

                <main
                    id="konten"
                    tabIndex={-1}
                    className={`mx-auto w-full ${lebarIsi} flex-1 px-4 py-6 focus:outline-none`}
                >
                    {children}
                </main>

                <footer className="mt-10 bg-utama-tua text-white">
                    <div className={`mx-auto w-full ${lebarIsi} space-y-4 px-4 py-8`}>
                        <p className="text-lg font-extrabold tracking-tight">{namaOutlet}</p>
                        {outlet && (
                            <ul className="space-y-1 text-[15px]">
                                {outlet.address && (
                                    <li className="flex items-start gap-2 text-white/90">
                                        <Ikon nama="lokasi" className="mt-1 h-4 w-4 shrink-0" />
                                        <span className="whitespace-pre-line">
                                            {outlet.address}
                                        </span>
                                    </li>
                                )}
                                {outlet.openingHours && (
                                    <li className="flex items-start gap-2 text-white/90">
                                        <Ikon nama="jam" className="mt-1 h-4 w-4 shrink-0" />
                                        <span className="whitespace-pre-line">
                                            {outlet.openingHours}
                                        </span>
                                    </li>
                                )}
                                {outlet.phone && (
                                    <li>
                                        <a
                                            href={tautanWhatsApp(outlet.phone)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={TAUTAN_KAKI}
                                        >
                                            <Ikon nama="pesan" className="h-4 w-4 shrink-0" />
                                            WhatsApp {formatNomorHp(outlet.phone)}
                                        </a>
                                    </li>
                                )}
                                {tautanPetaAman(outlet.mapsUrl) && (
                                    <li>
                                        <a
                                            href={outlet.mapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={TAUTAN_KAKI}
                                        >
                                            <Ikon nama="lokasi" className="h-4 w-4 shrink-0" />
                                            Buka di peta
                                        </a>
                                    </li>
                                )}
                            </ul>
                        )}
                        <p className="border-t border-white/20 pt-4 text-sm text-white/85">
                            Kamu staf bengkel?{' '}
                            <Link href="/admin" className="font-semibold text-white underline">
                                Masuk ke panel
                            </Link>
                        </p>
                    </div>
                </footer>
            </div>
        </PenyediaToast>
    )
}
