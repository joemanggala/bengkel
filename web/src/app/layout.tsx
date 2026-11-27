// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

// Judul netral; nama bengkel dipasang halaman depan dari profil outlet (generateMetadata).
// Berbeda dengan panel staf, halaman depan website boleh dibaca mesin pencari; panel staf dan
// halaman bertoken (status booking, lacak servis) memasang noindex sendiri.
export const metadata: Metadata = {
    title: { default: 'Bengkel', template: '%s | Bengkel' },
    description: 'Servis motor dan mobil: booking online dan lacak status servis.',
}

export const viewport: Viewport = {
    themeColor: '#ffffff',
    colorScheme: 'light',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="id">
            <body className="min-h-screen antialiased">{children}</body>
        </html>
    )
}
