// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Ikon from '@/components/ui/Ikon'
import { alamatStatusBooking } from '@/constants/publik'
import { formatWaktuWib } from '@/utils/format'
import { bacaBookingTersimpan, type BookingTersimpan } from '@/utils/penyimpanan'

// Booking yang pernah dibuat dari browser ini (tersimpan di penyimpanan lokal), supaya pelanggan
// bisa membuka statusnya lagi tanpa mencari tautannya. Dibaca sesudah tampil pertama, bukan saat
// render, agar HTML dari server dan browser sama. Tidak tampil apa pun bila kosong.
export default function BookingKamu() {
    const [daftar, setDaftar] = useState<BookingTersimpan[]>([])
    useEffect(() => setDaftar(bacaBookingTersimpan()), [])
    if (daftar.length === 0) return null
    return (
        <section aria-labelledby="judul-booking-kamu">
            <h2 id="judul-booking-kamu" className="text-xl font-bold">
                Booking kamu
            </h2>
            <ul className="mt-3 divide-y divide-garis overflow-hidden rounded-2xl border border-garis bg-permukaan">
                {daftar.map((b) => (
                    <li key={b.token}>
                        <Link
                            href={alamatStatusBooking(b.token)}
                            className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-latar"
                        >
                            <span>
                                <span className="block font-semibold">Booking {b.nomor}</span>
                                <span className="block text-sm text-redup">
                                    {formatWaktuWib(b.dibuat)}
                                </span>
                            </span>
                            <Ikon nama="kanan" className="h-5 w-5 text-redup" />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}
