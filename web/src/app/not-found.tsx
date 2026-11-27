// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import Link from 'next/link'
import KerangkaPublik from '@/components/publik/KerangkaPublik'
import KeadaanKosong from '@/components/ui/KeadaanKosong'
import { TOMBOL_SEKUNDER } from '@/components/ui/gaya'
import { namaOutlet } from '@/server/outlet'

// Alamat yang tidak dikenal. Kebanyakan pengunjungnya pelanggan yang membuka tautan salah atau
// terpotong (mis. tautan lacak dari WhatsApp yang tidak tersalin utuh), jadi halaman ini
// menjelaskan dan memberi jalan kembali, bukan layar kosong.
export default async function TidakDitemukan() {
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
