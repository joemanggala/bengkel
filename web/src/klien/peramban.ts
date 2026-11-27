// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { alamatMasukLagi } from '@/utils/sesi'
import type { KlienApi } from './antarmuka'
import { GALAT_TAK_TERHUBUNG, bacaBalasanApi } from './balasan'
import { buatKlien } from './buatKlien'
import type { HasilApi } from './hasil'
import { susunPermintaan, susunQuery, type OpsiPanggil, type Pengangkut } from './pengangkut'

// Pengangkut untuk komponen klien (kode yang jalan di browser). Browser tidak pernah berbicara
// langsung dengan backend dan tidak pernah memegang token:
//   - staf   : /bff/staf/<rute>  -> {API_URL}/api/<rute> dengan token dari cookie httpOnly
//   - publik : /bff/public/<rute> -> {API_URL}/api/public/<rute> tanpa cookie
// Lihat src/server/bff.ts untuk sisi servernya.

export type OpsiPengangkutBrowser = {
    // Awalan alamat BFF di depan rute API.
    awalan: string
    // true = balasan 401 (sesi habis) langsung membawa staf ke halaman masuk.
    pindahBilaSesiHabis?: boolean
    // Dipakai tes; di browser bawaannya berpindah halaman sungguhan.
    pindahHalaman?: (url: string) => void
    // Dipakai tes; bawaannya fetch global.
    ambil?: typeof fetch
}

const pindahSungguhan = (url: string): void => window.location.assign(url)

export function buatPengangkutBrowser(opsi: OpsiPengangkutBrowser): Pengangkut {
    return async (rute: string, panggilan: OpsiPanggil = {}): Promise<HasilApi<unknown>> => {
        const { headers, body } = susunPermintaan(panggilan)

        let balasan: Response
        try {
            balasan = await (opsi.ambil ?? fetch)(
                `${opsi.awalan}${rute}${susunQuery(panggilan.query)}`,
                { method: panggilan.metode ?? 'GET', headers, body, cache: 'no-store' },
            )
        } catch {
            return { ok: false, status: 0, galat: GALAT_TAK_TERHUBUNG }
        }

        const hasil = await bacaBalasanApi(balasan)
        // 401: BFF sudah menghapus cookie. Pemanggil tetap menerima hasilnya (mis. untuk
        // menghentikan indikator sibuk), tetapi halaman langsung pindah ke halaman masuk, dengan
        // ?ke= halaman ini supaya staf kembali ke sini setelah masuk lagi.
        if (!hasil.ok && hasil.status === 401 && opsi.pindahBilaSesiHabis) {
            const pindah = opsi.pindahHalaman ?? pindahSungguhan
            const sekarang =
                typeof window === 'undefined'
                    ? null
                    : window.location.pathname + window.location.search
            pindah(alamatMasukLagi(sekarang))
        }
        return hasil
    }
}

// Klien siap pakai untuk komponen klien.
export const klienStaf = (): KlienApi =>
    buatKlien(buatPengangkutBrowser({ awalan: '/bff/staf', pindahBilaSesiHabis: true }))

// Rute publik sudah berawalan /public, jadi awalan BFF-nya cukup /bff.
export const klienPublik = (): KlienApi => buatKlien(buatPengangkutBrowser({ awalan: '/bff' }))

// Aksi tulis yang gagal tanpa jawaban dari backend: koneksi browser putus (status 0), BFF tidak
// bisa menghubungi backend (502), atau backend terlalu lama menjawab (504). Pada ketiganya
// backend mungkin sudah menyimpan perubahan sebelum jawabannya hilang, jadi mengulang begitu saja
// bisa mencatat pembayaran atau SPK dua kali.
export const hasilTidakPasti = (hasil: HasilApi<unknown>): boolean =>
    !hasil.ok && (hasil.status === 0 || hasil.status === 502 || hasil.status === 504)

export const PESAN_TIDAK_PASTI =
    'Koneksi terputus sebelum jawaban server diterima, jadi belum pasti apakah perubahan tadi sudah tercatat. Data sudah dimuat ulang: periksa dulu sebelum mengulang.'

// Setelah masuk, cookie sesi dipasang oleh server action. Browser bisa diam-diam menolaknya (mis.
// cookie Secure diterima lewat http://), dan tanpa pemeriksaan ini staf akan dipentalkan kembali
// ke halaman masuk dengan tombol yang masih terkunci. true = cookie terkirim dan sah, false =
// tidak ada sesi, null = belum bisa dipastikan (mis. koneksi putus).
export const sesiTersimpan = async (ambil: typeof fetch = fetch): Promise<boolean | null> => {
    try {
        const balasan = await ambil('/bff/staf/staff/me', {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
        })
        if (balasan.ok) return true
        return balasan.status === 401 ? false : null
    } catch {
        return null
    }
}

export const PESAN_COOKIE_DITOLAK =
    'Email dan sandi benar, tetapi browser tidak menyimpan sesi. Biasanya karena aplikasi dibuka lewat http:// sementara server memakai cookie aman (COOKIE_SECURE=true). Buka lewat alamat https://, atau lihat bagian "Cookie sesi" di README web.'
