// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import NotaThermal from '@/components/cetak/NotaThermal'
import KerangkaPanel from '@/components/panel/KerangkaPanel'
import KerangkaPublik, { tautanPetaAman } from '@/components/publik/KerangkaPublik'
import LangkahBooking from '@/components/publik/LangkahBooking'
import TanyaJawab from '@/components/publik/TanyaJawab'
import Field from '@/components/ui/Field'
import KotakPesan from '@/components/ui/KotakPesan'
import { LencanaBayar, LencanaStatusBooking, LencanaStatusSpk } from '@/components/ui/Lencana'
import Tabel from '@/components/ui/Tabel'
import Tombol from '@/components/ui/Tombol'
import { LANGKAH_BOOKING, TANYA_JAWAB } from '@/constants/konten'
import { OUTLET_CONTOH, SPK_CONTOH } from '@/constants/contoh'
import { STATUS_BOOKING } from '@/skema/booking'
import { STATUS_SPK } from '@/skema/spk'
import type { Staf } from '@/skema/staf'

// Kerangka panel membaca alamat lewat usePathname dan tombol Keluar memanggil server action;
// keduanya tidak ada di tes, jadi diganti pengganti sekadarnya.
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/papan', useRouter: () => ({}) }))
vi.mock('@/server/aksi/auth', () => ({ aksiKeluar: async () => {} }))

const html = (elemen: React.ReactElement) => renderToStaticMarkup(elemen)
const teks = (markup: string) =>
    markup
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
const kelas = (markup: string) => /class="([^"]*)"/.exec(markup)?.[1] ?? ''

describe('lencana status', () => {
    it('enam status SPK berlabel x-label spec dengan rona berbeda', () => {
        const markup = STATUS_SPK.map((s) => html(<LencanaStatusSpk status={s} />))
        expect(markup.map(teks)).toEqual([
            'Antre',
            'Dikerjakan',
            'Menunggu part',
            'Selesai',
            'Diambil',
            'Dibatalkan',
        ])
        expect(new Set(markup.map(kelas)).size).toBe(6)
    })

    it('lima status booking berlabel x-label spec dengan rona berbeda', () => {
        const markup = STATUS_BOOKING.map((s) => html(<LencanaStatusBooking status={s} />))
        expect(markup.map(teks)).toEqual([
            'Menunggu',
            'Dikonfirmasi',
            'Jadi SPK',
            'Ditolak',
            'Dibatalkan',
        ])
        expect(new Set(markup.map(kelas)).size).toBe(5)
    })

    it('status dibedakan juga oleh bentuk penanda, tidak hanya warna', () => {
        expect(html(<LencanaStatusSpk status="CANCELLED" />)).toContain('<svg')
        expect(html(<LencanaStatusSpk status="QUEUED" />)).toContain('border-2')
        expect(html(<LencanaStatusBooking status="PENDING" />)).toContain('border-2')
        expect(html(<LencanaStatusSpk status="DONE" />)).not.toContain('<svg')
        expect(teks(html(<LencanaBayar status="partial" />))).toBe('Bayar sebagian')
    })
})

describe('tabel', () => {
    const baris = [{ n: 'S-0001' }, { n: 'S-0002' }]
    const kolom = [{ kunci: 'a', judul: 'Nomor', isi: (b: { n: string }) => b.n }]

    it('kolom No berlanjut sesuai halaman', () => {
        const markup = html(
            <Tabel
                keterangan="SPK"
                kolom={kolom}
                baris={baris}
                kunciBaris={(b) => b.n}
                nomorAwal={21}
            />,
        )
        expect(teks(markup)).toContain('No Nomor 21 S-0001 22 S-0002')
    })

    it('tanpa nomorAwal tidak ada kolom No; daftar kosong berisi kalimat', () => {
        const markup = html(
            <Tabel keterangan="SPK" kolom={kolom} baris={[]} kunciBaris={(b) => b.n} />,
        )
        expect(teks(markup)).not.toContain('No ')
        expect(teks(markup)).toContain('Belum ada data.')
    })
})

describe('komponen dasar', () => {
    it('tombol sibuk terkunci dan bertipe button', () => {
        const markup = html(<Tombol sibuk>Simpan</Tombol>)
        expect(markup).toContain('type="button"')
        expect(markup).toContain('disabled')
        expect(markup).toContain('aria-busy="true"')
    })

    it('galat field dibacakan bersama ikon; galat form memakai role alert', () => {
        expect(
            html(
                <Field id="p" label="Plat" galat="Plat wajib diisi.">
                    <input />
                </Field>,
            ),
        ).toContain('id="p-galat"')
        expect(html(<KotakPesan jenis="galat">x</KotakPesan>)).toContain('role="alert"')
        expect(html(<KotakPesan jenis="info">x</KotakPesan>)).toContain('role="status"')
    })
})

describe('nota thermal 58 mm', () => {
    const markup = html(
        <NotaThermal
            spk={SPK_CONTOH}
            outlet={OUTLET_CONTOH}
            tautanLacak={`https://bengkelku.id/servis/${SPK_CONTOH.trackingToken}`}
        />,
    )

    it('isi sama dengan templat nota WhatsApp', () => {
        const isi = teks(markup)
        for (const bagian of [
            'Nota SPK S-0012',
            '28-11-2026 08:15 WIB',
            'B 1234 XYZ (Honda Vario 125)',
            'Ganti Oli',
            '1 x Rp35.000 Rp35.000',
            'Jasa Rp35.000',
            'Sparepart Rp130.000',
            'Total Rp165.000',
            'Dibayar Rp50.000',
            'Sisa Rp115.000',
            'Bayar sebagian',
            'Garansi servis 7 hari.',
        ]) {
            expect(isi, bagian).toContain(bagian)
        }
        expect(markup).toContain('class="nota-thermal"')
    })

    it('tidak memuat diagnosis atau data internal', () => {
        expect(teks(markup)).not.toContain(SPK_CONTOH.diagnosis)
    })

    it('SPK tanpa item menulis "Belum ada item."', () => {
        const kosong = { ...SPK_CONTOH, items: [] }
        expect(teks(html(<NotaThermal spk={kosong} outlet={OUTLET_CONTOH} />))).toContain(
            'Belum ada item.',
        )
    })
})

describe('kerangka panel: menu menurut peran', () => {
    const staf = (role: Staf['role']): Staf => ({
        staffId: '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a01',
        name: 'Andi',
        email: 'andi@bengkel.test',
        role,
        isActive: true,
        createdAt: '2026-11-27T01:00:00.000Z',
    })
    const menuSamping = (role: Staf['role']) =>
        /<nav id="navigasi-panel"[\s\S]*?<\/nav>/.exec(
            html(
                <KerangkaPanel staf={staf(role)} namaOutlet="Nama Bengkel">
                    <p>isi</p>
                </KerangkaPanel>,
            ),
        )?.[0] ?? ''

    it('mekanik hanya melihat Papan servis', () => {
        const nav = menuSamping('mechanic')
        expect(nav.match(/<a /g)).toHaveLength(1)
        expect(nav).toContain('href="/admin/papan"')
        expect(nav).not.toContain('Khusus pemilik')
    })

    it('kasir tanpa kelompok Khusus pemilik; pemilik dengan kelompok itu', () => {
        const kasir = menuSamping('cashier')
        expect(kasir).toContain('href="/admin/booking"')
        expect(kasir).not.toContain('href="/admin/rekap"')
        const pemilik = menuSamping('owner')
        expect(teks(pemilik)).toContain('Khusus pemilik')
        expect(pemilik).toContain('href="/admin/sparepart"')
    })

    it('Papan servis ditandai aktif', () => {
        expect(menuSamping('owner')).toMatch(/<a aria-current="page"[^>]*href="\/admin\/papan"/)
    })
})

describe('website publik', () => {
    it('kerangka memuat nama, tombol Booking, kontak outlet, dan jalan masuk staf', () => {
        const isi = teks(
            html(
                <KerangkaPublik namaOutlet="Nama Bengkel" outlet={OUTLET_CONTOH}>
                    <p>isi</p>
                </KerangkaPublik>,
            ),
        )
        for (const bagian of [
            'Nama Bengkel',
            'Booking',
            'WhatsApp 0812-3450-0000',
            'Masuk ke panel',
        ]) {
            expect(isi, bagian).toContain(bagian)
        }
    })

    it('tautan peta selain http(s) tidak dipasang', () => {
        expect(tautanPetaAman('https://maps.google.com/?q=a')).toBe(true)
        expect(tautanPetaAman('javascript:alert(1)')).toBe(false)
        expect(tautanPetaAman('')).toBe(false)
        const markup = html(
            <KerangkaPublik
                namaOutlet="Nama Bengkel"
                outlet={{ ...OUTLET_CONTOH, mapsUrl: 'javascript:alert(1)' }}
            >
                <p>isi</p>
            </KerangkaPublik>,
        )
        expect(markup).not.toContain('javascript:')
    })

    it('langkah booking dan tanya jawab dari berkas konten', () => {
        const langkah = teks(html(<LangkahBooking />))
        for (const l of LANGKAH_BOOKING) expect(langkah).toContain(l.judul)
        const tanya = html(<TanyaJawab />)
        expect(tanya.match(/<details/g)).toHaveLength(TANYA_JAWAB.length)
    })
})
