// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GalatApi } from '@/skema/galat'
import type { Meta } from '@/skema/meta'

// Bentuk umum hasil daftar: berpaginasi (dengan meta) atau tidak.
type HasilMuat<T> =
    { ok: true; data: T[]; meta?: Meta } | { ok: false; status: number; galat: GalatApi }

export type KeadaanDaftar<T> = {
    data: T[] | null
    meta: Meta | null
    galat: GalatApi | null
    memuat: boolean
    // Memuat ulang dengan parameter yang sama. `diam` = tanpa menandai memuat (polling).
    muatUlang: (diam?: boolean) => Promise<'ok' | 'gagal'>
}

// Memuat daftar dari API setiap kali `kunci` berubah (filter, cari, halaman, baris per halaman).
// Jawaban yang datang terlambat dari permintaan lama dibuang, supaya mengetik cepat di kotak cari
// tidak membuat hasil lama menimpa hasil baru. Data lama tetap tampil selama memuat, jadi tabel
// tidak berkedip kosong.
export function useDaftar<T>(muat: () => Promise<HasilMuat<T>>, kunci: string): KeadaanDaftar<T> {
    const [data, setData] = useState<T[] | null>(null)
    const [meta, setMeta] = useState<Meta | null>(null)
    const [galat, setGalat] = useState<GalatApi | null>(null)
    const [memuat, setMemuat] = useState(true)
    const urutan = useRef(0)
    const terbaru = useRef(muat)
    useEffect(() => {
        terbaru.current = muat
    })

    const muatUlang = useCallback(async (diam = false): Promise<'ok' | 'gagal'> => {
        const nomor = ++urutan.current
        if (!diam) setMemuat(true)
        const hasil = await terbaru.current()
        if (nomor !== urutan.current) return 'ok'
        setMemuat(false)
        if (hasil.ok) {
            setData(hasil.data)
            setMeta(hasil.meta ?? null)
            setGalat(null)
            return 'ok'
        }
        // Gagal saat polling diam-diam: data lama tetap tampil, galat ditampilkan di atasnya.
        setGalat(hasil.galat)
        return 'gagal'
    }, [])

    useEffect(() => {
        void muatUlang()
    }, [kunci, muatUlang])

    return { data, meta, galat, memuat, muatUlang }
}
