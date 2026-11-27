// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { GalatApi } from '@/skema/galat'
import type { Meta } from '@/skema/meta'
import { bacaGalatApi } from '@/utils/galat'
import type { HasilApi } from './hasil'

// Dipakai bersama oleh pengangkut server (src/server/pengangkut.ts, langsung ke backend) dan
// pengangkut browser (src/klien/peramban.ts, lewat /bff). BFF meneruskan badan balasan backend
// apa adanya, jadi keduanya membaca amplop yang sama.

export const GALAT_TAK_TERHUBUNG: GalatApi = {
    code: 'internal_error',
    message: 'Server tidak bisa dihubungi. Periksa koneksi, lalu coba lagi.',
}

// Balasan sukses yang bentuknya menyimpang dari kontrak spec.
export const GALAT_KONTRAK: GalatApi = {
    code: 'internal_error',
    message: 'Balasan server tidak sesuai kontrak API. Pastikan versi web dan backend cocok.',
}

// Spec memakai Retry-After berupa jumlah detik (bilangan bulat), bukan tanggal HTTP.
export const bacaRetryAfter = (nilai: string | null): number | undefined => {
    if (!nilai || !/^[0-9]+$/.test(nilai.trim())) return undefined
    return Number(nilai.trim())
}

// Membaca balasan HTTP menjadi HasilApi. `data` sengaja unknown: bentuknya baru diperiksa oleh
// klien bertipe (src/klien/buatKlien.ts) terhadap skema zod.
export async function bacaBalasanApi(balasan: Response): Promise<HasilApi<unknown>> {
    if (balasan.status === 204) return { ok: true, status: 204, data: undefined }
    const isi: unknown = await balasan.json().catch(() => null)
    if (!balasan.ok) {
        const retryAfter = bacaRetryAfter(balasan.headers.get('Retry-After'))
        return {
            ok: false,
            status: balasan.status,
            galat: bacaGalatApi(isi),
            ...(retryAfter === undefined ? {} : { retryAfter }),
        }
    }
    const amplop = (isi ?? {}) as { data?: unknown; meta?: Meta }
    return {
        ok: true,
        status: balasan.status,
        data: amplop.data,
        ...(amplop.meta ? { meta: amplop.meta } : {}),
    }
}
