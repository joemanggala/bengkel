// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useCallback, useState, type ReactNode } from 'react'
import type { HasilApi } from '@/klien/hasil'
import { PESAN_TIDAK_PASTI, hasilTidakPasti } from '@/klien/peramban'
import { petakanGalatForm, type AturanField, type PesanKhusus } from '@/utils/galat'
import Dialog from './Dialog'
import { fokusKolomGalat } from './fokusGalat'
import KotakPesan from './KotakPesan'
import Tombol from './Tombol'

// Keadaan isian form: nilai, galat per kolom, dan pesan untuk seluruh form. Mengubah satu kolom
// menghapus galat kolom itu saja.
export function useIsian<T extends Record<string, unknown>>(awal: T | (() => T)) {
    const [isian, setIsian] = useState<T>(awal)
    const [galat, setGalat] = useState<Record<string, string>>({})
    const [pesan, setPesan] = useState<string | null>(null)
    const ubah = useCallback(<K extends keyof T>(kunci: K, nilai: T[K]) => {
        setIsian((lama) => ({ ...lama, [kunci]: nilai }))
        setGalat((lama) => {
            if (!(kunci in lama)) return lama
            const sisa = { ...lama }
            delete sisa[kunci as string]
            return sisa
        })
    }, [])
    return { isian, setIsian, ubah, galat, setGalat, pesan, setPesan }
}

type Periksa<B> = { ok: true; badan: B } | { ok: false; fields: Record<string, string> }

type OpsiKirim<B, T> = {
    periksa: () => Periksa<B>
    kirim: (badan: B) => Promise<HasilApi<T>>
    aturan: Record<string, AturanField>
    // Kode galat yang ditempel ke kolom tertentu, mis. phone_taken ke kolom nomor HP.
    khusus?: PesanKhusus
    // Urutan kolom di layar dan id elemennya, untuk memindahkan fokus ke galat pertama.
    urutan: readonly string[]
    idKolom: (nama: string) => string
    berhasil: (data: T) => void
}

// Alur kirim form yang sama untuk semua dialog: periksa di browser, kirim, lalu galat dari API
// dipetakan ke kolomnya (petakanGalatForm) atau ke pesan form. Hasil yang tidak pasti (koneksi
// putus di tengah) dijelaskan supaya data tidak tercatat dua kali.
export function useKirimForm(
    setGalat: (g: Record<string, string>) => void,
    setPesan: (p: string | null) => void,
) {
    const [sibuk, setSibuk] = useState(false)
    const kirim = async <B, T>(o: OpsiKirim<B, T>) => {
        setPesan(null)
        const cek = o.periksa()
        if (!cek.ok) {
            setGalat(cek.fields)
            fokusKolomGalat(o.urutan, cek.fields, o.idKolom)
            return
        }
        setGalat({})
        setSibuk(true)
        const hasil = await o.kirim(cek.badan)
        setSibuk(false)
        if (hasil.ok) {
            o.berhasil(hasil.data)
            return
        }
        if (hasilTidakPasti(hasil)) {
            setPesan(PESAN_TIDAK_PASTI)
            return
        }
        const peta = petakanGalatForm(hasil.galat, o.aturan, o.khusus)
        setGalat(peta.fields ?? {})
        setPesan(peta.pesan ?? null)
        fokusKolomGalat(o.urutan, peta.fields ?? {}, o.idKolom)
    }
    return { sibuk, kirim }
}

type Props = {
    judul: string
    deskripsi?: ReactNode
    labelKirim: string
    sibuk: boolean
    pesan: string | null
    lebar?: boolean
    onKirim: () => void
    onTutup: () => void
    children: ReactNode
}

// Dialog berisi form dengan tombol Batal dan kirim di bawah. Isi kolomnya dari pemanggil.
export default function DialogForm({
    judul,
    deskripsi,
    labelKirim,
    sibuk,
    pesan,
    lebar,
    onKirim,
    onTutup,
    children,
}: Props) {
    return (
        <Dialog
            terbuka
            judul={judul}
            deskripsi={deskripsi}
            sibuk={sibuk}
            lebar={lebar}
            onTutup={onTutup}
        >
            <form
                noValidate
                onSubmit={(e) => {
                    e.preventDefault()
                    onKirim()
                }}
                className="space-y-5"
            >
                {pesan && <KotakPesan jenis="galat">{pesan}</KotakPesan>}
                <fieldset disabled={sibuk} className="min-w-0 space-y-5">
                    {children}
                </fieldset>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Tombol varian="sekunder" onClick={onTutup} disabled={sibuk}>
                        Batal
                    </Tombol>
                    <Tombol type="submit" sibuk={sibuk}>
                        {labelKirim}
                    </Tombol>
                </div>
            </form>
        </Dialog>
    )
}
