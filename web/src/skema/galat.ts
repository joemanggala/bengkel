// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { z } from 'zod'

// Kode galat stabil dari spec/components/schemas/umum.yaml (KodeGalat). Daftar ini sama persis
// dengan enum di spec; tes src/skema/__tests__/kontrakSpec.test.ts membandingkannya langsung
// dengan berkas spec selama berkas itu ada.
export const KODE_GALAT = [
    'bad_request',
    'unauthenticated',
    'invalid_credentials',
    'forbidden',
    'setup_disabled',
    'setup_token_invalid',
    'not_found',
    'already_set_up',
    'email_taken',
    'last_owner',
    'phone_taken',
    'plate_taken',
    'plate_owned_by_other_customer',
    'service_name_taken',
    'sku_taken',
    'status_transition_invalid',
    'not_paid_off',
    'has_payments',
    'work_order_locked',
    'work_order_empty',
    'total_below_paid',
    'work_order_cancelled',
    'already_picked_up',
    'work_order_not_done',
    'insufficient_stock',
    'booking_transition_invalid',
    'too_many_pending_bookings',
    'payload_too_large',
    'validation_failed',
    'too_many_requests',
    'internal_error',
    'wa_unavailable',
] as const

export type KodeGalat = (typeof KODE_GALAT)[number]

// Kode aturan di `fields` galat validasi (spec: KodeField). Bukan teks bebas: teks Indonesianya
// disusun web di src/utils/galat.ts.
export const KODE_FIELD = [
    'required',
    'invalid_type',
    'invalid_format',
    'too_short',
    'too_long',
    'out_of_range',
    'too_many_items',
    'unknown_reference',
    'inactive_reference',
] as const

export type KodeField = (typeof KODE_FIELD)[number]

// Bentuk galat di web. Kode di luar daftar spec dipetakan ke internal_error saat dibaca (lihat
// bacaGalatApi). `fields` memetakan nama field ke kode aturan.
export type GalatApi = {
    code: KodeGalat
    message: string
    fields?: Record<string, string>
}

// Badan galat mentah dari backend: {"error": {"code", "message", "fields"?}}.
export const skemaGalat = z.object({
    error: z.object({
        code: z.string(),
        message: z.string(),
        fields: z.record(z.string(), z.string()).optional(),
    }),
})
