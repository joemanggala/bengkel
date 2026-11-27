// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Ref, SelectHTMLAttributes } from 'react'
import Ikon from './Ikon'
import { INPUT } from './gaya'

export type OpsiPilihan = { nilai: string; label: string; nonaktif?: boolean }

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
    opsi: readonly OpsiPilihan[]
    // Baris pertama tanpa nilai, mis. "Belum ditugaskan" atau "Pilih jasa".
    kosong?: string
    ref?: Ref<HTMLSelectElement>
}

// Pilihan dari daftar pendek (mekanik, jasa, metode bayar). Memakai <select> bawaan supaya di HP
// muncul pemilih bawaan sistem yang besar dan mudah diketuk, dengan kotak yang sama seperti
// isian lain. Pasangkan dengan <Field> dan atributField() untuk label dan galat.
export default function Pilihan({ opsi, kosong, className = '', ...sisa }: Props) {
    return (
        <div className="relative">
            <select {...sisa} className={`${INPUT} appearance-none pr-10 ${className}`}>
                {kosong !== undefined && <option value="">{kosong}</option>}
                {opsi.map((o) => (
                    <option key={o.nilai} value={o.nilai} disabled={o.nonaktif}>
                        {o.label}
                    </option>
                ))}
            </select>
            <Ikon
                nama="bawah"
                className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-redup"
            />
        </div>
    )
}
