// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { NamaIkon } from '@/components/ui/Ikon'
import { PERAN_STAF, type PeranStaf } from '@/skema/staf'

// Menu panel staf sekaligus SATU-SATUNYA sumber aturan akses halaman per peran. Menu navigasi,
// middleware, penjaga di server (src/server/sesi.ts), dan tujuan ?ke= semuanya membaca daftar
// ini, jadi menu yang tampil dan halaman yang boleh dibuka tidak mungkin berbeda.
//
// Tiga peran:
//   - pemilik : semua menu;
//   - kasir   : Papan servis, SPK baru, Booking, Pelanggan (beserta Rincian SPK);
//   - mekanik : hanya Papan servis (berisi SPK miliknya) dan Rincian SPK.
// API tetap menolak (403) peran yang tidak berhak di setiap rute; aturan di sini lapisan tampilan.

export type ItemMenu = {
    label: string
    href: string
    ikon: NamaIkon
    // Peran yang melihat menu ini dan boleh membuka halamannya. Peran lain yang membuka alamatnya
    // diarahkan kembali ke Papan servis dengan penjelasan.
    peran: readonly PeranStaf[]
    // Alamat lain yang termasuk menu ini, mis. rincian SPK /admin/spk/S-0001 termasuk Papan servis
    // walau alamatnya tidak diawali /admin/papan.
    awalanLain?: readonly string[]
}

const SEMUA: readonly PeranStaf[] = PERAN_STAF
const KASIR: readonly PeranStaf[] = ['owner', 'cashier']
const PEMILIK: readonly PeranStaf[] = ['owner']

// Halaman pertama setelah masuk untuk semua peran: Papan servis.
export const PATH_BERANDA = '/admin/papan'

// Tujuan staf yang membuka halaman di luar perannya. Query `akses=ditolak` membuat Papan servis
// menampilkan penjelasan, supaya staf tidak bingung kenapa halamannya berganti.
export const PATH_AKSES_DITOLAK = `${PATH_BERANDA}?akses=ditolak`

export const MENU_PANEL: readonly ItemMenu[] = [
    {
        label: 'Papan servis',
        href: '/admin/papan',
        ikon: 'papan',
        peran: SEMUA,
        // Rincian SPK (/admin/spk/S-0001) bagian dari Papan servis dan terbuka untuk mekanik.
        awalanLain: ['/admin/spk'],
    },
    { label: 'SPK baru', href: '/admin/spk/baru', ikon: 'tambah', peran: KASIR },
    { label: 'Booking', href: '/admin/booking', ikon: 'kalender', peran: KASIR },
    { label: 'Pelanggan', href: '/admin/pelanggan', ikon: 'pelanggan', peran: KASIR },
    { label: 'Jasa', href: '/admin/jasa', ikon: 'kunci', peran: PEMILIK },
    // Harga beli sparepart rahasia pemilik (API tidak mengirimnya ke kasir), jadi kasir tidak membuka halaman ini.
    { label: 'Sparepart', href: '/admin/sparepart', ikon: 'gerigi', peran: PEMILIK },
    { label: 'Staf', href: '/admin/staf', ikon: 'staf', peran: PEMILIK },
    { label: 'Outlet', href: '/admin/outlet', ikon: 'outlet', peran: PEMILIK },
    { label: 'Rekap', href: '/admin/rekap', ikon: 'rekap', peran: PEMILIK },
]

// Halaman panel di luar menu yang tetap butuh masuk dan boleh dibuka semua staf.
export const HALAMAN_PANEL_LAIN: readonly string[] = ['/admin/komponen']

const dalamAwalan = (path: string, awalan: string): boolean =>
    path === awalan || path.startsWith(`${awalan}/`)

// Panjang awalan menu yang cocok dengan path (0 = tidak cocok). Dipakai untuk memilih menu
// dengan awalan terpanjang.
const panjangCocok = (path: string, item: ItemMenu): number =>
    [item.href, ...(item.awalanLain ?? [])]
        .filter((awalan) => dalamAwalan(path, awalan))
        .reduce((terpanjang, awalan) => Math.max(terpanjang, awalan.length), 0)

// Menu aktif = menu dengan awalan terpanjang yang cocok. Dengan begitu /admin/spk/baru
// mengaktifkan "SPK baru", sedangkan /admin/spk/S-0001 (rincian) mengaktifkan "Papan servis".
export const itemAktif = (path: string, menu: readonly ItemMenu[]): ItemMenu | null => {
    let terpilih: ItemMenu | null = null
    let panjang = 0
    for (const item of menu) {
        const cocok = panjangCocok(path, item)
        if (cocok > panjang) {
            terpilih = item
            panjang = cocok
        }
    }
    return terpilih
}

export const menuUntuk = (peran: PeranStaf, menu: readonly ItemMenu[] = MENU_PANEL): ItemMenu[] =>
    menu.filter((item) => item.peran.includes(peran))

// Peran yang boleh membuka path itu. Halaman panel lain (galeri komponen) dan path yang tidak
// dikenal terbuka untuk semua staf: yang tidak dikenal berakhir di halaman 404, bukan dibatasi.
export const peranHalaman = (path: string): readonly PeranStaf[] =>
    itemAktif(path, MENU_PANEL)?.peran ?? SEMUA

// true = halaman ini tidak untuk semua peran, jadi middleware perlu membaca peran dari backend.
export const halamanTerbatas = (path: string): boolean =>
    peranHalaman(path).length < PERAN_STAF.length

export const bolehMembuka = (peran: PeranStaf, path: string): boolean =>
    peranHalaman(path).includes(peran)

// Apakah path adalah halaman panel yang dikenal (menu atau halaman lain). Dipakai untuk
// memvalidasi tujuan ?ke= setelah masuk.
export const halamanPanelDikenal = (path: string): boolean =>
    itemAktif(path, MENU_PANEL) !== null || HALAMAN_PANEL_LAIN.some((a) => dalamAwalan(path, a))
