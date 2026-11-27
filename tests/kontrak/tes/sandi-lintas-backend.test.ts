// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import bcrypt from 'bcryptjs';
import { beforeAll, describe, expect, it } from 'vitest';
import fixtur from '../fixtur/bcrypt.json';
import { buatPemilik, emailUnik, masukStaf, type SesiStaf } from '../src/data';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { hashSandi, masukDengan, POLA_BCRYPT_12, stafLangsung } from './pembantu-staf';

// Satu database bisa dipakai bergantian oleh Laravel, Go, dan NestJS. Staf
// yang dibuat lewat satu backend harus tetap bisa masuk lewat backend lain,
// jadi ketiga awalan bcrypt ($2a$ Go, $2b$ Node, $2y$ PHP) wajib diterima, dan
// hash buatan backend ini wajib bisa diperiksa pustaka bahasa lain.

const SANDI_BARU = 'SandiBaru456!';

let pemilik: SesiStaf;

beforeAll(async () => {
  pemilik = await buatPemilik();
});

describe('hash sandi lintas backend', () => {
  it.each([
    ['Go', '$2a$', fixtur.hash.go],
    ['Node', '$2b$', fixtur.hash.node],
    ['PHP', '$2y$', fixtur.hash.php],
  ])('hash buatan %s (%s) bisa dipakai masuk oleh ketiga peran; sandi lain ditolak', async (asal, awalan, hash) => {
    // Pengaman fixtur: bila hash-nya sendiri rusak, jangan menyalahkan backend.
    expect(hash.startsWith(awalan)).toBe(true);
    expect(await bcrypt.compare(fixtur.sandi, hash)).toBe(true);

    for (const role of ['owner', 'cashier', 'mechanic'] as const) {
      const { staffId, email } = await stafLangsung(`Staf ${asal}`, { role, hash, email: emailUnik(`lintas-${asal.toLowerCase()}-${role}`) });

      const sesi = await masukStaf(email, fixtur.sandi);

      expect(sesi.staff).toMatchObject({ staffId, email, role });
      harapStatus(await api.get('/api/staff/me', { token: sesi.token }), 200);
      harapGalat(await masukDengan(email, 'BukanSandiIni1!'), 401, 'invalid_credentials');
    }
  });

  it('hash buatan backend ini (POST /api/staff) ber-awalan $2a$/$2b$/$2y$, cost 12, dan cocok menurut bcryptjs', async () => {
    const email = emailUnik('buatan');
    const res = await api.post('/api/staff', { token: pemilik.token, json: { name: 'Kasir Buatan', email, password: SANDI_BARU, role: 'cashier' } });
    harapStatus(res, 201);

    const hash = await hashSandi(res.body.data.staffId);

    expect(hash).toMatch(POLA_BCRYPT_12);
    expect(await bcrypt.compare(SANDI_BARU, hash)).toBe(true);
    expect(await bcrypt.compare(`${SANDI_BARU}x`, hash)).toBe(false);
  });

  it('staf dengan hash $2a$ atau $2y$ diganti sandinya lewat PATCH: hash baru cost 12 cocok menurut bcryptjs, sandi lama ditolak', async () => {
    for (const [asal, hash] of [
      ['go', fixtur.hash.go],
      ['php', fixtur.hash.php],
    ] as const) {
      const { staffId, email } = await stafLangsung(`Kasir ${asal}`, { hash, email: emailUnik(`ganti-${asal}`) });

      harapStatus(await api.patch(`/api/staff/${staffId}`, { token: pemilik.token, json: { password: SANDI_BARU } }), 200);

      harapStatus(await masukDengan(email, SANDI_BARU), 200);
      harapGalat(await masukDengan(email, fixtur.sandi), 401, 'invalid_credentials');
      const baru = await hashSandi(staffId);
      expect(baru).toMatch(POLA_BCRYPT_12);
      expect(baru).not.toBe(hash);
      expect(await bcrypt.compare(SANDI_BARU, baru)).toBe(true);
    }
  });
});
