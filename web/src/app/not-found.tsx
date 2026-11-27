// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import Link from 'next/link'
import { connection } from 'next/server'
import KerangkaPublik from '@/components/publik/KerangkaPublik'
import KeadaanKosong from '@/components/ui/KeadaanKosong'
import { TOMBOL_SEKUNDER } from '@/components/ui/gaya'
import { namaOutlet } from '@/server/outlet'

// Alamat yang tidak dikenal. Kebanyakan pengunjungnya pelanggan yang membuka tautan salah atau
// terpotong (mis. tautan lacak dari WhatsApp yang tidak tersalin utuh), jadi halaman ini
// menjelaskan dan memberi jalan kembali, bukan layar kosong.
//
// connection() membuat halaman ini selalu dirender saat permintaan. Tanpa itu, `next build`
// (tanpa API_URL, jadi tanpa fetch) mencetaknya sebagai halaman statis, lalu saat server berjalan
// fetch profil outlet (no-store) mengubahnya menjadi dinamis dan Next.js membalas 500 "Page
// changed from static to dynamic" untuk alamat yang seharusnya 404, mis.
// /bff/public/%2e%2e/staff/me. Nama outlet sendiri sudah tahan galat (namaOutlet jatuh ke nama
// bawaan bila backend tidak terjangkau).
export default async function TidakDitemukan() {
    await connection()
    return (
        <KerangkaPublik namaOutlet={await namaOutlet()} outlet={null}>
            <KeadaanKosong
                ikon="peringatan"
                judul="Halaman tidak ditemukan"
                aksi={
                    <Link href="/" className={TOMBOL_SEKUNDER}>
                        Ke halaman depan
                    </Link>
                }
            >
                Alamatnya mungkin salah ketik atau terpotong. Kalau kamu membuka tautan dari
                WhatsApp, pastikan tautannya tersalin utuh.
            </KeadaanKosong>
        </KerangkaPublik>
    )
}
