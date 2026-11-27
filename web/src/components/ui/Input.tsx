// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { InputHTMLAttributes, Ref } from 'react'
import { INPUT } from './gaya'

type Props = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }

// Kotak isian satu baris. Pasangkan dengan <Field> untuk label, petunjuk, dan pesan galat; atribut
// aksesibilitasnya (id, aria-invalid, aria-describedby) dari atributField().
export default function Input({ className = '', ...sisa }: Props) {
    return <input className={`${INPUT} ${className}`} {...sisa} />
}
