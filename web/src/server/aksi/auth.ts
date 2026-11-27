// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use server'

import { redirect } from 'next/navigation'
import type { HasilForm } from '@/klien/hasil'
import { pesanDariZod } from '@/skema/form/aturan'
import { ATURAN_MASUK, ATURAN_SETUP, skemaMasuk, skemaSetupApi } from '@/skema/form/auth'
import { ambilToken, hapusToken, simpanToken } from '@/server/sesi'
import { klienServer } from '@/server/pengangkut'
import { PESAN_BAKU, PESAN_GALAT_WEB, PESAN_PERIKSA_ISIAN, petakanGalatForm } from '@/utils/galat'
import { PATH_MASUK, PATH_SETELAH_SETUP, tujuanSetelahMasuk } from '@/utils/sesi'

type Tujuan = { tujuan: string }

// Aksi masuk, setup, dan keluar jalan di server: balasan POST /api/staff/login dan /api/setup
// berisi token sesi, yang langsung disimpan ke cookie httpOnly dan tidak pernah dikirim ke
// JavaScript browser. Itu pula sebabnya BFF menolak rute-rute ini (lihat src/server/bff.ts).
//
// Berkas 'use server' hanya boleh mengekspor fungsi async, jadi konstanta ada di utils/sesi.ts.
// Isian divalidasi ulang di server walau browser sudah memeriksanya, karena server action bisa
// dipanggil langsung tanpa melewati form.

export async function aksiMasuk(isian: unknown, ke?: string): Promise<HasilForm<Tujuan>> {
    const cek = skemaMasuk.safeParse(isian)
    if (!cek.success) {
        return { ok: false, pesan: PESAN_PERIKSA_ISIAN, fields: pesanDariZod(cek.error) }
    }
    const hasil = await klienServer().masukStaf(cek.data)
    if (!hasil.ok) return { ok: false, ...petakanGalatForm(hasil.galat, ATURAN_MASUK) }
    await simpanToken(hasil.data.token)
    return { ok: true, data: { tujuan: tujuanSetelahMasuk(hasil.data.staff.role, ke) } }
}

export type HasilSetup = HasilForm<Tujuan> | { ok: false; pesan: string; sudahDipasang: true }

export async function aksiSetup(isian: unknown): Promise<HasilSetup> {
    const cek = skemaSetupApi.safeParse(isian)
    if (!cek.success) {
        return { ok: false, pesan: PESAN_PERIKSA_ISIAN, fields: pesanDariZod(cek.error) }
    }
    const hasil = await klienServer().pasangAwal(cek.data)
    if (hasil.ok) {
        await simpanToken(hasil.data.token)
        return { ok: true, data: { tujuan: PATH_SETELAH_SETUP } }
    }
    // Sudah ada staf: form tidak berguna lagi, jadi halaman menawarkan tautan ke halaman masuk.
    if (hasil.galat.code === 'already_set_up') {
        return {
            ok: false,
            pesan: PESAN_GALAT_WEB.already_set_up ?? PESAN_BAKU.already_set_up,
            sudahDipasang: true,
        }
    }
    return {
        ok: false,
        ...petakanGalatForm(hasil.galat, ATURAN_SETUP, {
            // Token yang salah ditempel di kotak token; setup_disabled tampil sebagai pesan form
            // (lewat pesanGalat) karena tidak ada isian yang bisa diperbaiki di layar.
            setup_token_invalid: {
                field: 'token',
                pesan: PESAN_GALAT_WEB.setup_token_invalid ?? PESAN_BAKU.setup_token_invalid,
            },
        }),
    }
}

export async function aksiKeluar(): Promise<void> {
    const token = await ambilToken()
    // Balasan 401 berarti sesinya sudah habis di backend; cookie tetap dihapus. Gagal
    // menghubungi backend juga tidak menahan staf di dalam: cookie di perangkat ini tetap hilang.
    if (token) await klienServer(token).keluarStaf()
    await hapusToken()
    redirect(PATH_MASUK)
}
