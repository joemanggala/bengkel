// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { NextResponse, type NextRequest } from 'next/server'
import { GALAT_TAK_TERHUBUNG } from '@/klien/balasan'
import { BATAS_WAKTU_MS, GALAT_TANPA_API_URL, alamatApi } from '@/server/api'
import type { GalatApi } from '@/skema/galat'
import { NAMA_COOKIE_SESI } from '@/utils/sesi'

// BFF (backend for frontend): komponen klien memanggil route handler di bawah /bff, lalu
// handler meneruskannya ke {API_URL}/api/... Browser tidak pernah memegang token maupun alamat
// backend. Ada dua pintu yang sengaja dipisah:
//
//   /bff/staf/<rute>   -> /api/<rute>        membawa token dari cookie httpOnly sebagai
//                                            Authorization: Bearer; hanya untuk staf.
//   /bff/public/<rute> -> /api/public/<rute> TIDAK membaca cookie dan TIDAK mengirim
//                                            Authorization; hanya rute website publik
//                                            (jasa, booking, lacak servis).
//
// Pemisahan ini menjaga dua hal: halaman publik tidak bisa menyentuh data staf walau pengunjungnya
// kebetulan juga masuk sebagai staf di browser yang sama, dan token staf tidak bocor ke rute
// publik. Profil outlet (GET /api/outlet, juga publik) dibaca server component tanpa token, jadi
// tidak perlu lewat pintu ini. Proxy ini tidak tahu bentuk data apa pun: badan dan status dari
// backend diteruskan apa adanya, sehingga klien membaca amplop yang sama ({data, meta} atau
// {error}).

// Kelompok rute staf dari spec yang boleh dipanggil dari browser. Sengaja TIDAK ada: `setup`
// (lewat server action), `public` (pintunya lain), `health`. Peran tiap rute diperiksa backend.
const AWALAN_STAF = new Set([
    'staff',
    'mechanics',
    'outlet',
    'customers',
    'vehicles',
    'services',
    'parts',
    'bookings',
    'work-orders',
    'reports',
])

// Masuk dan keluar tidak boleh lewat sini: balasan masuk berisi token sesi, yang tidak boleh
// sampai ke JavaScript browser. Keduanya lewat server action yang memasang/menghapus cookie.
const DITOLAK_STAF = new Set(['staff/login', 'staff/logout'])

// Satu-satunya yang boleh dipanggil dari pintu publik. Daftar putih persis (metode + bentuk path),
// bukan sekadar awalan, supaya rute publik baru di backend tidak ikut terbuka tanpa disengaja.
// Token booking dan token lacak selalu 43 karakter base64url.
const TOKEN = '[A-Za-z0-9_-]{43}'
const RUTE_PUBLIK: readonly { metode: string; pola: RegExp }[] = [
    { metode: 'GET', pola: /^services$/ },
    { metode: 'POST', pola: /^bookings$/ },
    { metode: 'GET', pola: new RegExp(`^bookings/${TOKEN}$`) },
    { metode: 'POST', pola: new RegExp(`^bookings/${TOKEN}/cancel$`) },
    { metode: 'GET', pola: new RegExp(`^work-orders/${TOKEN}$`) },
]

// Sama dengan batas badan JSON di backend (413 di atas 1 MiB); ditolak lebih awal di sini supaya
// badan sebesar itu tidak perlu dibaca ke memori.
export const BATAS_BADAN_BYTE = 1024 * 1024

// Segmen path hanya huruf, angka, dan tanda yang dipakai UUID, nomor SPK (S-0001), dan token.
// Titik di awal ditolak, sehingga "." dan ".." tidak bisa dipakai keluar dari /api.
const POLA_SEGMEN = /^[A-Za-z0-9_-][A-Za-z0-9._~-]*$/

const GALAT_TANPA_SESI: GalatApi = {
    code: 'unauthenticated',
    message: 'Sesi kamu sudah berakhir. Masuk lagi untuk melanjutkan.',
}

const GALAT_TERLALU_LAMA: GalatApi = {
    code: 'internal_error',
    message: 'Server terlalu lama menjawab. Periksa dulu apakah perubahan sudah tercatat.',
}

const GALAT_TERLALU_BESAR: GalatApi = {
    code: 'payload_too_large',
    message: 'Badan permintaan terlalu besar',
}

const GALAT_RUTE: GalatApi = { code: 'not_found', message: 'Rute tidak ada.' }

const balasGalat = (status: number, galat: GalatApi): NextResponse =>
    NextResponse.json({ error: galat }, { status, headers: { 'Cache-Control': 'no-store' } })

// Server action dilindungi Next.js dari permintaan lintas situs; route handler tidak, jadi asal
// permintaan diperiksa sendiri. Cookie SameSite=Lax sudah menahan POST dari situs lain, dan
// badan JSON memaksa preflight CORS; pemeriksaan ini lapisan ketiga. Untuk pintu publik tidak
// ada cookie yang perlu dilindungi, tetapi pemeriksaan yang sama mencegah halaman situs lain
// memakai browser pengunjung untuk menembak rute booking.
export const asalSah = (req: Request): boolean => {
    const asal = req.headers.get('origin')
    if (!asal) return true
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    try {
        return new URL(asal).host === host
    } catch {
        return false
    }
}

const segmenAman = (jalur: readonly string[]): boolean =>
    jalur.length > 0 && jalur.every((segmen) => POLA_SEGMEN.test(segmen))

export const jalurStafBoleh = (jalur: readonly string[]): boolean => {
    if (!segmenAman(jalur) || !AWALAN_STAF.has(jalur[0])) return false
    return !DITOLAK_STAF.has(jalur.slice(0, 2).join('/'))
}

export const rutePublikBoleh = (metode: string, jalur: readonly string[]): boolean => {
    if (!segmenAman(jalur)) return false
    const path = jalur.join('/')
    return RUTE_PUBLIK.some((rute) => rute.metode === metode && rute.pola.test(path))
}

const TANPA_BADAN = new Set(['GET', 'HEAD', 'DELETE'])

// Membaca badan permintaan sambil menghitung byte, dan berhenti begitu melewati `batas` (null =
// terlalu besar). `req.arrayBuffer()` tidak cocok: badan chunked tanpa Content-Length dibaca habis
// ke memori lebih dulu, baru diperiksa, sehingga satu permintaan ratusan megabyte dari siapa pun
// (pintu publik tidak butuh token) bisa menghabiskan memori server web. Di belakang Nginx,
// `client_max_body_size` memotongnya lebih awal; ini pagar untuk port web yang dibuka langsung.
export async function bacaBadanBerbatas(
    req: Request,
    batas: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
    if (!req.body) return new Uint8Array(0)
    const pembaca = req.body.getReader()
    const bagian: Uint8Array[] = []
    let total = 0
    for (;;) {
        const { done, value } = await pembaca.read()
        if (done) break
        total += value.byteLength
        if (total > batas) {
            await pembaca.cancel().catch(() => undefined)
            return null
        }
        bagian.push(value)
    }
    const hasil = new Uint8Array(total)
    let posisi = 0
    for (const b of bagian) {
        hasil.set(b, posisi)
        posisi += b.byteLength
    }
    return hasil
}

// Inti penerusan, dipakai kedua pintu. `rute` = path API tanpa awalan /api, mis.
// "work-orders/S-0001" atau "public/services"; `token` kosong untuk pintu publik. Hanya header
// yang disebut di sini yang dikirim ke backend (bukan semua header permintaan), jadi cookie,
// Origin, dan header lain milik browser tidak ikut.
async function teruskanKeApi(
    req: NextRequest,
    rute: string,
    token?: string,
): Promise<NextResponse> {
    const dasar = alamatApi()
    if (!dasar) return balasGalat(500, GALAT_TANPA_API_URL)

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    let badan: Uint8Array<ArrayBuffer> | undefined
    if (!TANPA_BADAN.has(req.method)) {
        const panjang = Number(req.headers.get('content-length') ?? '0')
        if (panjang > BATAS_BADAN_BYTE) return balasGalat(413, GALAT_TERLALU_BESAR)
        const terbaca = await bacaBadanBerbatas(req, BATAS_BADAN_BYTE)
        if (terbaca === null) return balasGalat(413, GALAT_TERLALU_BESAR)
        badan = terbaca
        // Spec mewajibkan Content-Type: application/json untuk permintaan berbadan.
        if (badan.byteLength > 0) headers['Content-Type'] = 'application/json'
    }

    let balasan: Response
    try {
        balasan = await fetch(`${dasar}/api/${rute}${req.nextUrl.search}`, {
            method: req.method,
            headers,
            body: badan && badan.byteLength > 0 ? badan : undefined,
            cache: 'no-store',
            signal: AbortSignal.timeout(BATAS_WAKTU_MS),
        })
    } catch (galat) {
        // 504 bila backend terlalu lama menjawab, 502 bila tidak bisa dihubungi. Keduanya berarti
        // hasil aksi tulis belum pasti (lihat hasilTidakPasti di src/klien/peramban.ts).
        if (galat instanceof Error && galat.name === 'TimeoutError') {
            return balasGalat(504, GALAT_TERLALU_LAMA)
        }
        return balasGalat(502, GALAT_TAK_TERHUBUNG)
    }

    const keluar = new NextResponse(balasan.status === 204 ? null : await balasan.arrayBuffer(), {
        status: balasan.status,
        headers: { 'Cache-Control': 'no-store' },
    })
    const jenis = balasan.headers.get('content-type')
    if (jenis && balasan.status !== 204) keluar.headers.set('Content-Type', jenis)
    const retryAfter = balasan.headers.get('retry-after')
    if (retryAfter) keluar.headers.set('Retry-After', retryAfter)
    return keluar
}

// Pintu staf: /bff/staf/<jalur> -> /api/<jalur> dengan token dari cookie.
export async function teruskanStaf(req: NextRequest, jalur: readonly string[]): Promise<Response> {
    if (!jalurStafBoleh(jalur)) return balasGalat(404, GALAT_RUTE)
    if (req.method !== 'GET' && !asalSah(req)) {
        return balasGalat(403, { code: 'forbidden', message: 'Permintaan ditolak.' })
    }
    const token = req.cookies.get(NAMA_COOKIE_SESI)?.value
    if (!token) return balasGalat(401, GALAT_TANPA_SESI)

    const keluar = await teruskanKeApi(req, jalur.join('/'), token)
    // Token yang ditolak backend dibuang sekarang juga, supaya halaman berikutnya langsung
    // diarahkan ke halaman masuk oleh middleware tanpa bertanya ke backend lagi.
    if (keluar.status === 401) keluar.cookies.delete(NAMA_COOKIE_SESI)
    return keluar
}

// Pintu publik: /bff/public/<jalur> -> /api/public/<jalur>. Tidak menyentuh cookie sama sekali.
export async function teruskanPublik(
    req: NextRequest,
    jalur: readonly string[],
): Promise<Response> {
    if (!rutePublikBoleh(req.method, jalur)) return balasGalat(404, GALAT_RUTE)
    if (req.method !== 'GET' && !asalSah(req)) {
        return balasGalat(403, { code: 'forbidden', message: 'Permintaan ditolak.' })
    }
    return teruskanKeApi(req, `public/${jalur.join('/')}`)
}
