// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Field, { atributField } from '@/components/ui/Field'
import InputSandi from '@/components/ui/InputSandi'
import KotakPesan from '@/components/ui/KotakPesan'
import { INPUT, TOMBOL_PRIMER, TOMBOL_SEKUNDER } from '@/components/ui/gaya'
import { panggilAksi, pasangGalatField } from '@/components/ui/panggilAksi'
import { useTerhidrasi } from '@/components/ui/useTerhidrasi'
import { PESAN_COOKIE_DITOLAK, sesiTersimpan } from '@/klien/peramban'
import { skemaSetup, type IsianFormSetup, type KeluaranFormSetup } from '@/skema/form/auth'
import { aksiSetup } from '@/server/aksi/auth'
import { PATH_MASUK } from '@/utils/sesi'

export default function FormSetup() {
    const terhidrasi = useTerhidrasi()
    const [pesan, setPesan] = useState<string | null>(null)
    const [sudahDipasang, setSudahDipasang] = useState(false)
    const [berpindah, setBerpindah] = useState(false)
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<IsianFormSetup, unknown, KeluaranFormSetup>({
        resolver: zodResolver(skemaSetup),
        defaultValues: { token: '', name: '', email: '', password: '', ulangiPassword: '' },
    })

    const kirim = async (isian: KeluaranFormSetup) => {
        setPesan(null)
        // Field ulangi sandi sudah diperiksa skema; yang dikirim cukup empat field milik API.
        const hasil = await panggilAksi(() => aksiSetup(isian))
        if (hasil.ok) {
            // Pastikan browser menyimpan cookie sesi sebelum pindah (lihat FormMasuk).
            if ((await sesiTersimpan()) === false) {
                // Akun pemilik sudah tersimpan; setelah alamatnya dibetulkan, cukup masuk biasa.
                setPesan(
                    PESAN_COOKIE_DITOLAK.replace(
                        'Email dan sandi benar',
                        'Akun pemilik sudah dibuat',
                    ),
                )
                return
            }
            setBerpindah(true)
            window.location.replace(hasil.data.tujuan)
            return
        }
        if ('sudahDipasang' in hasil) {
            setSudahDipasang(true)
            return
        }
        setPesan(hasil.pesan ?? null)
        if ('fields' in hasil) pasangGalatField(setError, hasil.fields)
    }

    if (sudahDipasang) {
        return (
            <KotakPesan
                jenis="info"
                judul="Aplikasi sudah dipasang"
                aksi={
                    <Link href={PATH_MASUK} className={TOMBOL_SEKUNDER}>
                        Ke halaman masuk
                    </Link>
                }
            >
                Akun pemilik sudah ada. Masuk dengan akun itu, atau minta pemilik membuatkan akun
                kasir atau mekanik.
            </KotakPesan>
        )
    }

    const sibuk = isSubmitting || berpindah

    return (
        <form method="post" noValidate onSubmit={handleSubmit(kirim)} className="space-y-5">
            {/* Isian dikunci sampai JavaScript siap: ketikan sebelum hidrasi akan ditimpa nilai awal
                react-hook-form, dan form belum bisa dikirim dengan aman. */}
            <fieldset disabled={!terhidrasi} className="min-w-0 space-y-5">
                {pesan && <KotakPesan jenis="galat">{pesan}</KotakPesan>}
                <Field
                    id="token"
                    label="Token pemasangan"
                    galat={errors.token?.message}
                    petunjuk="Isi SETUP_TOKEN di env backend. Token ini mencegah orang lain mengambil alih server yang baru dipasang."
                >
                    <InputSandi
                        {...register('token')}
                        {...atributField('token', errors.token?.message, true)}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                    />
                </Field>
                <Field id="name" label="Nama pemilik" galat={errors.name?.message}>
                    <input
                        {...register('name')}
                        {...atributField('name', errors.name?.message)}
                        type="text"
                        autoComplete="name"
                        className={INPUT}
                    />
                </Field>
                <Field id="email" label="Email" galat={errors.email?.message}>
                    <input
                        {...register('email')}
                        {...atributField('email', errors.email?.message)}
                        type="email"
                        autoComplete="username"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="nama@contoh.id"
                        className={INPUT}
                    />
                </Field>
                <Field
                    id="password"
                    label="Kata sandi"
                    galat={errors.password?.message}
                    petunjuk="Minimal 8 karakter. Simpan baik-baik: belum ada fitur lupa sandi."
                >
                    <InputSandi
                        {...register('password')}
                        {...atributField('password', errors.password?.message, true)}
                        autoComplete="new-password"
                    />
                </Field>
                <Field
                    id="ulangiPassword"
                    label="Ulangi kata sandi"
                    galat={errors.ulangiPassword?.message}
                >
                    <InputSandi
                        {...register('ulangiPassword')}
                        {...atributField('ulangiPassword', errors.ulangiPassword?.message)}
                        autoComplete="new-password"
                    />
                </Field>
                <button
                    type="submit"
                    disabled={sibuk || !terhidrasi}
                    className={`${TOMBOL_PRIMER} w-full`}
                >
                    {sibuk ? 'Sedang memasang…' : 'Buat akun pemilik'}
                </button>
            </fieldset>
        </form>
    )
}
