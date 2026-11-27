// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useCallback, useEffect, useState } from 'react'
import AreaCetak, { TombolCetak } from '@/components/cetak/AreaCetak'
import NotaThermal from '@/components/cetak/NotaThermal'
import JudulHalaman from '@/components/ui/JudulHalaman'
import Kartu from '@/components/ui/Kartu'
import { LencanaBayar, LencanaStatusSpk } from '@/components/ui/Lencana'
import { useSegarBerkala } from '@/components/ui/useSegarBerkala'
import { PATH_BERANDA } from '@/constants/menu'
import { klienStaf } from '@/klien/peramban'
import type { Outlet } from '@/skema/outlet'
import type { SpkDetail } from '@/skema/spk'
import type { PeranStaf } from '@/skema/staf'
import { susunTautanLacak, type AsalWebPublik } from '@/utils/tautanLacak'
import Linimasa from './Linimasa'
import KartuBayarSpk from './KartuBayarSpk'
import KartuDataSpk from './KartuDataSpk'
import KartuItemSpk from './KartuItemSpk'
import KartuWaSpk from './KartuWaSpk'
import PanelStatusSpk from './PanelStatusSpk'

type Props = {
    awal: SpkDetail
    peran: PeranStaf
    outlet: Outlet | null
    asalWeb: AsalWebPublik
}

// SPK yang bisa diubah dari perangkat lain (mekanik mengubah status, kasir menambah item) dimuat
// ulang berkala; yang sudah diambil atau batal tidak berubah lagi.
const JEDA_MS = 30_000

// Rincian SPK. Pemilik dan kasir mendapat semua aksi (status, item, bayar, batal, WhatsApp,
// tautan lacak, cetak nota); mekanik hanya status dan diagnosis. Batas yang sama dijaga backend.
export default function RincianSpk({ awal, peran, outlet, asalWeb }: Props) {
    const kasir = peran !== 'mechanic'
    const [spk, setSpk] = useState(awal)
    // Alamat browser hanya dipakai saat pengembangan tanpa PUBLIC_WEB_URL (src/utils/tautanLacak.ts),
    // dan baru dibaca sesudah tampil karena server tidak tahu alamat yang dibuka staf.
    const [asalPeramban, setAsalPeramban] = useState('')
    useEffect(() => setAsalPeramban(window.location.origin), [])

    // Data dari aksi selalu yang terbaru; data dari polling hanya dipasang bila memang berubah,
    // supaya isian yang sedang diketik tidak ikut tersentuh.
    const pasang = useCallback((baru: SpkDetail) => setSpk(baru), [])
    const selesai = spk.status === 'PICKED_UP' || spk.status === 'CANCELLED'
    useSegarBerkala(
        async () => {
            const hasil = await klienStaf().detailSpk(spk.number)
            if (!hasil.ok) return hasil.status === 404 || hasil.status === 403 ? 'henti' : 'gagal'
            if (hasil.data.updatedAt !== spk.updatedAt) setSpk(hasil.data)
            return 'ok'
        },
        { jedaMs: JEDA_MS, aktif: !selesai },
    )

    const adaItem = spk.items.length > 0
    // Satu tautan untuk nota cetak dan kartu WhatsApp, supaya keduanya tidak mungkin berbeda.
    const tautanLacak = susunTautanLacak(asalWeb, spk.trackingToken, asalPeramban)

    return (
        <>
            <JudulHalaman
                judul={`SPK ${spk.number}`}
                kembali={{ label: 'Papan servis', href: PATH_BERANDA }}
                deskripsi={
                    <span className="mt-1 flex flex-wrap gap-2">
                        <LencanaStatusSpk status={spk.status} />
                        {/* SPK tanpa item bertotal 0 dianggap lunas oleh API; lencananya
                            disembunyikan sampai ada item supaya tidak menyesatkan. */}
                        {kasir && adaItem && <LencanaBayar status={spk.paymentStatus} />}
                    </span>
                }
                aksi={
                    kasir && outlet && spk.status !== 'CANCELLED' ? (
                        <TombolCetak label="Cetak nota" />
                    ) : undefined
                }
            />
            <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
                <div className="space-y-5">
                    <PanelStatusSpk spk={spk} peran={peran} onSpk={pasang} />
                    <KartuItemSpk spk={spk} bolehUbah={kasir} onSpk={pasang} />
                    {kasir && <KartuBayarSpk spk={spk} bolehBayar onSpk={pasang} />}
                </div>
                <div className="space-y-5">
                    <KartuDataSpk spk={spk} peran={peran} onSpk={pasang} />
                    {kasir && <KartuWaSpk spk={spk} tautanLacak={tautanLacak} onSpk={pasang} />}
                    <Kartu judul="Linimasa">
                        <Linimasa baris={spk.timeline} />
                    </Kartu>
                </div>
            </div>
            {kasir && outlet && (
                <AreaCetak>
                    <NotaThermal
                        spk={spk}
                        outlet={outlet}
                        tautanLacak={tautanLacak.tautan ?? undefined}
                    />
                </AreaCetak>
            )}
        </>
    )
}
