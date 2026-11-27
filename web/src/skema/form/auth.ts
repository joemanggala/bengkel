// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'
import type { AturanField } from '@/utils/galat'
import { teksWajib } from './aturan'

// Batas nama, email, dan sandi mengikuti spec API (spec/components/schemas/staf.yaml): nama 2-100
// karakter, email ASCII maksimal 254, sandi 8-72 byte. Skema yang sama dipakai di browser
// (react-hook-form) dan diulang di server action, karena server action bisa dipanggil langsung
// tanpa melewati form.

export const POLA_EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/

export const ATURAN_MASUK = {
    email: { label: 'Email' },
    password: { label: 'Kata sandi' },
} satisfies Record<string, AturanField>

// Saat masuk cukup tidak kosong: akun yang emailnya tidak cocok pola tetap bisa dicoba, dan
// pesan untuk email yang tidak terdaftar sama dengan sandi salah (invalid_credentials).
export const skemaMasuk = z.object({
    email: teksWajib({ ...ATURAN_MASUK.email, dipangkas: true, kecilkanAscii: true }),
    // Sandi tidak dipangkas: spasi di awal atau akhir dianggap bagian dari sandi.
    password: teksWajib(ATURAN_MASUK.password),
})

export type IsianFormMasuk = z.input<typeof skemaMasuk>
export type KeluaranFormMasuk = z.output<typeof skemaMasuk>

export const ATURAN_SETUP = {
    token: {
        label: 'Token pemasangan',
        petunjukFormat: 'Salin persis dari SETUP_TOKEN di env backend.',
    },
    name: { label: 'Nama', min: 2, maks: 100 },
    email: {
        label: 'Email',
        maks: 254,
        petunjukFormat: 'Contoh: nama@contoh.id. Huruf beraksen seperti é belum bisa dipakai.',
    },
    password: { label: 'Kata sandi', min: 8, maks: 72, satuan: 'byte' },
    ulangiPassword: { label: 'Ulangi kata sandi' },
} satisfies Record<string, AturanField>

export const PESAN_SANDI_BEDA = 'Kata sandi yang diulang tidak sama.'

// Empat field milik API (SetupRequest). Server action memeriksa ulang dengan skema ini, karena
// yang dikirim browser sudah tanpa field ulangi sandi.
export const skemaSetupApi = z.object({
    // Token dibandingkan persis oleh backend, jadi tidak dipangkas.
    token: teksWajib(ATURAN_SETUP.token),
    name: teksWajib({ ...ATURAN_SETUP.name, dipangkas: true }),
    email: teksWajib({
        ...ATURAN_SETUP.email,
        dipangkas: true,
        kecilkanAscii: true,
        pola: POLA_EMAIL,
    }),
    password: teksWajib(ATURAN_SETUP.password),
})

// Akun pemilik pertama dibuat sekali dan belum ada fitur lupa sandi, jadi di browser sandi wajib
// diketik dua kali. Field ulangi hanya diperiksa di sini dan tidak ikut dikirim.
export const skemaSetup = skemaSetupApi
    .extend({ ulangiPassword: z.string({ error: 'Ulangi kata sandi wajib diisi.' }) })
    .superRefine((isian, ctx) => {
        if (isian.ulangiPassword === '') {
            ctx.addIssue({
                code: 'custom',
                path: ['ulangiPassword'],
                message: 'Ulangi kata sandi wajib diisi.',
            })
        } else if (isian.ulangiPassword !== isian.password) {
            ctx.addIssue({ code: 'custom', path: ['ulangiPassword'], message: PESAN_SANDI_BEDA })
        }
    })
    .transform(({ token, name, email, password }) => ({ token, name, email, password }))

export type IsianFormSetup = z.input<typeof skemaSetup>
export type KeluaranFormSetup = z.output<typeof skemaSetup>
