// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import Link from 'next/link'
import KeadaanKosong from '@/components/ui/KeadaanKosong'
import { TOMBOL_SEKUNDER } from '@/components/ui/gaya'

type Props = { jenis: 'booking' | 'servis' }

// Tautan status booking atau lacak servis yang tidak dikenal backend (404): salah salin, terpotong,
// atau tautan lacak lama yang sudah dibuat ulang kasir. Pelanggan diberi penjelasan dan jalan
// keluar, bukan layar kosong.
export default function TokenTidakBerlaku({ jenis }: Props) {
    return (
        <KeadaanKosong
            ikon="peringatan"
            judul={jenis === 'booking' ? 'Booking tidak ditemukan' : 'Tautan lacak tidak berlaku'}
            aksi={
                <Link href="/" className={TOMBOL_SEKUNDER}>
                    Ke halaman depan
                </Link>
            }
        >
            {jenis === 'booking'
                ? 'Tautan booking ini tidak dikenal. Pastikan tautannya tersalin utuh. Kalau kamu baru saja booking dari HP ini, bukalah lewat daftar "Booking kamu" di halaman depan.'
                : 'Tautan ini salah, terpotong, atau sudah diganti bengkel. Minta tautan lacak terbaru lewat WhatsApp bengkel.'}
        </KeadaanKosong>
    )
}
