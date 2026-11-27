// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Ikon from '@/components/ui/Ikon'
import { PenyediaToast } from '@/components/ui/Toast'
import { MENU_PANEL, PATH_BERANDA, itemAktif, menuUntuk, type ItemMenu } from '@/constants/menu'

// Menu yang hanya untuk pemilik dikelompokkan sendiri di bawah judul "Khusus pemilik".
const khususPemilik = (item: ItemMenu): boolean =>
    item.peran.length === 1 && item.peran[0] === 'owner'
import type { Staf } from '@/skema/staf'
import Logo from './Logo'
import MenuPengguna from './MenuPengguna'

type Props = { staf: Staf; namaOutlet: string; children: ReactNode }

// Tiga bentuk menu menurut lebar layar:
// - ponsel (< 768 px): laci yang dibuka dari tombol menu;
// - tablet (768-1023 px): rel ikon 96 px dengan label di bawah ikon, selalu terlihat, supaya
//   kasir berpindah halaman dengan satu ketukan tanpa menutupi papan servis;
// - laptop (>= 1024 px): sidebar 256 px dengan ikon dan label sebaris. Tombol di bilah atas
//   melipatnya jadi lajur ikon 72 px; pilihannya diingat di browser ini.
//
// Kelas lebar dan ringkas dipisah karena keduanya mengatur utilitas yang sama pada varian lg:
// kelas yang bentrok dalam satu string tidak bisa diandalkan urutannya.
const ITEM =
    'group relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-semibold transition-colors md:min-h-16 md:flex-col md:justify-center md:gap-1 md:px-1 md:py-2 md:text-center md:text-[13px] md:leading-tight lg:min-h-11 lg:flex-row lg:py-2.5 lg:text-[15px]'
const ITEM_LEBAR = 'lg:justify-start lg:gap-3 lg:px-3 lg:text-left'
const ITEM_RINGKAS = 'lg:justify-center lg:gap-0 lg:px-0'
const KUNCI_RINGKAS = 'bengkel-sidebar-ringkas'

function TautanMenu({
    item,
    aktif,
    ringkas,
}: {
    item: ItemMenu
    aktif: boolean
    ringkas: boolean
}) {
    return (
        <li>
            <Link
                href={item.href}
                aria-current={aktif ? 'page' : undefined}
                title={ringkas ? item.label : undefined}
                className={`${ITEM} ${ringkas ? ITEM_RINGKAS : ITEM_LEBAR} ${
                    aktif ? 'bg-utama-pucat text-utama-tua' : 'text-tinta hover:bg-utama-pucat/60'
                }`}
            >
                {aktif && (
                    <span
                        aria-hidden="true"
                        className="absolute -left-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-utama"
                    />
                )}
                <Ikon
                    nama={item.ikon}
                    className={`h-6 w-6 shrink-0 ${aktif ? 'text-utama-tua' : 'text-redup group-hover:text-tinta'}`}
                />
                {/* Di lajur ikon label tetap dibacakan pembaca layar, hanya disembunyikan dari mata. */}
                <span className={ringkas ? 'lg:sr-only' : undefined}>{item.label}</span>
            </Link>
        </li>
    )
}

export default function KerangkaPanel({ staf, namaOutlet, children }: Props) {
    const path = usePathname()
    const [laciTerbuka, setLaciTerbuka] = useState(false)
    const [ringkas, setRingkas] = useState(false)
    // Menu mengikuti peran: kasir tidak melihat menu khusus pemilik sama sekali, dan mekanik
    // hanya melihat Papan servis (lihat src/constants/menu.ts).
    const menu = menuUntuk(staf.role, MENU_PANEL)
    const aktif = itemAktif(path, menu)
    const menuUmum = menu.filter((item) => !khususPemilik(item))
    const menuPemilik = menu.filter(khususPemilik)

    // Dibaca sesudah tampil pertama, bukan saat render, agar HTML dari server dan klien sama.
    useEffect(() => {
        try {
            if (localStorage.getItem(KUNCI_RINGKAS) === '1') setRingkas(true)
        } catch {
            // Penyimpanan diblokir: menu tetap bisa dilipat, hanya tidak diingat.
        }
    }, [])

    const ubahRingkas = () => {
        const baru = !ringkas
        setRingkas(baru)
        try {
            localStorage.setItem(KUNCI_RINGKAS, baru ? '1' : '0')
        } catch {
            // Lihat di atas.
        }
    }

    // Laci ditutup setiap pindah halaman, supaya halaman baru tidak tertutup menu.
    useEffect(() => setLaciTerbuka(false), [path])

    useEffect(() => {
        if (!laciTerbuka) return
        const tekan = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLaciTerbuka(false)
        }
        document.addEventListener('keydown', tekan)
        return () => document.removeEventListener('keydown', tekan)
    }, [laciTerbuka])

    return (
        <PenyediaToast>
            <div className="min-h-screen bg-latar text-tinta">
                <a
                    href="#konten"
                    className="sr-only rounded-lg bg-tinta px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50"
                >
                    Lewati ke konten
                </a>
                <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-garis bg-permukaan">
                    <div className="flex h-full items-center justify-between gap-3 px-3 md:px-4">
                        <div className="flex min-w-0 items-center gap-1">
                            <button
                                type="button"
                                aria-controls="navigasi-panel"
                                aria-expanded={laciTerbuka}
                                aria-label={laciTerbuka ? 'Tutup menu' : 'Buka menu'}
                                onClick={() => setLaciTerbuka((nilai) => !nilai)}
                                className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-tinta transition-colors hover:bg-latar md:hidden"
                            >
                                <Ikon
                                    nama={laciTerbuka ? 'tutup' : 'hamburger'}
                                    className="h-6 w-6"
                                />
                            </button>
                            <button
                                type="button"
                                aria-controls="navigasi-panel"
                                aria-expanded={!ringkas}
                                aria-label={ringkas ? 'Lebarkan menu' : 'Ciutkan menu'}
                                title={ringkas ? 'Lebarkan menu' : 'Ciutkan menu'}
                                onClick={ubahRingkas}
                                className="hidden h-11 w-11 shrink-0 place-items-center rounded-lg text-tinta transition-colors hover:bg-latar lg:grid"
                            >
                                <Ikon nama="hamburger" className="h-6 w-6" />
                            </button>
                            <Link
                                href={PATH_BERANDA}
                                className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-1.5"
                            >
                                <Logo className="h-9 w-9 shrink-0" />
                                <span className="truncate text-lg font-bold tracking-tight">
                                    {namaOutlet}
                                </span>
                            </Link>
                        </div>
                        <MenuPengguna staf={staf} />
                    </div>
                </header>

                {/* Di tablet dan laptop kolom menu ikut alur halaman: kolom putihnya setinggi
                    konten, sedangkan isinya menempel (sticky) setinggi layar. */}
                <div className="flex min-h-screen pt-16">
                    <nav
                        id="navigasi-panel"
                        aria-label="Menu utama"
                        className={`${laciTerbuka ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-20 w-72 flex-col border-r border-garis bg-permukaan pt-16 shadow-xl md:static md:z-auto md:flex md:w-24 md:shrink-0 md:pt-0 md:shadow-none lg:transition-[width] lg:duration-200 motion-reduce:transition-none ${
                            ringkas ? 'lg:w-[4.5rem]' : 'lg:w-64'
                        }`}
                    >
                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 md:sticky md:top-16 md:h-[calc(100dvh-4rem)] md:flex-none md:px-2 lg:px-3">
                            <ul className="space-y-1">
                                {menuUmum.map((item) => (
                                    <TautanMenu
                                        key={item.href}
                                        item={item}
                                        aktif={item === aktif}
                                        ringkas={ringkas}
                                    />
                                ))}
                            </ul>
                            {menuPemilik.length > 0 && (
                                <div className="mt-4 border-t border-garis pt-4">
                                    {/* Di rel ikon judul kelompok disembunyikan (tetap dibacakan);
                                        garis pembatas sudah cukup memisahkan. */}
                                    <p
                                        id="judul-menu-pemilik"
                                        className={`mb-2 px-3 text-sm font-semibold text-redup ${
                                            ringkas ? 'md:sr-only' : 'md:sr-only lg:not-sr-only'
                                        }`}
                                    >
                                        Khusus pemilik
                                    </p>
                                    <ul aria-labelledby="judul-menu-pemilik" className="space-y-1">
                                        {menuPemilik.map((item) => (
                                            <TautanMenu
                                                key={item.href}
                                                item={item}
                                                aktif={item === aktif}
                                                ringkas={ringkas}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </nav>

                    {laciTerbuka && (
                        <div
                            aria-hidden="true"
                            onClick={() => setLaciTerbuka(false)}
                            className="fixed inset-0 z-10 bg-tinta/50 md:hidden"
                        />
                    )}

                    {/* Area kerja selebar layar, rata kiri. Bantalan px-4 sm:px-6 dan py-6 ini
                        dibaca JudulHalaman, yang membentangkan pitanya sampai tepi lewat margin
                        negatif. */}
                    <main
                        id="konten"
                        tabIndex={-1}
                        className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6"
                    >
                        {children}
                    </main>
                </div>
            </div>
        </PenyediaToast>
    )
}
