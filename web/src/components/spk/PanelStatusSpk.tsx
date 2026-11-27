// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

import { useState } from 'react'
import DialogAlasan from '@/components/ui/DialogAlasan'
import Field, { atributField } from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import Kartu from '@/components/ui/Kartu'
import KotakPesan from '@/components/ui/KotakPesan'
import { useToast } from '@/components/ui/Toast'
import Tombol from '@/components/ui/Tombol'
import { useAksi } from '@/components/ui/useAksi'
import { klienStaf } from '@/klien/peramban'
import type { KodeGalat } from '@/skema/galat'
import { LABEL_STATUS_SPK, type SpkDetail, type StatusTujuanSpk } from '@/skema/spk'
import type { PeranStaf } from '@/skema/staf'
import { PESAN_BAKU, pesanGalat } from '@/utils/galat'
import { cekBatalSpk, cekTransisiSpk, statusTujuanSpk } from '@/utils/statusSpk'

type Props = { spk: SpkDetail; peran: PeranStaf; onSpk: (spk: SpkDetail) => void }

// Nama tombol menurut tujuan (dan asal, untuk kembali dari menunggu part).
const labelTombol = (dari: SpkDetail['status'], ke: StatusTujuanSpk): string => {
    if (ke === 'IN_PROGRESS')
        return dari === 'WAITING_PARTS' ? 'Lanjut dikerjakan' : 'Mulai kerjakan'
    if (ke === 'WAITING_PARTS') return 'Menunggu part'
    if (ke === 'DONE') return 'Tandai selesai'
    return 'Serahkan kendaraan'
}

// Penjelasan singkat kenapa tombol terkunci, sama dengan pesan 409 dari backend.
const alasanTerkunci = (kode: KodeGalat | null): string | null =>
    kode === 'work_order_empty' || kode === 'not_paid_off' ? PESAN_BAKU[kode] : null

// Panel status SPK: tombol perpindahan yang sah menurut spec untuk peran ini, catatan linimasa
// opsional, dan pembatalan (pemilik dan kasir, selama belum ada pembayaran). Tombol yang pasti
// ditolak backend (belum ada item, belum lunas) tetap tampil terkunci dengan alasannya.
export default function PanelStatusSpk({ spk, peran, onSpk }: Props) {
    const { tampilkanToast } = useToast()
    const { sibuk, jalankan } = useAksi()
    const [catatan, setCatatan] = useState('')
    const [batal, setBatal] = useState(false)
    const tujuan = statusTujuanSpk(spk.status, peran)
    const keadaan = { status: spk.status, jumlahItem: spk.items.length, sisa: spk.remainingAmount }
    const bolehBatal = cekBatalSpk(spk, peran) === null
    const galatCatatan = catatan.trim().length > 200 ? 'Catatan maksimal 200 karakter.' : null

    const ubahStatus = (ke: StatusTujuanSpk) =>
        jalankan(
            ke,
            () => klienStaf().ubahStatusSpk(spk.number, { status: ke, note: catatan.trim() }),
            {
                sesudah: (baru) => {
                    onSpk(baru)
                    setCatatan('')
                    // Saat selesai, backend mengirim WhatsApp "siap diambil" ke pelanggan.
                    const wa = ke === 'DONE' ? baru.wa.workOrderDone?.status : undefined
                    tampilkanToast(
                        wa === 'failed'
                            ? 'Status Selesai tersimpan, tetapi WhatsApp "siap diambil" gagal terkirim. Kirim ulang dari kartu WhatsApp.'
                            : `Status menjadi ${LABEL_STATUS_SPK[ke]}.`,
                        wa === 'failed' ? 'galat' : 'berhasil',
                    )
                },
            },
        )

    const akhir = spk.status === 'PICKED_UP' || spk.status === 'CANCELLED'
    return (
        <Kartu judul="Status">
            {akhir ? (
                <p className="text-redup">
                    {spk.status === 'PICKED_UP'
                        ? 'Kendaraan sudah diambil. SPK ini selesai.'
                        : `SPK dibatalkan. Alasan: ${spk.cancelReason ?? '-'}`}
                </p>
            ) : tujuan.length === 0 ? (
                <p className="text-redup">
                    {peran === 'mechanic' && spk.status === 'DONE'
                        ? 'Pekerjaan selesai. Kasir yang menyerahkan kendaraan setelah lunas.'
                        : 'Tidak ada perubahan status yang bisa kamu lakukan.'}
                </p>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {tujuan.map((ke) => {
                            const kode = cekTransisiSpk(keadaan, ke)
                            return (
                                <Tombol
                                    key={ke}
                                    varian={ke === 'WAITING_PARTS' ? 'sekunder' : 'primer'}
                                    disabled={
                                        kode !== null ||
                                        galatCatatan !== null ||
                                        (sibuk !== null && sibuk !== ke)
                                    }
                                    sibuk={sibuk === ke}
                                    onClick={() => void ubahStatus(ke)}
                                >
                                    {labelTombol(spk.status, ke)}
                                </Tombol>
                            )
                        })}
                    </div>
                    {tujuan
                        .map((ke) => alasanTerkunci(cekTransisiSpk(keadaan, ke)))
                        .filter(Boolean)
                        .map((alasan) => (
                            <KotakPesan key={alasan} jenis="info">
                                {alasan}.
                            </KotakPesan>
                        ))}
                    <Field
                        id="status-catatan"
                        label="Catatan perubahan status"
                        galat={galatCatatan ?? undefined}
                        samping={<span className="text-sm text-redup">Opsional</span>}
                        petunjuk="Masuk ke linimasa staf; tidak tampil ke pelanggan."
                    >
                        <Input
                            {...atributField('status-catatan', galatCatatan ?? undefined, true)}
                            value={catatan}
                            onChange={(e) => setCatatan(e.target.value)}
                            placeholder="Mis. menunggu kampas rem dari pemasok"
                        />
                    </Field>
                </div>
            )}
            {bolehBatal && (
                <div className="mt-5 border-t border-garis pt-4">
                    <Tombol
                        varian="hantu"
                        className="text-bahaya-tua hover:bg-bahaya-pucat"
                        onClick={() => setBatal(true)}
                    >
                        Batalkan SPK
                    </Tombol>
                </div>
            )}
            {batal && (
                <DialogAlasan
                    judul={`Batalkan SPK ${spk.number}?`}
                    deskripsi="Semua sparepart di SPK ini kembali ke stok. Alasan batal terlihat oleh pelanggan di halaman lacak."
                    labelAlasan="Alasan batal"
                    labelKirim="Batalkan SPK"
                    contoh="Mis. pelanggan memutuskan servis di lain waktu."
                    onTutup={() => setBatal(false)}
                    onKirim={async (reason) => {
                        const hasil = await klienStaf().batalkanSpk(spk.number, { reason })
                        if (!hasil.ok) return pesanGalat(hasil.galat)
                        onSpk(hasil.data)
                        setBatal(false)
                        tampilkanToast(`SPK ${spk.number} dibatalkan.`)
                        return null
                    }}
                />
            )}
        </Kartu>
    )
}
