// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import fixtur from '../fixtur/bcrypt.json';
import { harapSetara } from '../src/banding';
import { emailUnik, SANDI_UJI } from '../src/data';
import { bacaSatu, jumlahBaris, kosongkanStaf, sha256Hex, sisipkanStaf, waktuSesi } from '../src/db';
import { bacaEnv } from '../src/env';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { badanUtf8Rusak, JSON_RUSAK, jsonLebihDariSatuMib, SEHARI } from './pembantu-fondasi';

// Berkas ini punya dua mode, sesuai env SETUP_TOKEN backend yang diuji:
// diisi (setup hidup) atau kosong (setup mati, 403 setup_disabled). Harness
// membaca nilai yang sama dari env-nya sendiri, jadi hanya satu mode yang
// berjalan per eksekusi. Jalankan dua kali untuk membuktikan keduanya.
const { setupToken } = bacaEnv();
const setupAktif = setupToken !== '';

function pasang(ubah: Record<string, unknown> = {}): Promise<Respons> {
  return api.post('/api/setup', {
    json: { token: setupToken, name: 'Pemilik Bengkel', email: emailUnik('pemilik'), password: SANDI_UJI, ...ubah },
  });
}

async function butuhSetup(): Promise<boolean> {
  const res = await api.get('/api/setup');
  harapStatus(res, 200);
  return res.body.data.needsSetup;
}

// Setiap tes di berkas ini mulai dari tabel staf yang kosong.
beforeEach(async () => {
  await kosongkanStaf();
});

describe('GET /api/setup (tidak bergantung pada SETUP_TOKEN)', () => {
  it('needsSetup true selama tabel staf kosong, tanpa token', async () => {
    expect(await butuhSetup()).toBe(true);
  });

  it('needsSetup false bila ada staf, termasuk bila satu-satunya staf nonaktif', async () => {
    await sisipkanStaf({ name: 'Kasir Lama', email: emailUnik('kasir'), role: 'cashier', passwordHash: fixtur.hash.node, aktif: false });

    expect(await butuhSetup()).toBe(false);
  });

  it('needsSetup false bila satu-satunya staf adalah mekanik nonaktif', async () => {
    await sisipkanStaf({ name: 'Mekanik Lama', email: emailUnik('mekanik'), role: 'mechanic', passwordHash: fixtur.hash.node, aktif: false });

    expect(await butuhSetup()).toBe(false);
  });

  it('needsSetup false bila ada pemilik aktif', async () => {
    await sisipkanStaf({ name: 'Pemilik Lama', email: emailUnik('pemilik'), role: 'owner', passwordHash: fixtur.hash.node });

    expect(await butuhSetup()).toBe(false);
  });
});

// Urutan di spec: 413 → 400 → (403 setup_disabled) → 422 → ... Dua langkah
// pertama berlaku di kedua mode, jadi dites tanpa melihat SETUP_TOKEN.
describe('POST /api/setup: badan rusak (kedua mode)', () => {
  it('JSON rusak, bukan objek, kosong → 400 bad_request', async () => {
    for (const mentah of [JSON_RUSAK, '[]', '"teks"', '123', 'null', '']) {
      harapGalat(await api.post('/api/setup', { mentah }), 400, 'bad_request');
    }
    expect(await jumlahBaris('staff')).toBe(0);
  });

  it('badan dengan byte UTF-8 tidak sah → 400 bad_request', async () => {
    harapGalat(await api.post('/api/setup', { biner: badanUtf8Rusak() }), 400, 'bad_request');
  });

  it('badan lebih dari 1 MiB → 413 payload_too_large, mengalahkan 400 dan 403', async () => {
    harapGalat(await api.post('/api/setup', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.post('/api/setup', { mentah: `${JSON_RUSAK}${'a'.repeat(1024 * 1024 + 10)}` }), 413, 'payload_too_large');
    expect(await jumlahBaris('staff')).toBe(0);
  });
});

describe.runIf(setupAktif)('POST /api/setup (SETUP_TOKEN diisi)', () => {
  it('201: pemilik aktif dibuat dan langsung masuk; nama dipangkas, email dikecilkan', async () => {
    const lokal = emailUnik('Pemilik.Utama').split('@')[0] ?? '';
    const res = await pasang({ name: '  Ibu Sari  ', email: `  ${lokal}@Contoh.ID ` });

    harapStatus(res, 201);
    const email = `${lokal.toLowerCase()}@contoh.id`;
    expect(res.body.data.staff).toMatchObject({ name: 'Ibu Sari', email, role: 'owner', isActive: true });
    expect(res.body.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const me = await api.get('/api/staff/me', { token: res.body.data.token });
    harapStatus(me, 200);
    harapSetara(me.body.data, res.body.data.staff);
    expect(await butuhSetup()).toBe(false);
  });

  it('pemangkasan nama hanya membuang spasi, tab, CR, LF; karakter spasi lain (NBSP) dibiarkan', async () => {
    const res = await pasang({ name: '\t\r\n Ibu Sari \r\n\t' });
    harapStatus(res, 201);
    expect(res.body.data.staff.name).toBe('Ibu Sari');

    await kosongkanStaf();
    const nbsp = await pasang({ name: ' Ibu Sari ' });
    harapStatus(nbsp, 201);
    expect(nbsp.body.data.staff.name).toBe(' Ibu Sari ');
  });

  it('role dan isActive dari badan diabaikan: selalu pemilik dan aktif; field lain diabaikan', async () => {
    const res = await pasang({ role: 'mechanic', isActive: false, staffId: 'x', createdAt: '2000-01-01T00:00:00Z', lain: 1 });

    harapStatus(res, 201);
    expect(res.body.data.staff).toMatchObject({ role: 'owner', isActive: true });
    expect(res.body.data.staff.staffId).not.toBe('x');
  });

  it('sesi tersimpan sebagai sha256 hex token dengan masa berlaku 30 hari; sandi bcrypt cost 12', async () => {
    const res = await pasang();
    const { token, staff } = res.body.data;

    expect(await bacaSatu('SELECT staff_id FROM staff_sessions WHERE token_hash = ?', [sha256Hex(token)])).toEqual({
      staff_id: staff.staffId,
    });
    const waktu = await waktuSesi(token);
    expect(waktu?.sisa).toBeGreaterThanOrEqual(30 * SEHARI - 300);
    expect(waktu?.sisa).toBeLessThanOrEqual(30 * SEHARI + 300);
    const baris = await bacaSatu<{ password_hash: string }>('SELECT password_hash FROM staff WHERE staff_id = ?', [staff.staffId]);
    expect(baris?.password_hash).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    expect(await bcrypt.compare(SANDI_UJI, baris?.password_hash ?? '')).toBe(true);
  });

  it('pemilik hasil setup bisa masuk lagi lewat POST /api/staff/login dengan email huruf besar', async () => {
    const email = emailUnik('pemilik');
    harapStatus(await pasang({ email }), 201);

    harapStatus(await api.post('/api/staff/login', { json: { email: email.toUpperCase(), password: SANDI_UJI } }), 200);
  });

  it('sudah ada staf → 409 already_set_up, walau token benar; tidak ada staf tambahan', async () => {
    harapStatus(await pasang(), 201);

    harapGalat(await pasang(), 409, 'already_set_up');
    expect(await jumlahBaris('staff')).toBe(1);
  });

  it('staf yang ada hanya mekanik nonaktif → tetap 409', async () => {
    await sisipkanStaf({ name: 'Mekanik', email: emailUnik('mekanik'), role: 'mechanic', passwordHash: fixtur.hash.node, aktif: false });

    harapGalat(await pasang(), 409, 'already_set_up');
    expect(await jumlahBaris('staff')).toBe(1);
  });

  it('token salah → 403 setup_token_invalid dan tidak ada staf yang dibuat', async () => {
    harapGalat(await pasang({ token: `${setupToken}x` }), 403, 'setup_token_invalid');
    harapGalat(await pasang({ token: setupToken.slice(0, -1) }), 403, 'setup_token_invalid');
    harapGalat(await pasang({ token: 'token-lain-sama-sekali' }), 403, 'setup_token_invalid');

    expect(await jumlahBaris('staff')).toBe(0);
    expect(await butuhSetup()).toBe(true);
  });

  it('token di badan tidak dipangkas: token benar berspasi, bertab, atau berakhir CRLF → 403; token hanya spasi → 403 (bukan required)', async () => {
    harapGalat(await pasang({ token: `${setupToken} ` }), 403, 'setup_token_invalid');
    harapGalat(await pasang({ token: ` ${setupToken}` }), 403, 'setup_token_invalid');
    harapGalat(await pasang({ token: `${setupToken}\r\n` }), 403, 'setup_token_invalid');
    harapGalat(await pasang({ token: '\t' }), 403, 'setup_token_invalid');
    harapGalat(await pasang({ token: '   ' }), 403, 'setup_token_invalid');
  });

  it('token salah diperiksa sebelum already_set_up', async () => {
    harapStatus(await pasang(), 201);

    harapGalat(await pasang({ token: 'token-salah-tapi-panjang' }), 403, 'setup_token_invalid');
  });

  it('validasi lebih dulu dari token dan dari already_set_up: field rusak → 422', async () => {
    harapGalat(await pasang({ token: 'salah', name: 'a' }), 422, 'validation_failed', { name: 'too_short' });
    harapStatus(await pasang(), 201);

    harapGalat(await pasang({ name: 'a' }), 422, 'validation_failed', { name: 'too_short' });
  });

  it('field tidak dikirim atau null → required; tipe salah → invalid_type', async () => {
    const wajib = { token: 'required', name: 'required', email: 'required', password: 'required' };
    harapGalat(await api.post('/api/setup', { json: {} }), 422, 'validation_failed', wajib);
    harapGalat(
      await api.post('/api/setup', { json: { token: null, name: null, email: null, password: null } }),
      422,
      'validation_failed',
      wajib,
    );
    harapGalat(
      await api.post('/api/setup', { json: { token: 1, name: 2, email: false, password: 12345678 } }),
      422,
      'validation_failed',
      { token: 'invalid_type', name: 'invalid_type', email: 'invalid_type', password: 'invalid_type' },
    );
    harapGalat(
      await api.post('/api/setup', { json: { token: [], name: {}, email: ['a@b.id'], password: true } }),
      422,
      'validation_failed',
      { token: 'invalid_type', name: 'invalid_type', email: 'invalid_type', password: 'invalid_type' },
    );
  });

  it('semua field yang gagal dilaporkan sekaligus', async () => {
    harapGalat(await pasang({ token: 1, name: 'a', email: 'bukan-email', password: 'pendek' }), 422, 'validation_failed', {
      token: 'invalid_type',
      name: 'too_short',
      email: 'invalid_format',
      password: 'too_short',
    });
  });

  const KASUS_422: Array<[string, Record<string, unknown>, Record<string, string>]> = [
    ['token kosong', { token: '' }, { token: 'required' }],
    ['nama kosong setelah dipangkas', { name: " \t\r\n " }, { name: 'required' }],
    ['nama satu huruf setelah dipangkas', { name: ' a ' }, { name: 'too_short' }],
    ['nama satu emoji (1 code point, 2 unit UTF-16)', { name: '😀' }, { name: 'too_short' }],
    ['nama 101 karakter', { name: 'a'.repeat(101) }, { name: 'too_long' }],
    ['nama 101 emoji (code point, bukan unit UTF-16)', { name: '😀'.repeat(101) }, { name: 'too_long' }],
    ['email kosong setelah dipangkas', { email: '  ' }, { email: 'required' }],
    ['email tanpa domain bertitik', { email: 'sari@contoh' }, { email: 'invalid_format' }],
    ['email non-ASCII', { email: 'josé@contoh.id' }, { email: 'invalid_format' }],
    ['email dengan spasi di tengah', { email: 'sari ibu@contoh.id' }, { email: 'invalid_format' }],
    ['email tanpa bagian lokal', { email: '@contoh.id' }, { email: 'invalid_format' }],
    ['email dengan label domain kosong', { email: 'sari@contoh..id' }, { email: 'invalid_format' }],
    ['email lebih dari 254 karakter', { email: `${'a'.repeat(246)}@contoh.id` }, { email: 'too_long' }],
    ['sandi kosong', { password: '' }, { password: 'required' }],
    ['sandi 7 spasi (tidak dipangkas, jadi bukan required)', { password: '       ' }, { password: 'too_short' }],
    ['sandi 7 byte', { password: '1234567' }, { password: 'too_short' }],
    ['sandi 73 byte', { password: 'a'.repeat(73) }, { password: 'too_long' }],
    ['sandi 37 huruf é = 74 byte', { password: 'é'.repeat(37) }, { password: 'too_long' }],
    ['sandi memuat NUL', { password: 'abc\u0000defg' }, { password: 'invalid_format' }],
    ['sandi pendek memuat NUL (panjang dinilai sebelum NUL)', { password: 'a\u0000' }, { password: 'too_short' }],
    ['sandi panjang memuat NUL (panjang dinilai sebelum NUL)', { password: `${'a'.repeat(72)}\u0000x` }, { password: 'too_long' }],
  ];

  it.each(KASUS_422)('%s → 422', async (_nama, ubah, fields) => {
    harapGalat(await pasang(ubah), 422, 'validation_failed', fields);
    expect(await jumlahBaris('staff')).toBe(0);
  });

  it('batas yang sah diterima: nama 100 emoji, sandi 72 byte, email dengan karakter khusus', async () => {
    const email = "dewi.o'brien+kasir@sub.contoh.id";
    const res = await pasang({ name: '😀'.repeat(100), email, password: 'é'.repeat(36) });

    harapStatus(res, 201);
    expect(res.body.data.staff.email).toBe(email);
    harapStatus(await api.post('/api/staff/login', { json: { email, password: 'é'.repeat(36) } }), 200);
  });

  it('sandi tidak dipangkas: 8 spasi adalah sandi sah', async () => {
    const email = emailUnik('spasi');
    harapStatus(await pasang({ email, password: '        ' }), 201);

    harapStatus(await api.post('/api/staff/login', { json: { email, password: '        ' } }), 200);
  });

  it('enam permintaan bersamaan (email berbeda) → tepat satu 201 dan lima 409, satu pemilik dan satu sesi', async () => {
    const semua = await Promise.all(Array.from({ length: 6 }, () => pasang()));

    expect(semua.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
    for (const res of semua.filter((r) => r.status === 409)) {
      harapGalat(res, 409, 'already_set_up');
    }
    expect(await jumlahBaris('staff')).toBe(1);
    expect(await jumlahBaris('staff', "role = 'owner' AND is_active = TRUE")).toBe(1);
    expect(await jumlahBaris('staff_sessions')).toBe(1);
  });
});

// Hanya berjalan bila harness dan backend sama-sama dijalankan dengan
// SETUP_TOKEN kosong (lihat docs/menjalankan.md).
describe.runIf(!setupAktif)('POST /api/setup (SETUP_TOKEN kosong)', () => {
  it('apa pun badannya → 403 setup_disabled, dan tidak ada staf dibuat', async () => {
    harapGalat(await pasang({ token: 'token-apa-saja-panjang' }), 403, 'setup_disabled');
    harapGalat(await pasang({ token: '' }), 403, 'setup_disabled');
    harapGalat(await api.post('/api/setup', { json: {} }), 403, 'setup_disabled');
    // Badan yang tidak sah pun 403, bukan 422: langkah 3 mendahului validasi.
    harapGalat(await api.post('/api/setup', { json: { token: 1, name: 'a', email: 'x', password: 'y' } }), 403, 'setup_disabled');

    expect(await jumlahBaris('staff')).toBe(0);
    expect(await butuhSetup()).toBe(true);
  });

  it('403 setup_disabled juga mengalahkan already_set_up', async () => {
    await sisipkanStaf({ name: 'Pemilik Lama', email: emailUnik('pemilik'), role: 'owner', passwordHash: fixtur.hash.node });

    harapGalat(await pasang({ token: 'token-apa-saja-panjang' }), 403, 'setup_disabled');
    expect(await jumlahBaris('staff')).toBe(1);
  });
});
