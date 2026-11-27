// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Field, { atributField } from '@/components/ui/Field'
import InputSandi from '@/components/ui/InputSandi'
import KotakPesan from '@/components/ui/KotakPesan'
import { INPUT, TOMBOL_PRIMER } from '@/components/ui/gaya'
import { panggilAksi, pasangGalatField } from '@/components/ui/panggilAksi'
import { useTerhidrasi } from '@/components/ui/useTerhidrasi'
import { PESAN_COOKIE_DITOLAK, sesiTersimpan } from '@/klien/peramban'
import { skemaMasuk, type IsianFormMasuk, type KeluaranFormMasuk } from '@/skema/form/auth'
import { aksiMasuk } from '@/server/aksi/auth'

type Props = {
    ke?: string
    pesanAwal?: string
}

export default function FormMasuk({ ke, pesanAwal }: Props) {
    const terhidrasi = useTerhidrasi()
    const [pesan, setPesan] = useState<string | null>(null)
    const [berpindah, setBerpindah] = useState(false)
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<IsianFormMasuk, unknown, KeluaranFormMasuk>({
        resolver: zodResolver(skemaMasuk),
        defaultValues: { email: '', password: '' },
    })

    const kirim = async (isian: KeluaranFormMasuk) => {
        setPesan(null)
        const hasil = await panggilAksi(() => aksiMasuk(isian, ke))
        if (hasil.ok) {
            // Pastikan browser menyimpan cookie sesi sebelum pindah; bila ditolak, halaman tujuan
            // akan memantulkan kembali ke halaman masuk dan tombol tampak macet.
            if ((await sesiTersimpan()) === false) {
                setPesan(PESAN_COOKIE_DITOLAK)
                return
            }
            setBerpindah(true)
            // Muat penuh, bukan router.replace: server action yang memasang cookie juga menyegarkan
            // halaman ini di server (yang lalu ikut mengalihkan staf yang sudah masuk), dan dua
            // navigasi bersamaan kadang berakhir kembali di halaman ini. replace(): tombol Kembali
            // setelah masuk tidak membuka form ini lagi.
            window.location.replace(hasil.data.tujuan)
            return
        }
        setPesan(hasil.pesan ?? null)
        if ('fields' in hasil) pasangGalatField(setError, hasil.fields)
    }

    // Tombol tetap terkunci setelah berhasil sampai halaman tujuan selesai dimuat.
    const sibuk = isSubmitting || berpindah

    return (
        <form method="post" noValidate onSubmit={handleSubmit(kirim)} className="space-y-5">
            {/* Isian dikunci sampai JavaScript siap: ketikan sebelum hidrasi akan ditimpa nilai awal
                react-hook-form, dan form belum bisa dikirim dengan aman. */}
            <fieldset disabled={!terhidrasi} className="min-w-0 space-y-5">
                {pesan ? (
                    <KotakPesan jenis="galat">{pesan}</KotakPesan>
                ) : (
                    pesanAwal && <KotakPesan jenis="info">{pesanAwal}</KotakPesan>
                )}
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
                <Field id="password" label="Kata sandi" galat={errors.password?.message}>
                    <InputSandi
                        {...register('password')}
                        {...atributField('password', errors.password?.message)}
                        autoComplete="current-password"
                    />
                </Field>
                <button
                    type="submit"
                    disabled={sibuk || !terhidrasi}
                    className={`${TOMBOL_PRIMER} w-full`}
                >
                    {sibuk ? 'Sedang masuk…' : 'Masuk'}
                </button>
            </fieldset>
        </form>
    )
}
