// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import Link from 'next/link'
import { LencanaBayar, LencanaStatusSpk } from '@/components/ui/Lencana'
import type { SpkRingkas } from '@/skema/spk'
import { formatKendaraan, formatRupiah, formatWaktu } from '@/utils/format'

type Props = {
    spk: SpkRingkas
    // Di kolom papan statusnya sudah terbaca dari judul kolom.
    tampilStatus?: boolean
    // Mekanik tidak mengurus uang, jadi total dan lencana bayar disembunyikan untuknya.
    tampilUang?: boolean
}

// Satu SPK di papan servis: nomor, kendaraan, pelanggan, keluhan singkat, mekanik, dan (untuk
// kasir) total serta status bayar. Seluruh kartu adalah tautan ke rincian SPK.
export default function KartuSpk({ spk, tampilStatus, tampilUang = true }: Props) {
    return (
        <Link
            href={`/admin/spk/${spk.number}`}
            className="block rounded-xl border border-garis bg-permukaan p-4 transition-colors hover:border-utama"
        >
            <div className="flex items-start justify-between gap-2">
                <span className="font-bold">{spk.number}</span>
                {tampilStatus && <LencanaStatusSpk status={spk.status} />}
            </div>
            <p className="mt-1 font-semibold leading-snug">{formatKendaraan(spk.vehicle)}</p>
            <p className="text-sm text-redup">{spk.customer.name}</p>
            <p className="mt-2 line-clamp-2 text-[15px] leading-snug">{spk.complaint}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-redup">
                <span>{spk.mechanic ? spk.mechanic.name : 'Belum ada mekanik'}</span>
                <span aria-hidden="true">·</span>
                <span>{formatWaktu(spk.createdAt)}</span>
            </div>
            {tampilUang && spk.itemCount > 0 && (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-garis pt-3">
                    <span className="angka font-semibold">{formatRupiah(spk.total)}</span>
                    <LencanaBayar status={spk.paymentStatus} />
                </div>
            )}
        </Link>
    )
}
