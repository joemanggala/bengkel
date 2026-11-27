// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useFormStatus } from 'react-dom'
import Ikon from '@/components/ui/Ikon'
import { aksiKeluar } from '@/server/aksi/auth'

function IsiTombol({ className }: { className: string }) {
    const { pending } = useFormStatus()
    return (
        <button type="submit" disabled={pending} className={className}>
            <Ikon nama="keluar" className="h-5 w-5 shrink-0" />
            {pending ? 'Sedang keluar…' : 'Keluar'}
        </button>
    )
}

// Form biasa, sehingga tombol Keluar tetap bekerja walau JavaScript belum selesai dimuat.
export default function TombolKeluar({ className }: { className: string }) {
    return (
        <form action={aksiKeluar}>
            <IsiTombol className={className} />
        </form>
    )
}
