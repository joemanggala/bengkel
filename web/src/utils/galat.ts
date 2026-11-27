// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import {
    KODE_FIELD,
    KODE_GALAT,
    type GalatApi,
    type KodeField,
    type KodeGalat,
} from '@/skema/galat'

// Satu-satunya tempat kode galat dan kode aturan dari API diubah menjadi kalimat Indonesia
// (sapaan "kamu"). API sengaja tidak mengirim teks untuk galat validasi: `fields` hanya berisi
// kode aturan (`required`, `too_short`, ...) supaya galatnya sama persis apa pun backend yang
// dipakai; kalimatnya disusun di sini, dengan nama field yang dikenal pengguna.

// Aturan satu field, dipakai untuk menyusun kalimat galat yang sama di validasi browser (zod)
// maupun saat API menolak data.
export type AturanField = {
    label: string
    min?: number
    maks?: number
    // Kata sandi dibatasi byte UTF-8, bukan jumlah huruf, karena bcrypt hanya membaca 72 byte.
    satuan?: 'karakter' | 'byte'
    // Field berupa pilihan (select/radio) memakai kata "dipilih", bukan "diisi".
    pilihan?: boolean
    petunjukFormat?: string
    // Jenis isian yang diharapkan, mis. "angka bulat", untuk kalimat invalid_type.
    jenis?: string
    // Cara menulis batas min/maks di kalimat out_of_range, mis. harga sebagai rupiah.
    formatNilai?: (nilai: number) => string
}

const KALIMAT: Record<KodeField, (a: AturanField) => string> = {
    required: (a) => `${a.label} wajib ${a.pilihan ? 'dipilih' : 'diisi'}.`,
    invalid_type: (a) =>
        a.jenis
            ? `${a.label} harus berupa ${a.jenis}.`
            : `${a.label} tidak sesuai jenis isian yang diminta.`,
    invalid_format: (a) =>
        a.petunjukFormat
            ? `${a.label} belum sesuai format. ${a.petunjukFormat}`
            : `${a.label} belum sesuai format.`,
    // Batas bawah sandi juga dalam byte, tetapi 8 huruf apa pun pasti >= 8 byte, jadi kalimatnya
    // cukup "karakter" yang lebih mudah dipahami.
    too_short: (a) =>
        a.min === undefined
            ? `${a.label} terlalu pendek.`
            : `${a.label} minimal ${a.min} karakter.`,
    too_long: (a) => {
        if (a.maks === undefined) return `${a.label} terlalu panjang.`
        return a.satuan === 'byte'
            ? `${a.label} maksimal ${a.maks} byte. Huruf beraksen dan emoji dihitung lebih dari satu byte.`
            : `${a.label} maksimal ${a.maks} karakter.`
    },
    out_of_range: (a) => {
        const tulis = a.formatNilai ?? String
        if (a.min !== undefined && a.maks !== undefined) {
            return `${a.label} harus di antara ${tulis(a.min)} dan ${tulis(a.maks)}.`
        }
        if (a.maks !== undefined) return `${a.label} paling banyak ${tulis(a.maks)}.`
        if (a.min !== undefined) return `${a.label} paling sedikit ${tulis(a.min)}.`
        return `${a.label} di luar rentang yang diizinkan.`
    },
    too_many_items: (a) =>
        a.maks === undefined
            ? `${a.label} melebihi jumlah maksimal.`
            : `${a.label} maksimal berisi ${a.maks}.`,
    unknown_reference: (a) =>
        `${a.label} yang dipilih sudah tidak ada. Muat ulang halaman, lalu pilih lagi.`,
    inactive_reference: (a) =>
        `${a.label} yang dipilih sudah nonaktif. Pilih yang lain, atau minta pemilik mengaktifkannya.`,
}

export const adaKodeField = (kode: string): kode is KodeField =>
    (KODE_FIELD as readonly string[]).includes(kode)

export const adaKodeGalat = (kode: string): kode is KodeGalat =>
    (KODE_GALAT as readonly string[]).includes(kode)

export const pesanKodeField = (kode: string, aturan: AturanField): string =>
    adaKodeField(kode) ? KALIMAT[kode](aturan) : `${aturan.label} belum valid.`

export const PESAN_GALAT_UMUM = 'Terjadi kesalahan. Coba lagi sebentar lagi.'
export const PESAN_PERIKSA_ISIAN = 'Periksa lagi isian yang ditandai.'

// Pesan baku tiap kode, disalin huruf demi huruf dari `x-pesan-baku` di
// spec/components/schemas/umum.yaml (tes kontrakSpec.test.ts memeriksa keduanya sama). Ketiga
// backend wajib memakai pesan ini, jadi `message` dari backend mana pun sama dengan yang di sini.
// `not_found` tidak punya pesan baku di spec (backend boleh lebih spesifik, mis. "SPK tidak
// ditemukan"); teks di bawah hanya cadangan bila backend tidak mengirim pesan.
export const PESAN_BAKU: Record<KodeGalat, string> = {
    bad_request: 'Badan permintaan tidak bisa dibaca',
    unauthenticated: 'Autentikasi tidak sah atau sudah berakhir',
    invalid_credentials: 'Email atau kata sandi salah',
    forbidden: 'Kamu tidak punya akses ke sumber ini',
    setup_disabled: 'Pemasangan awal tidak aktif di server ini',
    setup_token_invalid: 'Token pemasangan salah',
    not_found: 'Data yang dicari tidak ditemukan',
    already_set_up: 'Aplikasi sudah dipasang, silakan masuk dengan akun pemilik',
    email_taken: 'Email sudah terdaftar',
    last_owner: 'Harus tetap ada setidaknya satu pemilik yang aktif',
    phone_taken: 'Nomor HP sudah dipakai pelanggan lain',
    plate_taken: 'Plat nomor sudah terdaftar',
    plate_owned_by_other_customer:
        'Plat nomor ini terdaftar atas pelanggan lain, periksa lagi data booking',
    service_name_taken: 'Nama jasa sudah dipakai',
    sku_taken: 'SKU sudah dipakai',
    status_transition_invalid: 'Perubahan status SPK ini tidak diizinkan',
    not_paid_off: 'Lunasi tagihan dulu sebelum kendaraan diserahkan',
    has_payments: 'SPK yang sudah dibayar tidak bisa dibatalkan',
    work_order_locked: 'SPK yang sudah selesai, diambil, atau dibatalkan tidak bisa diubah',
    work_order_empty: 'Tambahkan item jasa atau sparepart dulu sebelum menandai selesai',
    total_below_paid: 'Total SPK tidak boleh lebih kecil dari yang sudah dibayar',
    work_order_cancelled: 'SPK ini sudah dibatalkan',
    already_picked_up: 'Kendaraan sudah diambil',
    work_order_not_done: 'SPK ini belum selesai',
    // Seperti `not_found`, tidak punya pesan baku di spec: pesannya berformat baku tetapi memuat
    // nama sparepart dan jumlahnya ("Stok sparepart tidak cukup: Kampas Rem Depan Vario (butuh 3
    // set, tersedia 2 set)"), jadi yang tampil di layar selalu `message` dari server. Teks ini
    // hanya cadangan bila kosong.
    insufficient_stock: 'Stok sparepart tidak cukup',
    booking_transition_invalid: 'Perubahan status booking ini tidak diizinkan',
    too_many_pending_bookings: 'Nomor ini masih punya 3 booking yang menunggu konfirmasi',
    payload_too_large: 'Badan permintaan terlalu besar',
    validation_failed: 'Data yang dikirim belum valid',
    too_many_requests: 'Terlalu sering, silakan tunggu sebentar lalu coba lagi',
    internal_error: 'Terjadi kesalahan di server, silakan coba lagi',
    wa_unavailable: 'WhatsApp tidak bisa dikirim saat ini, coba lagi nanti',
}

// Kalimat khusus web untuk kode yang butuh petunjuk tambahan di layar (mis. cara memperbaiki
// pemasangan). Kode lain memakai `message` dari backend, atau PESAN_BAKU bila kosong. Jangan
// menambah `insufficient_stock` di sini: kalimat tetap akan menimpa pesan server yang menyebut
// sparepart apa yang kurang, padahal itulah yang perlu dibaca kasir.
export const PESAN_GALAT_WEB: Partial<Record<KodeGalat, string>> = {
    invalid_credentials: 'Email atau kata sandi salah. Periksa lagi, lalu coba masuk.',
    too_many_requests: 'Terlalu banyak percobaan masuk. Tunggu 15 menit, lalu coba lagi.',
    unauthenticated: 'Sesi kamu sudah berakhir. Masuk lagi untuk melanjutkan.',
    forbidden: 'Halaman atau aksi ini tidak tersedia untuk peranmu.',
    setup_disabled:
        'Pemasangan awal belum aktif di server. Isi SETUP_TOKEN di env backend (minimal 16 byte), lalu nyalakan ulang backend.',
    setup_token_invalid: 'Token pemasangan salah. Samakan dengan isi SETUP_TOKEN di env backend.',
    already_set_up: 'Aplikasi sudah dipasang. Masuk dengan akun pemilik, kasir, atau mekanik.',
    wa_unavailable:
        'WhatsApp belum bisa dikirim. Periksa koneksi penyedia WhatsApp, lalu kirim ulang.',
}

// Teks untuk galat yang bukan galat validasi: kalimat web bila ada, selain itu pesan dari
// backend, lalu pesan baku, lalu pesan umum.
export const pesanGalat = (galat: GalatApi): string =>
    PESAN_GALAT_WEB[galat.code] || galat.message || PESAN_BAKU[galat.code] || PESAN_GALAT_UMUM

export type PesanKhusus = Partial<Record<KodeGalat, { field?: string; pesan: string }>>

export type GalatForm = { pesan?: string; fields?: Record<string, string> }

// Galat isi larik memakai jalur bertitik (`items.0.quantity`); aturannya ditulis sekali dengan
// bintang (`items.*.quantity`) untuk semua baris.
const aturanUntuk = (nama: string, aturan: Record<string, AturanField>): AturanField | undefined =>
    aturan[nama] ?? aturan[nama.replace(/\.[0-9]+(?=\.|$)/g, '.*')]

// Mengubah galat API menjadi pesan form. Galat yang punya field tujuan (mis. token setup yang
// salah) ditempel di field itu, supaya pengguna langsung melihat isian mana yang harus diganti.
export const petakanGalatForm = (
    galat: GalatApi,
    aturan: Record<string, AturanField>,
    khusus: PesanKhusus = {},
): GalatForm => {
    if (galat.code === 'validation_failed' && galat.fields) {
        const fields: Record<string, string> = {}
        const tanpaTempat: string[] = []
        for (const [nama, kode] of Object.entries(galat.fields)) {
            const aturanField = aturanUntuk(nama, aturan)
            if (aturanField) fields[nama] = pesanKodeField(kode, aturanField)
            else tanpaTempat.push(pesanKodeField(kode, { label: nama }))
        }
        const pesan = [PESAN_PERIKSA_ISIAN, ...tanpaTempat].join(' ')
        return Object.keys(fields).length > 0 ? { pesan, fields } : { pesan }
    }
    const pesanKhusus = khusus[galat.code]
    if (pesanKhusus) {
        return pesanKhusus.field
            ? { fields: { [pesanKhusus.field]: pesanKhusus.pesan } }
            : { pesan: pesanKhusus.pesan }
    }
    return { pesan: pesanGalat(galat) }
}

const isObjek = (nilai: unknown): nilai is Record<string, unknown> =>
    typeof nilai === 'object' && nilai !== null && !Array.isArray(nilai)

// Badan galat dibaca dengan curiga: proxy atau server yang mati bisa membalas HTML atau kosong.
// Kode di luar daftar spec (backend yang lebih baru) dipetakan ke internal_error tetapi
// `message`-nya dipertahankan, supaya pengguna tetap melihat teks dari backend.
export const bacaGalatApi = (isi: unknown): GalatApi => {
    const galat = isObjek(isi) ? isi.error : undefined
    if (!isObjek(galat) || typeof galat.code !== 'string') {
        return { code: 'internal_error', message: PESAN_GALAT_UMUM }
    }
    const message = typeof galat.message === 'string' ? galat.message : ''
    const hasil: GalatApi = {
        code: adaKodeGalat(galat.code) ? galat.code : 'internal_error',
        message,
    }
    if (isObjek(galat.fields)) {
        const fields: Record<string, string> = {}
        for (const [nama, kode] of Object.entries(galat.fields)) {
            if (typeof kode === 'string') fields[nama] = kode
        }
        hasil.fields = fields
    }
    return hasil
}
