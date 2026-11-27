// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'
import { LABEL_STATUS_BOOKING, type StatusBooking } from '@/skema/booking'
import { LABEL_LEVEL_STOK, type LevelStok } from '@/skema/sparepart'
import { LABEL_STATUS_BAYAR, LABEL_STATUS_SPK, type StatusBayar, type StatusSpk } from '@/skema/spk'

export type NadaLencana = 'netral' | 'info' | 'sukses' | 'peringatan' | 'bahaya'

// Nada umum memakai rona lencana yang sudah ada, jadi tidak menambah warna baru.
const NADA: Record<NadaLencana, string> = {
    netral: 'bg-st-diambil-pucat text-st-diambil',
    info: 'bg-st-dikerjakan-pucat text-st-dikerjakan',
    sukses: 'bg-st-selesai-pucat text-st-selesai',
    peringatan: 'bg-bk-menunggu-pucat text-bk-menunggu',
    bahaya: 'bg-st-batal-pucat text-st-batal',
}

const DASAR =
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-semibold leading-none'

// Penanda bentuk di depan teks. Selain warna dan teks, status yang perlu dibedakan sekilas punya
// bentuk sendiri (titik penuh, cincin kosong, tanda silang), supaya tetap terbedakan bagi yang
// tidak melihat warna.
type Bentuk = 'titik' | 'cincin' | 'silang'

function Penanda({ bentuk }: { bentuk: Bentuk }) {
    if (bentuk === 'silang') {
        return (
            <svg viewBox="0 0 8 8" aria-hidden="true" className="h-2 w-2">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.8" />
            </svg>
        )
    }
    if (bentuk === 'cincin') {
        return <span aria-hidden="true" className="h-2 w-2 rounded-full border-2 border-current" />
    }
    return <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
}

// Lencana selalu berisi teks; warna hanya penguat, bukan satu-satunya pembeda.
export function Lencana({
    nada = 'netral',
    children,
}: {
    nada?: NadaLencana
    children: ReactNode
}) {
    return (
        <span className={`${DASAR} ${NADA[nada]}`}>
            <Penanda bentuk="titik" />
            {children}
        </span>
    )
}

// Status SPK: satu rona per status (token --color-st-* di globals.css). Teks labelnya dari
// x-label StatusSpk di spec (LABEL_STATUS_SPK), bukan ditulis ulang di sini. Status yang
// menunggu sesuatu (antre, menunggu part) memakai cincin kosong; dibatalkan memakai silang.
const GAYA_SPK: Record<StatusSpk, { kelas: string; bentuk: Bentuk }> = {
    QUEUED: { kelas: 'bg-st-antre-pucat text-st-antre', bentuk: 'cincin' },
    IN_PROGRESS: { kelas: 'bg-st-dikerjakan-pucat text-st-dikerjakan', bentuk: 'titik' },
    WAITING_PARTS: { kelas: 'bg-st-tunggu-part-pucat text-st-tunggu-part', bentuk: 'cincin' },
    DONE: { kelas: 'bg-st-selesai-pucat text-st-selesai', bentuk: 'titik' },
    PICKED_UP: { kelas: 'bg-st-diambil-pucat text-st-diambil', bentuk: 'titik' },
    CANCELLED: { kelas: 'bg-st-batal-pucat text-st-batal', bentuk: 'silang' },
}

export function LencanaStatusSpk({ status }: { status: StatusSpk }) {
    const { kelas, bentuk } = GAYA_SPK[status]
    return (
        <span data-status={status} className={`${DASAR} ${kelas}`}>
            <Penanda bentuk={bentuk} />
            {LABEL_STATUS_SPK[status]}
        </span>
    )
}

// Status booking: rona sendiri (token --color-bk-*). Menunggu konfirmasi staf memakai cincin
// kosong; ditolak dan dibatalkan memakai silang.
const GAYA_BOOKING: Record<StatusBooking, { kelas: string; bentuk: Bentuk }> = {
    PENDING: { kelas: 'bg-bk-menunggu-pucat text-bk-menunggu', bentuk: 'cincin' },
    CONFIRMED: { kelas: 'bg-bk-dikonfirmasi-pucat text-bk-dikonfirmasi', bentuk: 'titik' },
    CONVERTED: { kelas: 'bg-bk-jadi-spk-pucat text-bk-jadi-spk', bentuk: 'titik' },
    REJECTED: { kelas: 'bg-bk-ditolak-pucat text-bk-ditolak', bentuk: 'silang' },
    CANCELLED: { kelas: 'bg-bk-batal-pucat text-bk-batal', bentuk: 'silang' },
}

export function LencanaStatusBooking({ status }: { status: StatusBooking }) {
    const { kelas, bentuk } = GAYA_BOOKING[status]
    return (
        <span data-status={status} className={`${DASAR} ${kelas}`}>
            <Penanda bentuk={bentuk} />
            {LABEL_STATUS_BOOKING[status]}
        </span>
    )
}

// Level stok sparepart (Aman, Menipis, Habis), dihitung server.
const GAYA_LEVEL: Record<LevelStok, { nada: NadaLencana; bentuk: Bentuk }> = {
    ok: { nada: 'sukses', bentuk: 'titik' },
    low: { nada: 'peringatan', bentuk: 'cincin' },
    out: { nada: 'bahaya', bentuk: 'silang' },
}

export function LencanaLevelStok({ level }: { level: LevelStok }) {
    const { nada, bentuk } = GAYA_LEVEL[level]
    return (
        <span data-level={level} className={`${DASAR} ${NADA[nada]}`}>
            <Penanda bentuk={bentuk} />
            {LABEL_LEVEL_STOK[level]}
        </span>
    )
}

const NADA_BAYAR: Record<StatusBayar, NadaLencana> = {
    unpaid: 'bahaya',
    partial: 'peringatan',
    paid: 'sukses',
}

export function LencanaBayar({ status }: { status: StatusBayar }) {
    return <Lencana nada={NADA_BAYAR[status]}>{LABEL_STATUS_BAYAR[status]}</Lencana>
}
