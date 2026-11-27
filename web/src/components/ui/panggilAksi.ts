// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

export const PESAN_AKSI_GAGAL =
    'Permintaan tidak sampai ke server. Periksa koneksi internet, lalu coba lagi.'

// redirect() di server action sampai ke browser sebagai galat ber-digest NEXT_REDIRECT. Galat ini
// harus dilempar ulang supaya router Next.js yang menangani perpindahan halamannya.
const galatPengalihan = (galat: unknown): boolean =>
    typeof galat === 'object' &&
    galat !== null &&
    'digest' in galat &&
    String((galat as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')

// Memanggil server action dari form; koneksi putus menjadi pesan, bukan layar galat.
export async function panggilAksi<T>(
    aksi: () => Promise<T>,
): Promise<T | { ok: false; pesan: string }> {
    try {
        return await aksi()
    } catch (galat) {
        if (galatPengalihan(galat)) throw galat
        return { ok: false, pesan: PESAN_AKSI_GAGAL }
    }
}

// Pesan per field dari server dipasang ke react-hook-form; field pertama ikut difokus.
export function pasangGalatField<T extends FieldValues>(
    setError: UseFormSetError<T>,
    fields: Record<string, string> | undefined,
): void {
    let pertama = true
    for (const [nama, pesan] of Object.entries(fields ?? {})) {
        setError(nama as Path<T>, { type: 'server', message: pesan }, { shouldFocus: pertama })
        pertama = false
    }
}
