// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { NextRequest } from 'next/server'
import { teruskanStaf } from '@/server/bff'

type Konteks = { params: Promise<{ jalur: string[] }> }

// Semua panggilan API staf dari komponen klien lewat sini (cookie sesi_staf ditambahkan sebagai
// Authorization: Bearer). Rinciannya di src/server/bff.ts.
async function tangani(req: NextRequest, { params }: Konteks): Promise<Response> {
    const { jalur } = await params
    return teruskanStaf(req, jalur)
}

export { tangani as GET, tangani as POST, tangani as PUT, tangani as PATCH, tangani as DELETE }
