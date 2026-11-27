// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { GalatApi } from '@/skema/galat'
import type { Meta } from '@/skema/meta'

// Bentuk umum balasan API (spec/openapi.yaml, bagian Format): data di `data`, paginasi di
// `meta`, galat di `{ error: { code, message, fields? } }`. Semua fungsi klien mengembalikan
// HasilApi, bukan melempar galat, supaya halaman bisa menampilkan pesannya dengan tenang.
export type HasilApi<T> =
    | { ok: true; status: number; data: T; meta?: Meta }
    // status 0 = tidak ada jawaban sama sekali (jaringan putus atau backend mati).
    | { ok: false; status: number; galat: GalatApi; retryAfter?: number }

// Bentuk balikan aksi form (server action): pesan untuk seluruh form dan/atau pesan per field,
// keduanya sudah berupa kalimat Indonesia yang siap ditampilkan.
export type HasilForm<T = undefined> =
    { ok: true; data: T } | { ok: false; pesan?: string; fields?: Record<string, string> }
