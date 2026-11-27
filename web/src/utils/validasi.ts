// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { kodeGalatTeks, pangkas, type OpsiTeks } from '@/skema/form/aturan'
import { pesanKodeField, type AturanField } from './galat'
import { normalkanNomorHp } from './nomorHp'
import { normalkanPlat } from './plat'

// Pemeriksa isian form panel dan website. Setiap fungsi mengembalikan kalimat galat (sama dengan
// kalimat saat API menolak, lewat pesanKodeField) atau null bila sah. Aturannya menyalin spec
// supaya galat terlihat sebelum dikirim; backend tetap pemeriksa akhirnya.

export type GalatIsian = Record<string, string>

// Teks wajib atau opsional. Opsional yang kosong selalu sah; yang terisi tetap dibatasi panjang.
export function periksaTeks(nilai: string, opsi: OpsiTeks & { opsional?: boolean }): string | null {
    const dirapikan = opsi.dipangkas === false ? nilai : pangkas(nilai)
    if (opsi.opsional && dirapikan === '') return null
    const kode = kodeGalatTeks(nilai, { dipangkas: true, ...opsi })
    return kode ? pesanKodeField(kode, opsi) : null
}

export const periksaNomorHp = (nilai: string, aturan: AturanField): string | null => {
    const hasil = normalkanNomorHp(nilai)
    return hasil.ok ? null : pesanKodeField(hasil.kode, aturan)
}

export const periksaPlat = (nilai: string, aturan: AturanField): string | null => {
    const hasil = normalkanPlat(nilai)
    return hasil.ok ? null : pesanKodeField(hasil.kode, aturan)
}

// Bilangan bulat dari isian teks. Titik ribuan dan spasi dibuang ("15.000" -> 15000), jadi isian
// rupiah dan isian angka biasa diurai dengan cara yang sama. null = kosong, NaN = bukan angka.
export function bacaBilangan(teks: string): number | null {
    const bersih = teks.replace(/[.\s]/g, '')
    if (bersih === '') return null
    if (!/^-?[0-9]{1,15}$/.test(bersih)) return Number.NaN
    return Number(bersih)
}

export type AturanBilangan = AturanField & { min: number; maks: number; opsional?: boolean }

// Hasil pemeriksaan bilangan: nilainya (null bila opsional dan kosong) atau kalimat galat.
export function periksaBilangan(
    teks: string,
    aturan: AturanBilangan,
): { ok: true; nilai: number | null } | { ok: false; pesan: string } {
    const nilai = bacaBilangan(teks)
    if (nilai === null) {
        return aturan.opsional
            ? { ok: true, nilai: null }
            : { ok: false, pesan: pesanKodeField('required', aturan) }
    }
    if (Number.isNaN(nilai)) {
        return {
            ok: false,
            pesan: pesanKodeField('invalid_type', { jenis: 'angka bulat', ...aturan }),
        }
    }
    if (nilai < aturan.min || nilai > aturan.maks) {
        return { ok: false, pesan: pesanKodeField('out_of_range', aturan) }
    }
    return { ok: true, nilai }
}

// Isian waktu <input type="datetime-local"> dibaca sebagai jam WIB, lalu dikirim sebagai RFC 3339
// dengan zona +07:00 (spec: WaktuMasukan). Bengkel ada di WIB; jam di perangkat kasir yang zonanya
// salah tidak ikut menggeser estimasi.
export function waktuLokalKeApi(isian: string): string | null {
    const cocok = /^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}:[0-9]{2})$/.exec(isian)
    return cocok ? `${cocok[1]}T${cocok[2]}:00+07:00` : null
}

// Kebalikannya: waktu UTC dari API menjadi nilai <input type="datetime-local"> dalam WIB.
export function waktuApiKeLokal(iso: string | null): string {
    if (!iso) return ''
    const waktu = new Date(iso)
    if (Number.isNaN(waktu.getTime())) return ''
    return new Date(waktu.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

// Galat pertama menurut urutan kolom di layar, untuk memindahkan fokus ke sana.
export const adaGalat = (galat: GalatIsian): boolean => Object.keys(galat).length > 0

// Membuang kunci yang nilainya null, supaya hasil periksa bisa ditulis sebagai satu objek.
export const saringGalat = (galat: Record<string, string | null>): GalatIsian =>
    Object.fromEntries(Object.entries(galat).filter((e): e is [string, string] => e[1] !== null))
