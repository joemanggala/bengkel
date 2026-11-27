// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import NotaThermal from '@/components/cetak/NotaThermal'
import KartuWaSpk from '@/components/spk/KartuWaSpk'
import { PenyediaToast } from '@/components/ui/Toast'
import { OUTLET_CONTOH, SPK_CONTOH } from '@/constants/contoh'
import {
    GALAT_PUBLIC_WEB_URL_KOSONG,
    GALAT_PUBLIC_WEB_URL_TIDAK_SAH,
    bacaAsalWebPublik,
} from '@/server/webPublik'
import { CATATAN_ALAMAT_PERAMBAN, susunTautanLacak, type TautanLacak } from '@/utils/tautanLacak'

// Tautan lacak di nota cetak, tombol Salin, dan Buka wajib sama persis dengan tautan di pesan
// WhatsApp, yang dirangkai backend sebagai {PUBLIC_WEB_URL}/servis/{trackingToken}.

const TOKEN = SPK_CONTOH.trackingToken

const kartuWa = (tautanLacak: TautanLacak) =>
    renderToStaticMarkup(
        <PenyediaToast>
            <KartuWaSpk spk={SPK_CONTOH} tautanLacak={tautanLacak} onSpk={() => {}} />
        </PenyediaToast>,
    )

const teksTautan = (markup: string) => /data-tautan-lacak="[^"]*">([^<]*)</.exec(markup)?.[1]
const hrefBuka = (markup: string) => /<a href="([^"]*)"[^>]*>Buka<\/a>/.exec(markup)?.[1]

describe('PUBLIC_WEB_URL web', () => {
    it('dipangkas dan garis miring akhirnya dibuang, seperti backend', () => {
        expect(bacaAsalWebPublik(' https://bengkelku.id/ \n', true)).toEqual({
            sumber: 'env',
            asal: 'https://bengkelku.id',
        })
        expect(bacaAsalWebPublik('http://192.168.1.20:3800//', true)).toEqual({
            sumber: 'env',
            asal: 'http://192.168.1.20:3800',
        })
    })

    it('kosong: alamat browser saat pengembangan, galat di produksi', () => {
        expect(bacaAsalWebPublik(undefined, false)).toEqual({ sumber: 'peramban' })
        expect(bacaAsalWebPublik(' \t', false)).toEqual({ sumber: 'peramban' })
        expect(bacaAsalWebPublik(undefined, true)).toEqual({
            sumber: 'galat',
            pesan: GALAT_PUBLIC_WEB_URL_KOSONG,
        })
        expect(GALAT_PUBLIC_WEB_URL_KOSONG).toContain('PUBLIC_WEB_URL')
    })

    it('bukan http(s), tanpa alamat, atau berspasi: galat, juga saat pengembangan', () => {
        for (const nilai of [
            'bengkelku.id',
            'ftp://bengkelku.id',
            'https://',
            'https:///servis',
            'https://bengkel ku.id',
            'HTTPS://bengkelku.id',
        ]) {
            expect(bacaAsalWebPublik(nilai, false), nilai).toEqual({
                sumber: 'galat',
                pesan: GALAT_PUBLIC_WEB_URL_TIDAK_SAH,
            })
        }
    })
})

describe('tautan lacak', () => {
    it('bentuknya sama dengan {tautanLacak} di spec/whatsapp.md', () => {
        // Contoh persis dari tabel isian spec/whatsapp.md.
        const token = 'Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk'
        const asal = bacaAsalWebPublik('https://bengkelku.id/', true)
        expect(susunTautanLacak(asal, token, 'http://localhost:3800').tautan).toBe(
            `https://bengkelku.id/servis/${token}`,
        )
    })

    it('PUBLIC_WEB_URL menang atas alamat browser staf', () => {
        const hasil = susunTautanLacak(
            { sumber: 'env', asal: 'https://bengkelku.id' },
            TOKEN,
            'http://localhost:3800',
        )
        expect(hasil).toEqual({
            tautan: `https://bengkelku.id/servis/${TOKEN}`,
            catatan: null,
            galat: null,
        })
    })

    it('tanpa env saat pengembangan: alamat browser, dengan catatan', () => {
        const asal = { sumber: 'peramban' } as const
        expect(susunTautanLacak(asal, TOKEN, '')).toEqual({
            tautan: null,
            catatan: CATATAN_ALAMAT_PERAMBAN,
            galat: null,
        })
        expect(susunTautanLacak(asal, TOKEN, 'http://localhost:3800').tautan).toBe(
            `http://localhost:3800/servis/${TOKEN}`,
        )
    })

    it('kartu WhatsApp, tombol Buka, dan nota memakai tautan yang sama', () => {
        const tautanLacak = susunTautanLacak(
            { sumber: 'env', asal: 'https://bengkelku.id' },
            TOKEN,
            'http://localhost:3800',
        )
        const harapan = `https://bengkelku.id/servis/${TOKEN}`
        const kartu = kartuWa(tautanLacak)
        expect(teksTautan(kartu)).toBe(harapan)
        expect(hrefBuka(kartu)).toBe(harapan)
        expect(kartu).not.toContain('localhost')
        const nota = renderToStaticMarkup(
            <NotaThermal spk={SPK_CONTOH} outlet={OUTLET_CONTOH} tautanLacak={harapan} />,
        )
        expect(nota).toContain(harapan)
    })

    it('galat konfigurasi: pesan tampil, tanpa tautan, Salin, dan Buka', () => {
        const kartu = kartuWa(
            susunTautanLacak({ sumber: 'galat', pesan: GALAT_PUBLIC_WEB_URL_KOSONG }, TOKEN, ''),
        )
        expect(kartu).toContain(GALAT_PUBLIC_WEB_URL_KOSONG)
        expect(kartu).not.toContain('/servis/')
        expect(kartu).not.toContain('>Salin<')
        expect(hrefBuka(kartu)).toBeUndefined()
        expect(kartu).toContain('Buat ulang')
    })
})
