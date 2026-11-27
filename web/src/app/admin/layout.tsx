// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Panel staf (pemilik, kasir, mekanik): tidak untuk mesin pencari.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

export default function LayoutAdmin({ children }: { children: ReactNode }) {
    return children
}
