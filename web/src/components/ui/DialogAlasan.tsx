// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState, type ReactNode } from 'react'
import { periksaTeks } from '@/utils/validasi'
import Dialog from './Dialog'
import Field, { atributField } from './Field'
import KotakPesan from './KotakPesan'
import Textarea from './Textarea'
import Tombol from './Tombol'

type Props = {
    judul: string
    deskripsi: ReactNode
    labelAlasan: string
    labelKirim: string
    // Contoh kalimat di kotak alasan.
    contoh?: string
    // Mengembalikan null bila berhasil (pemanggil menutup dialog), atau kalimat galat.
    onKirim: (alasan: string) => Promise<string | null>
    onTutup: () => void
}

// Dialog meminta alasan untuk aksi yang dibaca pelanggan: membatalkan SPK (alasan tampil di halaman
// lacak) dan menolak booking (alasan dikirim lewat WhatsApp). Aturan panjangnya dari spec:
// 3 sampai 500 karakter.
export default function DialogAlasan({
    judul,
    deskripsi,
    labelAlasan,
    labelKirim,
    contoh,
    onKirim,
    onTutup,
}: Props) {
    const [alasan, setAlasan] = useState('')
    const [galat, setGalat] = useState<string | null>(null)
    const [pesan, setPesan] = useState<string | null>(null)
    const [sibuk, setSibuk] = useState(false)

    const kirim = async () => {
        const cek = periksaTeks(alasan, { label: labelAlasan, min: 3, maks: 500 })
        setGalat(cek)
        if (cek) return
        setSibuk(true)
        setPesan(await onKirim(alasan.trim()))
        setSibuk(false)
    }

    return (
        <Dialog terbuka judul={judul} deskripsi={deskripsi} sibuk={sibuk} onTutup={onTutup}>
            <form
                noValidate
                onSubmit={(e) => {
                    e.preventDefault()
                    void kirim()
                }}
                className="space-y-5"
            >
                {pesan && <KotakPesan jenis="galat">{pesan}</KotakPesan>}
                <Field id="dialog-alasan" label={labelAlasan} galat={galat ?? undefined}>
                    <Textarea
                        {...atributField('dialog-alasan', galat ?? undefined)}
                        value={alasan}
                        onChange={(e) => {
                            setAlasan(e.target.value)
                            setGalat(null)
                        }}
                        placeholder={contoh}
                        disabled={sibuk}
                    />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Tombol varian="sekunder" onClick={onTutup} disabled={sibuk}>
                        Kembali
                    </Tombol>
                    <Tombol varian="bahaya" type="submit" sibuk={sibuk}>
                        {labelKirim}
                    </Tombol>
                </div>
            </form>
        </Dialog>
    )
}
