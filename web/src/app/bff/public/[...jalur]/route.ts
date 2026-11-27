// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { NextRequest } from 'next/server'
import { teruskanPublik } from '@/server/bff'

type Konteks = { params: Promise<{ jalur: string[] }> }

// Panggilan API website publik dari browser (jasa, booking, status booking, lacak servis) lewat
// sini. Tidak membaca atau mengirim cookie, dan hanya meneruskan ke /api/public/*. Rinciannya di
// src/server/bff.ts.
async function tangani(req: NextRequest, { params }: Konteks): Promise<Response> {
    const { jalur } = await params
    return teruskanPublik(req, jalur)
}

export { tangani as GET, tangani as POST }
