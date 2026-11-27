// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'

// Bagian bersama skema data. Semua skema di folder ini mencerminkan spec/components/schemas/*.yaml
// (satu-satunya sumber kebenaran bentuk API). Skema dipakai klien API (src/klien) untuk memeriksa
// balasan backend: bila backend menyimpang dari kontrak, galatnya terlihat di satu tempat, bukan
// berupa layar yang rusak diam-diam. Objek memakai z.object() biasa (bukan strict): field tambahan
// dari backend yang lebih baru dibuang, tidak membuat halaman gagal.

// UUID kanonik huruf kecil yang dibuat aplikasi (spec: Uuid).
export const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Token acak 32 byte dalam base64url tanpa padding: token booking, token lacak SPK, dan token
// sesi staf (spec: TokenPublik, TokenSesi).
export const POLA_TOKEN = /^[A-Za-z0-9_-]{43}$/

// Nomor HP seragam 628..., 10 sampai 15 digit (spec: NomorHp).
export const POLA_NOMOR_HP = /^628[0-9]{7,12}$/

// Nomor HP tersamar di respons publik: 4 digit awal, tepat empat bintang, 4 digit akhir
// (spec: NomorHpSamaran), mis. 6281****7890.
export const POLA_NOMOR_HP_SAMARAN = /^628[0-9][*]{4}[0-9]{4}$/

// Nomor SPK S-0001 dan nomor booking B-0001: berurutan, minimal 4 digit (spec: NomorSpk,
// NomorBooking).
export const POLA_NOMOR_SPK = /^S-[0-9]{4,}$/
export const POLA_NOMOR_BOOKING = /^B-[0-9]{4,}$/

// Kunci plat (huruf besar tanpa spasi) dan plat tampilan (spec: PlatKunci, PlatTampilan).
export const POLA_PLAT_KUNCI = /^[A-Z][A-Z0-9]{1,11}$/
export const POLA_PLAT_TAMPILAN = /^[A-Z][A-Z0-9]*( [A-Z0-9]+){0,2}$/

// Tanggal kalender YYYY-MM-DD (spec: Tanggal).
export const POLA_TANGGAL = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

export const skemaUuid = z.string().regex(POLA_UUID)
export const skemaToken = z.string().regex(POLA_TOKEN)
export const skemaNomorHp = z.string().regex(POLA_NOMOR_HP)
export const skemaNomorHpSamaran = z.string().regex(POLA_NOMOR_HP_SAMARAN)
export const skemaNomorSpk = z.string().regex(POLA_NOMOR_SPK)
export const skemaNomorBooking = z.string().regex(POLA_NOMOR_BOOKING)
export const skemaPlatKunci = z.string().regex(POLA_PLAT_KUNCI)
export const skemaPlatTampilan = z.string().max(14).regex(POLA_PLAT_TAMPILAN)
export const skemaTanggal = z.string().regex(POLA_TANGGAL)

// Waktu `date-time` UTC. Jumlah digit pecahan detik bebas, jadi jangan membandingkan teksnya
// secara persis; ubah ke tampilan lewat formatWaktu() di src/utils/format.ts.
export const skemaWaktu = z.iso.datetime({ offset: true })

// Uang: integer rupiah tidak negatif (spec: Rupiah).
export const skemaRupiah = z.number().int().min(0)

// Harga katalog dan harga item: 0 sampai 100.000.000.
export const MAKS_HARGA = 100_000_000
export const skemaHarga = z.number().int().min(0).max(MAKS_HARGA)

// Label Indonesia dari x-label spec, sebagai peta yang lengkap untuk setiap nilai enum.
export type Label<T extends string> = Readonly<Record<T, string>>
