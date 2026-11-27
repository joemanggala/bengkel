// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Ref, TextareaHTMLAttributes } from 'react'
import { TEXTAREA } from './gaya'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }

// Kotak isian banyak baris, mis. keluhan kendaraan atau alasan membatalkan SPK.
export default function Textarea({ className = '', rows = 3, ...sisa }: Props) {
    return <textarea rows={rows} className={`${TEXTAREA} ${className}`} {...sisa} />
}
