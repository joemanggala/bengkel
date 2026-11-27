// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'
import Ikon from './Ikon'
import { LABEL } from './gaya'

type Props = {
    id: string
    label: string
    galat?: string
    petunjuk?: ReactNode
    // Konten di sisi kanan label, mis. penghitung karakter atau tanda "opsional".
    samping?: ReactNode
    children: ReactNode
}

// Atribut aksesibilitas untuk input di dalam Field: pembaca layar membacakan petunjuk dan galat
// saat input difokus.
export const atributField = (id: string, galat?: string, adaPetunjuk = false) => {
    const keterangan = [adaPetunjuk ? `${id}-petunjuk` : '', galat ? `${id}-galat` : '']
        .filter(Boolean)
        .join(' ')
    return {
        id,
        'aria-invalid': galat ? true : undefined,
        'aria-describedby': keterangan || undefined,
    }
}

export default function Field({ id, label, galat, petunjuk, samping, children }: Props) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={id} className={LABEL}>
                    {label}
                </label>
                {samping}
            </div>
            {children}
            {petunjuk && (
                <p id={`${id}-petunjuk`} className="mt-2 text-sm leading-relaxed text-redup">
                    {petunjuk}
                </p>
            )}
            {galat && (
                // Ikon ikut menandai galat, supaya tidak hanya warna merah yang membedakannya.
                <p
                    id={`${id}-galat`}
                    className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-bahaya-tua"
                >
                    <Ikon nama="galat" className="mt-px h-4 w-4 shrink-0" />
                    <span>{galat}</span>
                </p>
            )}
        </div>
    )
}
