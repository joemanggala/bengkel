// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Outlet } from '@/skema/outlet'
import type { SpkDetail, SpkRingkas, StatusSpk } from '@/skema/spk'

// Data contoh untuk galeri komponen (/admin/komponen) dan tes komponen. Bentuknya mengikuti
// contoh di spec/components/examples/contoh.yaml (SPK S-0012), dan tes memeriksanya terhadap
// skema zod, jadi contoh ini tidak bisa diam-diam menyimpang dari kontrak. Bukan data sungguhan:
// halaman yang tersambung ke backend tidak pernah memakainya.

export const OUTLET_CONTOH: Outlet = {
    name: 'Nama Bengkel',
    tagline: 'Servis motor dan mobil, cepat dan jujur',
    address: 'Jl. Contoh No. 1\nKota Contoh',
    phone: '6281234500000',
    openingHours: 'Senin–Sabtu 08.00–17.00',
    mapsUrl: 'https://maps.google.com/?q=bengkel',
    receiptFooter: 'Garansi servis 7 hari.',
}

const KASIR = { staffId: '0b7c2f4e-1a2b-4c3d-8e9f-000000000002', name: 'Rina Kasir' }
const MEKANIK = { staffId: '0b7c2f4e-1a2b-4c3d-8e9f-000000000003', name: 'Andi Mekanik' }

export const TOKEN_LACAK_CONTOH = 'Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk'

export const SPK_CONTOH: SpkDetail = {
    number: 'S-0012',
    status: 'IN_PROGRESS',
    paymentStatus: 'partial',
    customer: {
        customerId: '1c1c1c1c-0000-4000-8000-000000000001',
        name: 'Budi Santoso',
        phone: '6281234567890',
    },
    vehicle: {
        vehicleId: '2d2d2d2d-0000-4000-8000-000000000001',
        type: 'MOTOR',
        plate: 'B 1234 XYZ',
        brand: 'Honda',
        model: 'Vario 125',
        year: 2021,
        color: 'Hitam',
    },
    booking: { bookingId: '5a5a5a5a-0000-4000-8000-000000000001', number: 'B-0007' },
    mechanic: MEKANIK,
    complaint: 'Rem depan bunyi saat dipakai.',
    diagnosis: 'Kampas rem depan habis.',
    odometer: 18250,
    estimatedDoneAt: '2026-11-28T08:00:00.000Z',
    serviceSubtotal: 35000,
    partSubtotal: 130000,
    total: 165000,
    paidAmount: 50000,
    remainingAmount: 115000,
    cancelReason: null,
    trackingToken: TOKEN_LACAK_CONTOH,
    createdBy: KASIR,
    createdAt: '2026-11-28T01:15:00.000Z',
    updatedAt: '2026-11-28T01:40:00.000Z',
    items: [
        {
            itemId: '6b6b6b6b-0000-4000-8000-000000000001',
            type: 'SERVICE',
            serviceId: '3e3e3e3e-0000-4000-8000-000000000001',
            partId: null,
            name: 'Ganti Oli',
            price: 35000,
            quantity: 1,
            subtotal: 35000,
            createdAt: '2026-11-28T01:15:00.000Z',
        },
        {
            itemId: '6b6b6b6b-0000-4000-8000-000000000002',
            type: 'PART',
            serviceId: null,
            partId: '4f4f4f4f-0000-4000-8000-000000000001',
            name: 'Oli Mesin 10W-40 0,8 L',
            price: 55000,
            quantity: 1,
            subtotal: 55000,
            createdAt: '2026-11-28T01:20:00.000Z',
        },
        {
            itemId: '6b6b6b6b-0000-4000-8000-000000000003',
            type: 'PART',
            serviceId: null,
            partId: '4f4f4f4f-0000-4000-8000-000000000002',
            name: 'Kampas Rem Depan Vario',
            price: 75000,
            quantity: 1,
            subtotal: 75000,
            createdAt: '2026-11-28T01:25:00.000Z',
        },
    ],
    payments: [
        {
            paymentId: '7c7c7c7c-0000-4000-8000-000000000001',
            amount: 50000,
            method: 'cash',
            recordedBy: KASIR,
            createdAt: '2026-11-28T01:30:00.000Z',
        },
    ],
    timeline: [
        {
            fromStatus: null,
            toStatus: 'QUEUED',
            by: KASIR,
            note: '',
            createdAt: '2026-11-28T01:15:00.000Z',
        },
        {
            fromStatus: 'QUEUED',
            toStatus: 'IN_PROGRESS',
            by: MEKANIK,
            note: '',
            createdAt: '2026-11-28T01:40:00.000Z',
        },
    ],
    wa: {
        workOrderCreated: { status: 'sent', createdAt: '2026-11-28T01:15:01.000Z' },
        workOrderDone: null,
        receipt: null,
    },
}

// Enam SPK ringkas, satu per status, untuk contoh tabel dan lencana.
const RINGKAS: [StatusSpk, string, string, number, number][] = [
    ['QUEUED', 'B 4321 KLM', 'Yamaha', 0, 0],
    ['IN_PROGRESS', 'B 1234 XYZ', 'Honda', 165000, 50000],
    ['WAITING_PARTS', 'D 77 AB', 'Suzuki', 240000, 0],
    ['DONE', 'F 1 Z', 'Toyota', 850000, 850000],
    ['PICKED_UP', 'AB 12 C', 'Honda', 95000, 95000],
    ['CANCELLED', 'L 9090 RT', 'Kawasaki', 0, 0],
]

export const DAFTAR_SPK_CONTOH: SpkRingkas[] = RINGKAS.map(
    ([status, plate, brand, total, paidAmount], i) => ({
        number: `S-00${String(i + 10).padStart(2, '0')}`,
        status,
        paymentStatus: paidAmount === total ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
        customer: {
            customerId: `1c1c1c1c-0000-4000-8000-00000000000${i + 1}`,
            name: ['Ani', 'Budi Santoso', 'Citra', 'Dodi', 'Eka', 'Fajar'][i],
            phone: `62812345678${i}0`,
        },
        vehicle: {
            vehicleId: `2d2d2d2d-0000-4000-8000-00000000000${i + 1}`,
            type: brand === 'Toyota' ? 'CAR' : 'MOTOR',
            plate,
            brand,
            model: '',
        },
        mechanic: status === 'QUEUED' ? null : MEKANIK,
        complaint: 'Servis rutin.',
        itemCount: total > 0 ? 2 : 0,
        total,
        paidAmount,
        estimatedDoneAt: null,
        createdAt: '2026-11-28T01:15:00.000Z',
        updatedAt: '2026-11-28T01:40:00.000Z',
    }),
)
