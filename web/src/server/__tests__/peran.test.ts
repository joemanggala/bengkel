// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alamatApi } from '../api'
import { bacaPeran } from '../peran'

const jawab = (status: number, isi: unknown) =>
    vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(isi), {
            status,
            headers: { 'Content-Type': 'application/json' },
        }),
    )

beforeEach(() => vi.stubEnv('API_URL', 'http://backend.uji:8802'))
afterEach(() => vi.unstubAllEnvs())

describe('bacaPeran', () => {
    it.each(['owner', 'cashier', 'mechanic'])('peran %s terbaca', async (role) => {
        expect(await bacaPeran('tok', jawab(200, { data: { role } }))).toEqual({
            status: 'peran',
            peran: role,
        })
    })

    it('401 = sesi habis', async () => {
        expect(await bacaPeran('tok', jawab(401, { error: {} }))).toEqual({ status: 'habis' })
    })

    it('peran asing, 500, dan jaringan putus = tak terjangkau', async () => {
        expect(await bacaPeran('tok', jawab(200, { data: { role: 'admin' } }))).toEqual({
            status: 'tak-terjangkau',
        })
        expect(await bacaPeran('tok', jawab(500, {}))).toEqual({ status: 'tak-terjangkau' })
        const putus = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
        expect(await bacaPeran('tok', putus)).toEqual({ status: 'tak-terjangkau' })
    })
})

describe('alamat API', () => {
    it('garis miring di akhir dibuang', () => {
        vi.stubEnv('API_URL', ' http://backend.uji:8802/ ')
        expect(alamatApi()).toBe('http://backend.uji:8802')
    })

    it('kosong saat pengembangan = backend Laravel lokal; di produksi wajib diisi', () => {
        vi.stubEnv('API_URL', '')
        vi.stubEnv('NODE_ENV', 'development')
        expect(alamatApi()).toBe('http://localhost:8802')
        vi.stubEnv('NODE_ENV', 'production')
        expect(alamatApi()).toBeNull()
    })
})
