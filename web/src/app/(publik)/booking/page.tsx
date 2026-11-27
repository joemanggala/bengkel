// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import FormBooking from '@/components/publik/FormBooking'
import GalatMuatPublik from '@/components/publik/GalatMuatPublik'
import KerangkaPublik from '@/components/publik/KerangkaPublik'
import { NAMA_OUTLET_BAWAAN } from '@/constants/outlet'
import { profilOutlet } from '@/server/outlet'
import { klienServer } from '@/server/pengangkut'
import { ambilTeks } from '@/utils/query'

export const metadata: Metadata = { title: 'Booking servis' }

// Profil outlet dan daftar jasa selalu yang terbaru.
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ jasa?: string | string[] }> }

// Form booking publik. Daftar jasa dibaca di server dari GET /api/public/services (tanpa token).
// Bila daftar jasa gagal dimuat, form tetap bisa dipakai tanpa memilih jasa.
export default async function HalamanBooking({ searchParams }: Props) {
    const [outlet, jasa, { jasa: jasaAwal }] = await Promise.all([
        profilOutlet(),
        klienServer().jasaPublik(),
        searchParams,
    ])
    const nama = outlet.ok ? outlet.data.name : NAMA_OUTLET_BAWAAN
    return (
        <KerangkaPublik
            namaOutlet={nama}
            outlet={outlet.ok ? outlet.data : null}
            tanpaTombolBooking
        >
            <div className="space-y-5">
                <header>
                    <h1 className="text-2xl font-extrabold leading-tight">Booking servis</h1>
                    <p className="mt-2 leading-relaxed text-redup">
                        Isi data kendaraan dan tanggal datang. Tanpa daftar akun; konfirmasi dikirim
                        lewat WhatsApp.
                    </p>
                </header>
                {!jasa.ok && (
                    <GalatMuatPublik galat={jasa.galat} judul="Daftar jasa belum bisa dimuat" />
                )}
                <div className="rounded-2xl border border-garis bg-permukaan p-5">
                    <FormBooking jasa={jasa.ok ? jasa.data : []} jasaAwal={ambilTeks(jasaAwal)} />
                </div>
            </div>
        </KerangkaPublik>
    )
}
