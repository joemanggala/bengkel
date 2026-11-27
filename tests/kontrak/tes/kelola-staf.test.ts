// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import { buatKasir, buatMekanik, buatPemilik, emailUnik, masukStaf, SANDI_UJI, type SesiStaf } from '../src/data';
import { geserSesi, jumlahBaris, kosongkanStaf } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { badanUtf8Rusak, JSON_RUSAK, jsonLebihDariSatuMib, tokenAcak } from './pembantu-fondasi';
import { hashSandi, KUNCI_STAF, masukDengan, POLA_BCRYPT_12, stafLangsung } from './pembantu-staf';

// GET dan POST /api/staff. PATCH ada di kelola-staf-2, daftar mekanik dan
// akibatnya pada SPK di kelola-staf-3. Setiap tes mulai dari tabel staf
// kosong lalu satu pemilik, supaya jumlah dan urutan staf pasti.

let pemilik: SesiStaf;

function buat(isi: Record<string, unknown> = {}, token: string | undefined = pemilik.token): Promise<Respons> {
  return api.post('/api/staff', {
    token,
    json: { name: 'Rina Kasir', email: emailUnik('kasir'), password: SANDI_UJI, role: 'cashier', ...isi },
  });
}

function daftar(token: string | undefined = pemilik.token): Promise<Respons> {
  return api.get('/api/staff', { token });
}

beforeEach(async () => {
  await kosongkanStaf();
  pemilik = await buatPemilik({ name: 'Ibu Sari' });
});

describe('GET /api/staff', () => {
  it('semua staf ketiga peran termasuk yang nonaktif, tanpa meta, urut nama menurut collation (huruf besar/kecil dan aksen tidak membedakan)', async () => {
    await stafLangsung('citra', { role: 'mechanic' });
    await stafLangsung('Budi', { aktif: false });
    await stafLangsung('andi', { role: 'owner' });
    await stafLangsung('Fajar', { role: 'mechanic', aktif: false });
    await stafLangsung('Eka');
    await stafLangsung('Édi', { role: 'mechanic' });

    const res = await daftar();

    harapStatus(res, 200);
    expect(Object.keys(res.body)).toEqual(['data']);
    expect(res.body.data.map((s: any) => s.name)).toEqual(['andi', 'Budi', 'citra', 'Édi', 'Eka', 'Fajar', 'Ibu Sari']);
    expect(res.body.data.find((s: any) => s.name === 'Budi')).toMatchObject({ role: 'cashier', isActive: false });
    expect(res.body.data.find((s: any) => s.name === 'Fajar')).toMatchObject({ role: 'mechanic', isActive: false });
    expect(res.body.data.find((s: any) => s.name === 'citra')).toMatchObject({ role: 'mechanic', isActive: true });
    // Boolean JSON sungguhan, bukan 0/1 dari kolom BOOLEAN MySQL; tanpa hash sandi.
    expect(res.body.data.map((s: any) => typeof s.isActive)).toEqual(Array(7).fill('boolean'));
    for (const staf of res.body.data) {
      expect(Object.keys(staf).sort()).toEqual(KUNCI_STAF);
    }
  });

  it('nama yang sama menurut collation diurutkan menurut staffId naik', async () => {
    const id = [
      (await stafLangsung('Dewi')).staffId,
      (await stafLangsung('dewi', { role: 'mechanic' })).staffId,
      (await stafLangsung('Déwi', { aktif: false })).staffId,
      (await stafLangsung('DEWI', { role: 'owner' })).staffId,
    ];

    const res = await daftar();

    const urutan = res.body.data.filter((s: any) => id.includes(s.staffId)).map((s: any) => s.staffId);
    expect(urutan).toEqual([...id].sort());
  });

  it('kasir dan mekanik → 403; tanpa token, token sampah, atau sesi kedaluwarsa → 401', async () => {
    harapGalat(await daftar((await buatKasir()).token), 403, 'forbidden');
    harapGalat(await daftar((await buatMekanik()).token), 403, 'forbidden');
    harapGalat(await api.get('/api/staff'), 401, 'unauthenticated');
    harapGalat(await daftar(tokenAcak()), 401, 'unauthenticated');
    const lewat = await masukStaf(pemilik.staff.email);
    await geserSesi(lewat.token, { kedaluwarsaDetik: -60, terakhirDipakaiDetikLalu: 7200 });
    harapGalat(await daftar(lewat.token), 401, 'unauthenticated');
  });
});

describe('POST /api/staff', () => {
  it.each(['owner', 'cashier', 'mechanic'] as const)('201 untuk peran %s: staf aktif, nama dipangkas, email dikecilkan; staf baru bisa masuk', async (role) => {
    const lokal = emailUnik('Staf.Baru').split('@')[0] ?? '';
    const res = await buat({ name: '  Rina  ', email: ` ${lokal}@Contoh.ID `, role });

    harapStatus(res, 201);
    const email = `${lokal.toLowerCase()}@contoh.id`;
    expect(Object.keys(res.body.data).sort()).toEqual(KUNCI_STAF);
    expect(res.body.data).toMatchObject({ name: 'Rina', email, role, isActive: true });
    const sesi = await masukStaf(email);
    harapSetara(sesi.staff, res.body.data);
    expect((await daftar()).body.data.map((s: any) => s.staffId)).toContain(res.body.data.staffId);
  });

  it('pemangkasan nama hanya membuang spasi, tab, CR, LF; NBSP dan spasi lebar penuh dibiarkan', async () => {
    const pangkas = await buat({ name: '\t\r\n Rina Wati \r\n\t' });
    harapStatus(pangkas, 201);
    expect(pangkas.body.data.name).toBe('Rina Wati');

    const nbsp = await buat({ name: ' Rina ' });
    harapStatus(nbsp, 201);
    expect(nbsp.body.data.name).toBe(' Rina ');
    const lebar = await buat({ name: '　Rina　' });
    harapStatus(lebar, 201);
    expect(lebar.body.data.name).toBe('　Rina　');
  });

  it('isActive, staffId, createdAt, dan field lain dari badan diabaikan', async () => {
    const res = await buat({ role: 'mechanic', isActive: false, staffId: 'x', createdAt: '2000-01-01T00:00:00Z', lain: 1 });

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ role: 'mechanic', isActive: true });
    expect(res.body.data.staffId).not.toBe('x');
    expect(res.body.data.createdAt).not.toBe('2000-01-01T00:00:00Z');
  });

  it('sandi disimpan bcrypt cost 12 yang bisa diperiksa pustaka lain, bukan teks asli', async () => {
    const res = await buat({ password: 'Sandi Kasir 1' });
    const hash = await hashSandi(res.body.data.staffId);

    expect(hash).toMatch(POLA_BCRYPT_12);
    expect(await bcrypt.compare('Sandi Kasir 1', hash)).toBe(true);
  });

  it('email yang sudah dipakai (beda huruf, berspasi, termasuk staf nonaktif dan mekanik) → 409 email_taken, tanpa staf baru', async () => {
    const lama = await stafLangsung('Lama', { aktif: false });
    const mekanik = await stafLangsung('Mekanik', { role: 'mechanic' });

    harapGalat(await buat({ email: lama.email.toUpperCase() }), 409, 'email_taken');
    harapGalat(await buat({ email: `  ${lama.email.replace('contoh', 'Contoh')}\n` }), 409, 'email_taken');
    harapGalat(await buat({ email: pemilik.staff.email, role: 'owner' }), 409, 'email_taken');
    harapGalat(await buat({ email: mekanik.email, role: 'mechanic' }), 409, 'email_taken');
    expect(await jumlahBaris('staff')).toBe(3);
  });

  it('validasi (422) lebih dulu dari bentrok email (409)', async () => {
    harapGalat(await buat({ email: pemilik.staff.email, name: '' }), 422, 'validation_failed', { name: 'required' });
    harapGalat(await buat({ email: pemilik.staff.email, role: 'admin' }), 422, 'validation_failed', { role: 'invalid_format' });
  });

  it('field tidak dikirim atau null → required; tipe salah → invalid_type; semua field dilaporkan sekaligus', async () => {
    const wajib = { name: 'required', email: 'required', password: 'required', role: 'required' };
    harapGalat(await api.post('/api/staff', { token: pemilik.token, json: {} }), 422, 'validation_failed', wajib);
    harapGalat(
      await api.post('/api/staff', { token: pemilik.token, json: { name: null, email: null, password: null, role: null } }),
      422,
      'validation_failed',
      wajib,
    );
    const salahTipe = { name: 'invalid_type', email: 'invalid_type', password: 'invalid_type', role: 'invalid_type' };
    harapGalat(await buat({ name: 1, email: 2, password: true, role: 3 }), 422, 'validation_failed', salahTipe);
    harapGalat(await buat({ name: [], email: {}, password: ['x'], role: ['owner'] }), 422, 'validation_failed', salahTipe);
    harapGalat(await buat({ name: 'a', email: 'bukan-email', password: 'pendek', role: 'kitchen' }), 422, 'validation_failed', {
      name: 'too_short',
      email: 'invalid_format',
      password: 'too_short',
      role: 'invalid_format',
    });
  });

  it('angka raksasa di field teks → invalid_type', async () => {
    const mentah = `{"name":1e400,"email":"${emailUnik('raksasa')}","password":"${SANDI_UJI}","role":"cashier"}`;

    harapGalat(await api.post('/api/staff', { token: pemilik.token, mentah }), 422, 'validation_failed', { name: 'invalid_type' });
  });

  const KASUS_422: Array<[string, Record<string, unknown>, Record<string, string>]> = [
    ['peran tak dikenal admin', { role: 'admin' }, { role: 'invalid_format' }],
    ['peran tak dikenal kitchen', { role: 'kitchen' }, { role: 'invalid_format' }],
    ['peran Mechanic (dibandingkan persis)', { role: 'Mechanic' }, { role: 'invalid_format' }],
    ['peran OWNER huruf besar', { role: 'OWNER' }, { role: 'invalid_format' }],
    ['peran berspasi (tidak dipangkas)', { role: ' cashier ' }, { role: 'invalid_format' }],
    ['peran hanya spasi (bukan kosong)', { role: '  ' }, { role: 'invalid_format' }],
    ['peran kosong', { role: '' }, { role: 'required' }],
    ['nama kosong setelah dipangkas', { name: ' \t\r\n ' }, { name: 'required' }],
    ['nama satu huruf setelah dipangkas', { name: ' x ' }, { name: 'too_short' }],
    ['nama satu emoji (1 code point)', { name: '😀' }, { name: 'too_short' }],
    ['nama 101 karakter', { name: 'n'.repeat(101) }, { name: 'too_long' }],
    ['nama 101 emoji', { name: '😀'.repeat(101) }, { name: 'too_long' }],
    ['email kosong', { email: '' }, { email: 'required' }],
    ['email hanya spasi', { email: '   ' }, { email: 'required' }],
    ['email dengan spasi di tengah', { email: 'rina kasir@contoh.id' }, { email: 'invalid_format' }],
    ['email non-ASCII', { email: 'josé@contoh.id' }, { email: 'invalid_format' }],
    ['email tanpa domain bertitik', { email: 'rina@contoh' }, { email: 'invalid_format' }],
    ['email tanpa bagian lokal', { email: '@contoh.id' }, { email: 'invalid_format' }],
    ['email dengan label domain kosong', { email: 'rina@contoh..id' }, { email: 'invalid_format' }],
    ['email lebih dari 254 karakter', { email: `${'a'.repeat(245)}@contoh.id` }, { email: 'too_long' }],
    ['sandi kosong', { password: '' }, { password: 'required' }],
    ['sandi 7 spasi (tidak dipangkas, jadi bukan required)', { password: '       ' }, { password: 'too_short' }],
    ['sandi 7 byte', { password: '1234567' }, { password: 'too_short' }],
    ['sandi 73 byte', { password: 'a'.repeat(73) }, { password: 'too_long' }],
    ['sandi 37 huruf é = 74 byte', { password: 'é'.repeat(37) }, { password: 'too_long' }],
    ['sandi memuat NUL', { password: 'abc\u0000defgh' }, { password: 'invalid_format' }],
    ['sandi pendek bermuatan NUL (panjang dinilai dulu)', { password: 'a\u0000' }, { password: 'too_short' }],
    ['sandi panjang bermuatan NUL (panjang dinilai dulu)', { password: `${'a'.repeat(72)}\u0000x` }, { password: 'too_long' }],
  ];

  it.each(KASUS_422)('%s → 422, tanpa staf baru', async (_nama, isi, fields) => {
    harapGalat(await buat(isi), 422, 'validation_failed', fields);
    expect(await jumlahBaris('staff')).toBe(1);
  });

  it('batas yang sah diterima: nama 2 huruf dan 100 emoji, sandi 8 byte, 72 byte (36 huruf é), dan 8 spasi, email tepat 254 karakter', async () => {
    harapStatus(await buat({ name: 'Al' }), 201);
    harapStatus(await buat({ name: '😀'.repeat(100), password: 'a'.repeat(72) }), 201);
    harapStatus(await buat({ password: '12345678' }), 201);
    const aksen = emailUnik('aksen');
    harapStatus(await buat({ email: aksen, password: 'é'.repeat(36) }), 201);
    harapStatus(await masukDengan(aksen, 'é'.repeat(36)), 200);
    const spasi = emailUnik('spasi');
    harapStatus(await buat({ email: spasi, password: '        ' }), 201);
    harapStatus(await masukDengan(spasi, '        '), 200);
    const panjang = `${'a'.repeat(244)}@contoh.id`;
    const res = await buat({ email: panjang });
    harapStatus(res, 201);
    expect(res.body.data.email).toBe(panjang);
  });

  it('email dengan karakter khusus yang sah diterima dan hanya A-Z yang dikecilkan', async () => {
    const res = await buat({ email: "Dewi.O'Brien+Kasir_1#{x}@Sub-Domain.Contoh.ID" });

    harapStatus(res, 201);
    expect(res.body.data.email).toBe("dewi.o'brien+kasir_1#{x}@sub-domain.contoh.id");
  });

  it('kasir dan mekanik → 403 dan tidak ada staf dibuat (termasuk mencoba membuat pemilik)', async () => {
    const kasir = await buatKasir();
    const mekanik = await buatMekanik();

    harapGalat(await buat({ role: 'owner' }, kasir.token), 403, 'forbidden');
    harapGalat(await buat({ role: 'mechanic' }, mekanik.token), 403, 'forbidden');
    expect(await jumlahBaris('staff')).toBe(3);
  });

  it('urutan: 413 → 400 → 401 → 403 → 422 → 409', async () => {
    const kasir = await buatKasir();
    const bentrok = { name: 'Rina', email: pemilik.staff.email, password: SANDI_UJI, role: 'cashier' };

    harapGalat(await api.post('/api/staff', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.post('/api/staff', { token: kasir.token, mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.post('/api/staff', { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.post('/api/staff', { token: kasir.token, mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.post('/api/staff', { token: pemilik.token, mentah: '[]' }), 400, 'bad_request');
    harapGalat(await api.post('/api/staff', { token: pemilik.token, mentah: '' }), 400, 'bad_request');
    harapGalat(await api.post('/api/staff', { biner: badanUtf8Rusak() }), 400, 'bad_request');
    harapGalat(await api.post('/api/staff', { json: {} }), 401, 'unauthenticated');
    harapGalat(await api.post('/api/staff', { token: kasir.token, json: {} }), 403, 'forbidden');
    harapGalat(await api.post('/api/staff', { token: kasir.token, json: bentrok }), 403, 'forbidden');
    harapGalat(await api.post('/api/staff', { token: pemilik.token, json: { ...bentrok, name: 'x' } }), 422, 'validation_failed', { name: 'too_short' });
    harapGalat(await api.post('/api/staff', { token: pemilik.token, json: bentrok }), 409, 'email_taken');
  });

  it('serentak dengan email sama → satu 201 dan sisanya 409 email_taken (dua dan empat permintaan)', async () => {
    for (const jumlah of [2, 4]) {
      const email = emailUnik('kembar');
      const semua = await Promise.all(Array.from({ length: jumlah }, (_, i) => buat({ email, role: (['owner', 'cashier', 'mechanic'] as const)[i % 3] })));

      expect(semua.map((r) => r.status).sort()).toEqual([201, ...Array(jumlah - 1).fill(409)]);
      for (const res of semua.filter((r) => r.status === 409)) {
        harapGalat(res, 409, 'email_taken');
      }
      expect(await jumlahBaris('staff', 'email = ?', [email])).toBe(1);
    }
  });

  it('serentak dengan email berbeda semuanya 201', async () => {
    const semua = await Promise.all(Array.from({ length: 5 }, (_, i) => buat({ role: (['owner', 'cashier', 'mechanic'] as const)[i % 3] })));

    expect(semua.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect(await jumlahBaris('staff')).toBe(6);
  });
});
