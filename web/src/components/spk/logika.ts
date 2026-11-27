// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { pangkas } from '@/skema/form/aturan'
import type { AturanField } from '@/utils/galat'
import { pesanKodeField } from '@/utils/galat'
import { formatRupiah } from '@/utils/format'
import { periksaBilangan, periksaTeks, saringGalat, waktuLokalKeApi } from '@/utils/validasi'

// Aturan form data SPK (BuatSpkRequest, UbahSpkRequest, JadikanSpkRequest) dari spec.

export type IsianDataSpk = {
    complaint: string
    odometer: string
    estimatedDoneAt: string
    mechanicId: string
}

export const ATURAN_DATA_SPK = {
    vehicleId: { label: 'Kendaraan', pilihan: true },
    complaint: { label: 'Keluhan', maks: 1000 },
    odometer: { label: 'Odometer', min: 0, maks: 9_999_999, jenis: 'angka kilometer' },
    estimatedDoneAt: { label: 'Perkiraan selesai', petunjukFormat: 'Pilih tanggal dan jam.' },
    mechanicId: { label: 'Mekanik', pilihan: true },
    diagnosis: { label: 'Diagnosis', maks: 2000 },
} satisfies Record<string, AturanField>

type BadanDataSpk = {
    complaint: string
    odometer: number | null
    estimatedDoneAt: string | null
    mechanicId: string | null
}

// `tanpaKeluhan` untuk menjadikan booking SPK: keluhan disalin backend dari booking.
export function periksaDataSpk(
    isian: IsianDataSpk,
    tanpaKeluhan = false,
): { ok: true; badan: BadanDataSpk } | { ok: false; fields: Record<string, string> } {
    const a = ATURAN_DATA_SPK
    const odometer = periksaBilangan(isian.odometer, { ...a.odometer, opsional: true })
    const estimasi = isian.estimatedDoneAt === '' ? null : waktuLokalKeApi(isian.estimatedDoneAt)
    const fields = saringGalat({
        complaint: tanpaKeluhan ? null : periksaTeks(isian.complaint, { ...a.complaint, min: 1 }),
        odometer: odometer.ok ? null : odometer.pesan,
        estimatedDoneAt:
            isian.estimatedDoneAt !== '' && estimasi === null
                ? pesanKodeField('invalid_format', a.estimatedDoneAt)
                : null,
    })
    if (Object.keys(fields).length > 0 || !odometer.ok) return { ok: false, fields }
    return {
        ok: true,
        badan: {
            complaint: pangkas(isian.complaint),
            odometer: odometer.nilai,
            estimatedDoneAt: estimasi,
            mechanicId: isian.mechanicId === '' ? null : isian.mechanicId,
        },
    }
}

// Item SPK: jumlah 1..99, harga jasa boleh diganti 0..100.000.000.
export const ATURAN_ITEM = {
    type: { label: 'Jenis item', pilihan: true },
    serviceId: { label: 'Jasa', pilihan: true },
    partId: { label: 'Sparepart', pilihan: true },
    quantity: { label: 'Jumlah', min: 1, maks: 99, jenis: 'angka bulat' },
    price: {
        label: 'Harga',
        min: 0,
        maks: 100_000_000,
        jenis: 'angka rupiah',
        formatNilai: formatRupiah,
    },
    items: { label: 'Item', maks: 50 },
} satisfies Record<string, AturanField>

export const ATURAN_BAYAR = {
    amount: { label: 'Jumlah bayar', min: 1, jenis: 'angka rupiah', formatNilai: formatRupiah },
    method: { label: 'Metode bayar', pilihan: true },
} satisfies Record<string, AturanField>
