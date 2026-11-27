// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import LayarSpkBaru from '@/components/spk/LayarSpkBaru'
import { POLA_UUID } from '@/skema/umum'
import { klienServer } from '@/server/pengangkut'
import { arahkanBilaDitolak, wajibKasir } from '@/server/sesi'
import { ambilTeks } from '@/utils/query'

export const metadata: Metadata = { title: 'SPK baru' }

type Props = { searchParams: Promise<{ pelanggan?: string; kendaraan?: string }> }

// SPK untuk pelanggan yang datang langsung (pemilik dan kasir). Dari rincian pelanggan,
// ?pelanggan=<id>&kendaraan=<id> langsung memilih kendaraannya; id yang tidak dikenal diabaikan
// dan staf mulai dari pencarian.
export default async function HalamanSpkBaru({ searchParams }: Props) {
    const { token } = await wajibKasir()
    const q = await searchParams
    const idPelanggan = ambilTeks(q.pelanggan)
    const idKendaraan = ambilTeks(q.kendaraan)
    let awal
    if (POLA_UUID.test(idPelanggan) && POLA_UUID.test(idKendaraan)) {
        const hasil = await klienServer(token).detailPelanggan(idPelanggan)
        await arahkanBilaDitolak(hasil)
        const kendaraan = hasil.ok
            ? hasil.data.vehicles.find((k) => k.vehicleId === idKendaraan)
            : undefined
        if (hasil.ok && kendaraan) awal = { pelanggan: hasil.data, kendaraan }
    }
    return <LayarSpkBaru awal={awal} />
}
