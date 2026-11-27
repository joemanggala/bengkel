// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import { buatKasir, buatMekanik, buatPemilik, emailUnik, masukStaf, SANDI_UJI, type SesiStaf } from '../src/data';
import { jumlahBaris, kosongkanStaf, sha256Hex } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { badanUtf8Rusak, JSON_RUSAK, jsonLebihDariSatuMib, tokenAcak } from './pembantu-fondasi';
import { hashSandi, masukDengan, POLA_BCRYPT_12, stafDb, stafLangsung } from './pembantu-staf';

// PATCH /api/staff/{staffId}. Aturan "pemilik terakhir" bergantung pada
// jumlah pemilik, jadi setiap tes mulai dari tabel staf kosong lalu satu
// pemilik.

const SANDI_BARU = 'SandiBaru456!';

let pemilik: SesiStaf;

function ubah(staffId: string, json: unknown, token: string | undefined = pemilik.token): Promise<Respons> {
  return api.patch(`/api/staff/${staffId}`, { token, json });
}

async function stafApi(staffId: string): Promise<any> {
  return (await api.get('/api/staff', { token: pemilik.token })).body.data.find((s: any) => s.staffId === staffId);
}

beforeEach(async () => {
  await kosongkanStaf();
  pemilik = await buatPemilik({ name: 'Ibu Sari' });
});

describe('PATCH /api/staff/{staffId}: perubahan sebagian', () => {
  it('field yang tidak dikirim tetap; nama dipangkas; {} → 200 tanpa perubahan; field lain diabaikan', async () => {
    const kasir = (await buatKasir({ name: 'Rina' })).staff;

    const res = await ubah(kasir.staffId, { name: '  Rina Wati ', staffId: 'x', createdAt: '2000-01-01T00:00:00Z', lain: 1 });

    harapStatus(res, 200);
    harapSetara(res.body.data, { ...kasir, name: 'Rina Wati' });
    const kosong = await ubah(kasir.staffId, {});
    harapStatus(kosong, 200);
    harapSetara(kosong.body.data, res.body.data);
    harapSetara(await stafApi(kasir.staffId), res.body.data);
  });

  it('email dipangkas dan dikecilkan; ke milik staf lain (termasuk nonaktif) → 409 email_taken; ke miliknya sendiri (beda huruf) → 200', async () => {
    const kasir = (await buatKasir()).staff;
    const nonaktif = await stafLangsung('Mantan', { aktif: false, role: 'mechanic' });

    harapGalat(await ubah(kasir.staffId, { email: pemilik.staff.email }), 409, 'email_taken');
    harapGalat(await ubah(kasir.staffId, { email: ` ${pemilik.staff.email.toUpperCase()} ` }), 409, 'email_taken');
    harapGalat(await ubah(kasir.staffId, { email: nonaktif.email }), 409, 'email_taken');
    const sendiri = await ubah(kasir.staffId, { email: kasir.email.toUpperCase() });
    harapStatus(sendiri, 200);
    expect(sendiri.body.data.email).toBe(kasir.email);
    const lokal = emailUnik('Baru.Email').split('@')[0] ?? '';
    const baru = await ubah(kasir.staffId, { email: ` ${lokal}@Contoh.ID\n` });
    harapStatus(baru, 200);
    expect(baru.body.data.email).toBe(`${lokal.toLowerCase()}@contoh.id`);
    harapStatus(await masukDengan(`${lokal.toLowerCase()}@contoh.id`), 200);
    harapGalat(await masukDengan(kasir.email), 401, 'invalid_credentials');
  });

  it.each([
    ['cashier', 'owner'],
    ['cashier', 'mechanic'],
    ['mechanic', 'cashier'],
    ['mechanic', 'owner'],
    ['owner', 'cashier'],
    ['owner', 'mechanic'],
  ] as const)('peran %s diubah menjadi %s: berlaku langsung untuk sesi yang sedang berjalan', async (dari, ke) => {
    if (dari === 'owner') {
      // Pemilik yang diturunkan bukan pemilik terakhir.
      await buatPemilik({ name: 'Pak Budi' });
    }
    const staf = dari === 'owner' ? await buatPemilik() : dari === 'cashier' ? await buatKasir() : await buatMekanik();

    const res = await ubah(staf.staff.staffId, { role: ke });

    harapStatus(res, 200);
    expect(res.body.data.role).toBe(ke);
    expect((await api.get('/api/staff/me', { token: staf.token })).body.data.role).toBe(ke);
    harapStatus(await api.get('/api/staff', { token: staf.token }), ke === 'owner' ? 200 : 403);
    harapStatus(await api.get('/api/mechanics', { token: staf.token }), ke === 'mechanic' ? 403 : 200);
  });

  it('dinonaktifkan: semua sesinya dihapus, tidak bisa masuk; diaktifkan lagi bisa masuk (sesi lama tetap mati)', async () => {
    for (const staf of [await buatKasir(), await buatMekanik()]) {
      const sesiLain = await masukStaf(staf.staff.email);

      const res = await ubah(staf.staff.staffId, { isActive: false });

      harapStatus(res, 200);
      expect(res.body.data.isActive).toBe(false);
      expect(await jumlahBaris('staff_sessions', 'staff_id = ?', [staf.staff.staffId])).toBe(0);
      harapGalat(await api.get('/api/staff/me', { token: staf.token }), 401, 'unauthenticated');
      harapGalat(await api.get('/api/staff/me', { token: sesiLain.token }), 401, 'unauthenticated');
      harapGalat(await masukDengan(staf.staff.email), 401, 'invalid_credentials');
      expect((await stafApi(staf.staff.staffId)).isActive).toBe(false);

      harapStatus(await ubah(staf.staff.staffId, { isActive: true }), 200);
      harapStatus(await masukDengan(staf.staff.email), 200);
      harapGalat(await api.get('/api/staff/me', { token: staf.token }), 401, 'unauthenticated');
    }
  });

  it('menonaktifkan staf yang sudah nonaktif atau mengaktifkan yang sudah aktif tetap 200', async () => {
    const { staffId } = await stafLangsung('Mantan', { aktif: false });

    harapStatus(await ubah(staffId, { isActive: false }), 200);
    harapStatus(await ubah(pemilik.staff.staffId, { isActive: true }), 200);
    harapStatus(await ubah(pemilik.staff.staffId, { role: 'owner' }), 200);
  });

  it('sandi diganti pemilik untuk staf lain: semua sesi staf itu dihapus, sesi peminta tetap; sandi lama ditolak; hash bcrypt cost 12', async () => {
    const kasir = await buatKasir();
    await masukStaf(kasir.staff.email);

    harapStatus(await ubah(kasir.staff.staffId, { password: SANDI_BARU }), 200);

    expect(await jumlahBaris('staff_sessions', 'staff_id = ?', [kasir.staff.staffId])).toBe(0);
    harapGalat(await api.get('/api/staff/me', { token: kasir.token }), 401, 'unauthenticated');
    harapGalat(await masukDengan(kasir.staff.email, SANDI_UJI), 401, 'invalid_credentials');
    harapStatus(await masukDengan(kasir.staff.email, SANDI_BARU), 200);
    harapStatus(await api.get('/api/staff/me', { token: pemilik.token }), 200);
    expect(await hashSandi(kasir.staff.staffId)).toMatch(POLA_BCRYPT_12);
  });

  it('pemilik mengganti sandinya sendiri: sesi yang dipakai tetap, sesi lainnya dihapus', async () => {
    const lain = await masukStaf(pemilik.staff.email);

    harapStatus(await ubah(pemilik.staff.staffId, { password: SANDI_BARU }), 200);

    harapStatus(await api.get('/api/staff/me', { token: pemilik.token }), 200);
    harapGalat(await api.get('/api/staff/me', { token: lain.token }), 401, 'unauthenticated');
    expect(await jumlahBaris('staff_sessions', 'staff_id = ?', [pemilik.staff.staffId])).toBe(1);
    expect(await jumlahBaris('staff_sessions', 'token_hash = ?', [sha256Hex(pemilik.token)])).toBe(1);
  });

  it('sandi dan isActive:false sekaligus: aturan nonaktif berlaku, semua sesi dihapus (juga sesi peminta pada diri sendiri)', async () => {
    const kasir = await buatKasir();
    harapStatus(await ubah(kasir.staff.staffId, { password: SANDI_BARU, isActive: false }), 200);
    expect(await jumlahBaris('staff_sessions', 'staff_id = ?', [kasir.staff.staffId])).toBe(0);

    await buatPemilik({ name: 'Pak Budi' });
    const res = await ubah(pemilik.staff.staffId, { password: SANDI_BARU, isActive: false });

    harapStatus(res, 200);
    expect(await jumlahBaris('staff_sessions', 'staff_id = ?', [pemilik.staff.staffId])).toBe(0);
    harapGalat(await api.get('/api/staff/me', { token: pemilik.token }), 401, 'unauthenticated');
  });
});

describe('PATCH /api/staff/{staffId}: pemilik terakhir', () => {
  it('pemilik aktif terakhir menonaktifkan atau menurunkan dirinya (ke kasir atau mekanik) → 409 last_owner, tanpa perubahan', async () => {
    harapGalat(await ubah(pemilik.staff.staffId, { isActive: false }), 409, 'last_owner');
    harapGalat(await ubah(pemilik.staff.staffId, { role: 'cashier' }), 409, 'last_owner');
    harapGalat(await ubah(pemilik.staff.staffId, { role: 'mechanic' }), 409, 'last_owner');
    harapGalat(await ubah(pemilik.staff.staffId, { role: 'cashier', isActive: false, name: 'Nama Lain' }), 409, 'last_owner');

    expect(await stafDb(pemilik.staff.staffId)).toMatchObject({ role: 'owner', aktif: true, name: 'Ibu Sari' });
    harapStatus(await api.get('/api/staff/me', { token: pemilik.token }), 200);
  });

  it('pemilik terakhir boleh mengubah nama, email, dan sandinya sendiri', async () => {
    harapStatus(await ubah(pemilik.staff.staffId, { name: 'Ibu Sari Dewi', email: emailUnik('pemilik'), password: SANDI_BARU }), 200);
  });

  it('pemilik nonaktif tidak dihitung sebagai pemilik yang tersisa', async () => {
    await stafLangsung('Pemilik Lama', { role: 'owner', aktif: false });

    harapGalat(await ubah(pemilik.staff.staffId, { role: 'cashier' }), 409, 'last_owner');
    harapGalat(await ubah(pemilik.staff.staffId, { isActive: false }), 409, 'last_owner');
  });

  it('mengaktifkan pemilik nonaktif lalu menurunkan diri sendiri boleh', async () => {
    const lama = await stafLangsung('Pemilik Lama', { role: 'owner', aktif: false });
    harapStatus(await ubah(lama.staffId, { isActive: true }), 200);

    harapStatus(await ubah(pemilik.staff.staffId, { role: 'cashier' }), 200);
  });

  it('kasir yang dinaikkan menjadi pemilik dihitung: lalu pemilik pertama boleh turun', async () => {
    const kasir = await buatKasir();
    harapStatus(await ubah(kasir.staff.staffId, { role: 'owner' }), 200);

    harapStatus(await ubah(pemilik.staff.staffId, { role: 'mechanic' }), 200);
    harapGalat(await ubah(kasir.staff.staffId, { role: 'cashier' }, kasir.token), 409, 'last_owner');
  });

  it('masih ada pemilik aktif lain: boleh menonaktifkan diri sendiri, balasan 200 tetap dikirim lalu sesinya mati', async () => {
    await buatPemilik({ name: 'Pak Budi' });

    const res = await ubah(pemilik.staff.staffId, { isActive: false });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ role: 'owner', isActive: false });
    harapGalat(await api.get('/api/staff/me', { token: pemilik.token }), 401, 'unauthenticated');
  });

  it('dua pemilik: menurunkan pemilik lain boleh, lalu yang terakhir tidak bisa diturunkan', async () => {
    const kedua = await buatPemilik({ name: 'Pak Budi' });

    harapStatus(await ubah(kedua.staff.staffId, { role: 'cashier' }), 200);

    harapGalat(await ubah(pemilik.staff.staffId, { role: 'cashier' }), 409, 'last_owner');
  });

  it('urutan: 422 mendahului email_taken, email_taken mendahului last_owner', async () => {
    const kasir = (await buatKasir()).staff;

    harapGalat(await ubah(pemilik.staff.staffId, { isActive: false, name: 'x' }), 422, 'validation_failed', { name: 'too_short' });
    harapGalat(await ubah(pemilik.staff.staffId, { email: kasir.email, isActive: false }), 409, 'email_taken');
  });
});

describe('PATCH /api/staff/{staffId}: validasi dan urutan', () => {
  const KASUS_PATCH: Array<[string, Record<string, unknown>, Record<string, string>]> = [
    ['null pada name/email/password/role', { name: null, email: null, password: null, role: null }, { name: 'required', email: 'required', password: 'required', role: 'required' }],
    ['teks kosong pada name/email/password/role', { name: ' ', email: '', password: '', role: '' }, { name: 'required', email: 'required', password: 'required', role: 'required' }],
    ['isActive null', { isActive: null }, { isActive: 'invalid_type' }],
    ['isActive teks "false"', { isActive: 'false' }, { isActive: 'invalid_type' }],
    ['isActive angka 0', { isActive: 0 }, { isActive: 'invalid_type' }],
    ['tipe salah pada semua field', { name: 1, email: true, password: 12345678, role: 1, isActive: 'true' }, { name: 'invalid_type', email: 'invalid_type', password: 'invalid_type', role: 'invalid_type', isActive: 'invalid_type' }],
    ['nama satu huruf', { name: 'x' }, { name: 'too_short' }],
    ['nama 101 karakter', { name: 'n'.repeat(101) }, { name: 'too_long' }],
    ['email tak sah', { email: 'bukan email' }, { email: 'invalid_format' }],
    ['email non-ASCII', { email: 'josé@contoh.id' }, { email: 'invalid_format' }],
    ['email lebih dari 254 karakter', { email: `${'a'.repeat(245)}@contoh.id` }, { email: 'too_long' }],
    ['sandi 7 byte', { password: '1234567' }, { password: 'too_short' }],
    ['sandi 73 byte', { password: 'a'.repeat(73) }, { password: 'too_long' }],
    ['sandi memuat NUL', { password: 'Sandi\u0000Baru1' }, { password: 'invalid_format' }],
    ['peran tak dikenal', { role: 'kitchen' }, { role: 'invalid_format' }],
    ['peran Mechanic (dibandingkan persis)', { role: 'Mechanic' }, { role: 'invalid_format' }],
    ['peran berspasi (tidak dipangkas)', { role: 'owner ' }, { role: 'invalid_format' }],
  ];

  it.each(KASUS_PATCH)('%s → 422, tanpa perubahan', async (_nama, isi, fields) => {
    const kasir = (await buatKasir()).staff;
    const hashLama = await hashSandi(kasir.staffId);

    harapGalat(await ubah(kasir.staffId, isi), 422, 'validation_failed', fields);
    harapSetara(await stafApi(kasir.staffId), kasir);
    expect(await hashSandi(kasir.staffId)).toBe(hashLama);
  });

  it('staf tidak ada, UUID huruf besar, atau bukan UUID → 404, sebelum 422', async () => {
    const kasir = (await buatKasir()).staff;

    harapGalat(await ubah(randomUUID(), { name: 'Baru' }), 404, 'not_found');
    harapGalat(await ubah(kasir.staffId.toUpperCase(), { name: 'Baru' }), 404, 'not_found');
    harapGalat(await ubah('bukan-uuid', { name: 'Baru' }), 404, 'not_found');
    harapGalat(await ubah(randomUUID(), { name: 1 }), 404, 'not_found');
  });

  it('kasir dan mekanik → 403, juga untuk dirinya sendiri dan untuk staf yang tidak ada (403 sebelum 404)', async () => {
    const kasir = await buatKasir();
    const mekanik = await buatMekanik();

    harapGalat(await ubah(kasir.staff.staffId, { name: 'Kasir Baru' }, kasir.token), 403, 'forbidden');
    harapGalat(await ubah(mekanik.staff.staffId, { role: 'owner' }, mekanik.token), 403, 'forbidden');
    harapGalat(await ubah(pemilik.staff.staffId, { isActive: false }, kasir.token), 403, 'forbidden');
    harapGalat(await ubah(randomUUID(), { name: 1 }, mekanik.token), 403, 'forbidden');
    expect(await stafDb(mekanik.staff.staffId)).toMatchObject({ role: 'mechanic', aktif: true });
  });

  it('urutan: 413 → 400 → 401 → 403 → 404', async () => {
    const kasir = await buatKasir();
    const id = randomUUID();

    harapGalat(await api.patch(`/api/staff/${id}`, { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.patch(`/api/staff/${id}`, { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.patch(`/api/staff/${id}`, { token: kasir.token, mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.patch(`/api/staff/${id}`, { token: pemilik.token, mentah: '[]' }), 400, 'bad_request');
    harapGalat(await api.patch(`/api/staff/${pemilik.staff.staffId}`, { token: pemilik.token, mentah: 'null' }), 400, 'bad_request');
    harapGalat(await api.patch(`/api/staff/${id}`, { token: pemilik.token, biner: badanUtf8Rusak() }), 400, 'bad_request');
    harapGalat(await ubah(id, {}, undefined), 401, 'unauthenticated');
    harapGalat(await ubah(id, {}, tokenAcak()), 401, 'unauthenticated');
    harapGalat(await ubah(id, {}, kasir.token), 403, 'forbidden');
    harapGalat(await ubah(id, {}), 404, 'not_found');
  });
});

describe('perubahan staf serentak', () => {
  async function duaPemilik(): Promise<[SesiStaf, SesiStaf]> {
    await kosongkanStaf();
    return [await buatPemilik({ name: 'Pemilik A' }), await buatPemilik({ name: 'Pemilik B' })];
  }

  // Tepat satu perubahan berhasil. Yang kalah 409 last_owner, atau 403/401 bila
  // perubahan pemenang sudah berlaku sebelum permintaannya diautentikasi.
  async function harapSatuPemenang(ra: Respons, rb: Respons): Promise<void> {
    const kalah = [ra, rb].find((r) => r.status !== 200);
    expect([ra.status, rb.status].filter((s) => s === 200)).toHaveLength(1);
    expect([401, 403, 409]).toContain(kalah?.status);
    if (kalah?.status === 409) {
      harapGalat(kalah, 409, 'last_owner');
    }
    expect(await jumlahBaris('staff', "role = 'owner' AND is_active = TRUE")).toBe(1);
  }

  it('dua pemilik terakhir saling menurunkan serentak → tepat satu 200', async () => {
    for (let ronde = 0; ronde < 3; ronde++) {
      const [a, b] = await duaPemilik();

      const [ra, rb] = await Promise.all([ubah(b.staff.staffId, { role: 'cashier' }, a.token), ubah(a.staff.staffId, { role: 'mechanic' }, b.token)]);

      await harapSatuPemenang(ra, rb);
    }
  });

  it('dua pemilik terakhir saling menonaktifkan serentak → tepat satu 200', async () => {
    for (let ronde = 0; ronde < 2; ronde++) {
      const [a, b] = await duaPemilik();

      const [ra, rb] = await Promise.all([ubah(b.staff.staffId, { isActive: false }, a.token), ubah(a.staff.staffId, { isActive: false }, b.token)]);

      await harapSatuPemenang(ra, rb);
    }
  });

  it('dua pemilik terakhir menurunkan diri sendiri serentak → tepat satu 200', async () => {
    for (let ronde = 0; ronde < 2; ronde++) {
      const [a, b] = await duaPemilik();

      const [ra, rb] = await Promise.all([ubah(a.staff.staffId, { role: 'cashier' }, a.token), ubah(b.staff.staffId, { isActive: false }, b.token)]);

      await harapSatuPemenang(ra, rb);
    }
  });

  it('dua PATCH serentak pada staf yang sama dengan field berbeda sama-sama bertahan', async () => {
    const id = await Promise.all(Array.from({ length: 4 }, (_, i) => stafLangsung(`Kasir ${i}`).then((s) => s.staffId)));

    const hasil = await Promise.all(id.flatMap((staffId, i) => [ubah(staffId, { name: `Nama Baru ${i}` }), ubah(staffId, { role: 'mechanic' })]));

    expect(hasil.map((r) => r.status)).toEqual(Array(8).fill(200));
    for (const [i, staffId] of id.entries()) {
      expect(await stafDb(staffId)).toMatchObject({ name: `Nama Baru ${i}`, role: 'mechanic' });
    }
  });

  it('dua PATCH serentak ke email yang sama → satu 200 dan satu 409 email_taken', async () => {
    const x = await stafLangsung('Kasir X');
    const y = await stafLangsung('Mekanik Y', { role: 'mechanic' });
    const email = emailUnik('rebut');

    const hasil = await Promise.all([ubah(x.staffId, { email }), ubah(y.staffId, { email })]);

    expect(hasil.map((r) => r.status).sort()).toEqual([200, 409]);
    harapGalat(hasil.find((r) => r.status === 409) as Respons, 409, 'email_taken');
    expect(await jumlahBaris('staff', 'email = ?', [email])).toBe(1);
  });

  it('POST dan PATCH serentak dengan email yang sama → satu berhasil, satu 409 email_taken', async () => {
    const x = await stafLangsung('Kasir X');
    const email = emailUnik('rebut');

    const [dibuat, diubah] = await Promise.all([
      api.post('/api/staff', { token: pemilik.token, json: { name: 'Baru', email, password: SANDI_UJI, role: 'mechanic' } }),
      ubah(x.staffId, { email }),
    ]);

    expect([dibuat.status === 201, diubah.status === 200].filter(Boolean)).toHaveLength(1);
    harapGalat(dibuat.status === 201 ? diubah : dibuat, 409, 'email_taken');
    expect(await jumlahBaris('staff', 'email = ?', [email])).toBe(1);
  });
});
