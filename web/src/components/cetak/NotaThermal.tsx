// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'
import type { Outlet } from '@/skema/outlet'
import {
    LABEL_METODE_BAYAR,
    LABEL_STATUS_BAYAR,
    LABEL_STATUS_SPK,
    type SpkDetail,
} from '@/skema/spk'
import {
    formatAngka,
    formatKendaraan,
    formatNomorHp,
    formatRupiah,
    formatWaktuWib,
} from '@/utils/format'
import { sisaTagihan } from '@/utils/statusSpk'

// Nota SPK untuk kertas thermal 58 mm (bidang cetak 48 mm, kira-kira 30 huruf per baris). Gaya
// dasarnya ada di kelas .nota-thermal di globals.css: hitam pekat tanpa abu-abu, karena printer
// thermal tidak bisa mencetak warna. Komponen yang sama dipakai untuk pratinjau di layar dan untuk
// isi #area-cetak (lihat AreaCetak). Isinya mengikuti templat nota WhatsApp di spec/whatsapp.md
// (bagian 5.5) supaya pelanggan menerima angka yang sama di kertas dan di ponsel. Harga beli
// sparepart tidak pernah ada di nota.

function Baris({
    label,
    children,
    tebal,
}: {
    label: string
    children: ReactNode
    tebal?: boolean
}) {
    return (
        <div className={`flex justify-between gap-2 ${tebal ? 'font-bold' : ''}`}>
            <span className="shrink-0">{label}</span>
            <span className="text-right">{children}</span>
        </div>
    )
}

const Garis = () => <hr className="garis-putus" />

type Props = {
    spk: SpkDetail
    outlet: Outlet
    // Alamat halaman lacak lengkap (http...://.../servis/<token>), dicetak sebagai "Nota online".
    // Dirangkai pemanggil dari alamat website, karena komponen ini tidak tahu domainnya.
    tautanLacak?: string
}

export default function NotaThermal({ spk, outlet, tautanLacak }: Props) {
    const sisa = sisaTagihan(spk.total, spk.paidAmount)
    return (
        <div className="nota-thermal">
            <div className="text-center">
                <p className="text-[13px] font-bold uppercase leading-tight">{outlet.name}</p>
                {outlet.address && <p className="mt-0.5 whitespace-pre-line">{outlet.address}</p>}
                {outlet.phone && <p>WA {formatNomorHp(outlet.phone)}</p>}
                {outlet.openingHours && (
                    <p className="whitespace-pre-line">{outlet.openingHours}</p>
                )}
            </div>
            <Garis />
            <Baris label="Nota SPK" tebal>
                {spk.number}
            </Baris>
            <Baris label="Waktu">{formatWaktuWib(spk.createdAt)}</Baris>
            <Baris label="Status">{LABEL_STATUS_SPK[spk.status]}</Baris>
            <Baris label="Pelanggan">{spk.customer.name}</Baris>
            <p>{formatKendaraan(spk.vehicle)}</p>
            {spk.mechanic && <Baris label="Mekanik">{spk.mechanic.name}</Baris>}
            <Garis />
            {spk.items.length === 0 ? (
                <p>Belum ada item.</p>
            ) : (
                <ul>
                    {spk.items.map((item, i) => (
                        <li key={item.itemId} className={i > 0 ? 'mt-1.5' : undefined}>
                            <p className="font-bold">{item.name}</p>
                            <Baris
                                label={`${formatAngka(item.quantity)} x ${formatRupiah(item.price)}`}
                            >
                                {formatRupiah(item.subtotal)}
                            </Baris>
                        </li>
                    ))}
                </ul>
            )}
            <Garis />
            <Baris label="Jasa">{formatRupiah(spk.serviceSubtotal)}</Baris>
            <Baris label="Sparepart">{formatRupiah(spk.partSubtotal)}</Baris>
            <div className="text-[13px]">
                <Baris label="Total" tebal>
                    {formatRupiah(spk.total)}
                </Baris>
            </div>
            {spk.payments.map((bayar) => (
                <Baris key={bayar.paymentId} label={`Bayar ${LABEL_METODE_BAYAR[bayar.method]}`}>
                    {formatRupiah(bayar.amount)}
                </Baris>
            ))}
            <Baris label="Dibayar">{formatRupiah(spk.paidAmount)}</Baris>
            <Baris label="Sisa">{formatRupiah(sisa)}</Baris>
            <p className="mt-1 text-center font-bold uppercase">
                {LABEL_STATUS_BAYAR[spk.paymentStatus]}
            </p>
            {tautanLacak && (
                <>
                    <Garis />
                    <p>Nota online:</p>
                    <p className="break-all">{tautanLacak}</p>
                </>
            )}
            {outlet.receiptFooter && (
                <>
                    <Garis />
                    <p className="whitespace-pre-line text-center">{outlet.receiptFooter}</p>
                </>
            )}
        </div>
    )
}
