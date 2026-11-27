// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import Link from 'next/link'
import BookingKamu from '@/components/publik/BookingKamu'
import DaftarJasa from '@/components/publik/DaftarJasa'
import GalatMuatPublik from '@/components/publik/GalatMuatPublik'
import KerangkaPublik from '@/components/publik/KerangkaPublik'
import LangkahBooking from '@/components/publik/LangkahBooking'
import TanyaJawab from '@/components/publik/TanyaJawab'
import Ikon from '@/components/ui/Ikon'
import { TOMBOL_PRIMER, TOMBOL_SEKUNDER } from '@/components/ui/gaya'
import { NAMA_OUTLET_BAWAAN } from '@/constants/outlet'
import { PATH_BOOKING } from '@/constants/publik'
import { profilOutlet } from '@/server/outlet'
import { klienServer } from '@/server/pengangkut'
import { tautanWhatsApp } from '@/utils/nomorHp'

// Profil outlet dibaca dari backend setiap kali halaman dibuka (jangan dibekukan saat build),
// dan dirender di server supaya nama, alamat, dan isi halaman terbaca mesin pencari.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
    const outlet = await profilOutlet()
    if (!outlet.ok) return { title: { absolute: NAMA_OUTLET_BAWAAN } }
    return {
        title: { absolute: outlet.data.name },
        description: outlet.data.tagline || undefined,
    }
}

// Halaman depan website bengkel: nama dan tagline outlet, tombol booking dan WhatsApp, jasa dan
// harga (GET /api/public/services), booking yang pernah dibuat dari browser ini, langkah booking,
// dan tanya jawab (src/constants/konten.ts). Alamat, jam buka, dan peta ada di kaki halaman.
export default async function HalamanDepan() {
    const [outlet, jasa] = await Promise.all([profilOutlet(), klienServer().jasaPublik()])
    const nama = outlet.ok ? outlet.data.name : NAMA_OUTLET_BAWAAN
    const profil = outlet.ok ? outlet.data : null

    return (
        <KerangkaPublik namaOutlet={nama} outlet={profil} lebar="lebar">
            <div className="space-y-10">
                <header className="rounded-2xl border border-garis bg-permukaan px-5 py-8 sm:px-8 sm:py-10">
                    <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                        {nama}
                    </h1>
                    {profil?.tagline && (
                        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-redup">
                            {profil.tagline}
                        </p>
                    )}
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Link href={PATH_BOOKING} className={TOMBOL_PRIMER}>
                            <Ikon nama="kalender" className="h-5 w-5" />
                            Booking servis
                        </Link>
                        {profil?.phone && (
                            <a
                                href={tautanWhatsApp(profil.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={TOMBOL_SEKUNDER}
                            >
                                <Ikon nama="pesan" className="h-5 w-5" />
                                Tanya lewat WhatsApp
                            </a>
                        )}
                    </div>
                </header>
                {!outlet.ok && (
                    <GalatMuatPublik
                        galat={outlet.galat}
                        judul="Profil bengkel belum bisa dimuat"
                    />
                )}
                <BookingKamu />
                {jasa.ok ? (
                    <DaftarJasa jasa={jasa.data} />
                ) : (
                    <GalatMuatPublik galat={jasa.galat} judul="Daftar jasa belum bisa dimuat" />
                )}
                <div className="grid gap-10 lg:grid-cols-2">
                    <LangkahBooking />
                    <TanyaJawab />
                </div>
            </div>
        </KerangkaPublik>
    )
}
