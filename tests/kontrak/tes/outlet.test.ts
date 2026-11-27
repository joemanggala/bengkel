// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { beforeAll, describe, expect, it } from 'vitest';
import { buatKasir, buatMekanik, buatPemilik, masukStaf, type SesiStaf } from '../src/data';
import { geserSesi } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { badanUtf8Rusak, JSON_RUSAK, jsonLebihDariSatuMib, tokenAcak } from './pembantu-fondasi';

let pemilik: SesiStaf;
// Dibaca sebelum tes mana pun mengubah profil, karena urutan tes boleh diacak.
let profilAwal: Respons;

const PROFIL = {
  name: 'Bengkel Maju Jaya',
  tagline: 'Servis motor dan mobil, cepat dan jujur',
  address: 'Jl. Merdeka No. 10, Bandung',
  phone: '081299990000',
  openingHours: 'Senin–Sabtu 08.00–17.00',
  mapsUrl: 'https://maps.google.com/?q=-6.9175,107.6191',
  receiptFooter: 'Garansi servis 7 hari.\nTerima kasih.',
};

const HASIL = { ...PROFIL, phone: '6281299990000' };

const SEMUA_FIELD = ['name', 'tagline', 'address', 'phone', 'openingHours', 'mapsUrl', 'receiptFooter'] as const;

function ganti(ubah: Record<string, unknown> = {}, token: string | undefined = pemilik.token): Promise<Respons> {
  return api.put('/api/outlet', { token, json: { ...PROFIL, ...ubah } });
}

beforeAll(async () => {
  profilAwal = await api.get('/api/outlet');
  pemilik = await buatPemilik();
});

describe('GET /api/outlet', () => {
  it('publik; profil awal dari migration: nama "Nama Bengkel", nomor null, teks lain kosong', async () => {
    harapStatus(profilAwal, 200);
    expect(profilAwal.body).toEqual({
      data: { name: 'Nama Bengkel', tagline: '', address: '', phone: null, openingHours: '', mapsUrl: '', receiptFooter: '' },
    });
  });

  it('token apa pun diabaikan: sampah, kedaluwarsa, atau token tiap peran semuanya 200 dengan isi yang sama', async () => {
    const lewat = await masukStaf(pemilik.staff.email);
    await geserSesi(lewat.token, { kedaluwarsaDetik: -60, terakhirDipakaiDetikLalu: 7200 });
    const dasar = (await api.get('/api/outlet')).body;

    for (const token of ['token-sampah', tokenAcak(), lewat.token, (await buatKasir()).token, (await buatMekanik()).token, pemilik.token]) {
      const res = await api.get('/api/outlet', { token });
      harapStatus(res, 200);
      expect(res.body).toEqual(dasar);
    }
  });
});

describe('PUT /api/outlet', () => {
  it('pemilik mengganti seluruh profil; teks dipangkas, nomor diseragamkan; GET publik langsung ikut berubah', async () => {
    const res = await ganti({
      name: '  Bengkel Maju Jaya  ',
      tagline: `\t${PROFIL.tagline} `,
      address: ` ${PROFIL.address}\t`,
      openingHours: `\r\n${PROFIL.openingHours}\r\n`,
      mapsUrl: `  ${PROFIL.mapsUrl}\n`,
      receiptFooter: `  ${PROFIL.receiptFooter}\n`,
    });

    harapStatus(res, 200);
    expect(res.body.data).toEqual(HASIL);
    expect((await api.get('/api/outlet')).body.data).toEqual(HASIL);
  });

  it('phone null dan teks kosong diterima; teks yang hanya spasi, tab, CR, LF menjadi kosong', async () => {
    const res = await ganti({ tagline: '', address: '   ', phone: null, openingHours: '\t', mapsUrl: ' \r\n ', receiptFooter: ' \n ' });

    harapStatus(res, 200);
    expect(res.body.data).toEqual({ name: PROFIL.name, tagline: '', address: '', phone: null, openingHours: '', mapsUrl: '', receiptFooter: '' });
    expect((await api.get('/api/outlet')).body.data.phone).toBeNull();
  });

  it('pergantian baris (LF) di tengah alamat, jam buka, dan kaki nota dipertahankan', async () => {
    const res = await ganti({
      address: 'Jl. Merdeka No. 10\nBandung',
      openingHours: 'Senin–Jumat 08.00–17.00\nSabtu 08.00–14.00',
      receiptFooter: 'Baris satu\nBaris dua\n\nBaris empat',
    });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({
      address: 'Jl. Merdeka No. 10\nBandung',
      openingHours: 'Senin–Jumat 08.00–17.00\nSabtu 08.00–14.00',
      receiptFooter: 'Baris satu\nBaris dua\n\nBaris empat',
    });
  });

  it('pemangkasan hanya membuang spasi, tab, CR, LF; NBSP di tepi dibiarkan', async () => {
    const res = await ganti({ name: ' Bengkel ', tagline: ' Cepat ' });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ name: ' Bengkel ', tagline: ' Cepat ' });
  });

  it.each(['0812-9999-0000', '+62 812 9999 0000', '6281299990000', '  0812 9999 0000\n', '+62-812-9999-0000', '62 812-9999 0000'])(
    'nomor %j diseragamkan menjadi 6281299990000',
    async (phone) => {
      const res = await ganti({ phone });

      harapStatus(res, 200);
      expect(res.body.data.phone).toBe('6281299990000');
    },
  );

  it('batas panjang nomor: 10 dan 15 digit diterima; 9 digit too_short; 16 digit too_long', async () => {
    expect((await ganti({ phone: '081234567' })).body.data.phone).toBe('6281234567');
    expect((await ganti({ phone: '0812345678901234'.slice(0, 14) })).body.data.phone).toBe('628123456789012');
    harapGalat(await ganti({ phone: '08123456' }), 422, 'validation_failed', { phone: 'too_short' });
    harapGalat(await ganti({ phone: '0812345678901234'.slice(0, 15) }), 422, 'validation_failed', { phone: 'too_long' });
  });

  it.each(['http://contoh.id', 'https://maps.app.goo.gl/AbCd123', 'https://maps.google.com/?q=-6.9175,107.6191&z=17', `https://contoh.id/${'a'.repeat(482)}`])(
    'tautan peta sah %s diterima apa adanya',
    async (mapsUrl) => {
      const res = await ganti({ mapsUrl });

      harapStatus(res, 200);
      expect(res.body.data.mapsUrl).toBe(mapsUrl);
    },
  );

  it('semua field wajib dikirim: {} → required di ketujuh field', async () => {
    harapGalat(await api.put('/api/outlet', { token: pemilik.token, json: {} }), 422, 'validation_failed', Object.fromEntries(SEMUA_FIELD.map((f) => [f, 'required'])));
  });

  it('null pada field teks → required; phone null sah', async () => {
    harapGalat(
      await ganti({ name: null, tagline: null, address: null, openingHours: null, mapsUrl: null, receiptFooter: null, phone: null }),
      422,
      'validation_failed',
      { name: 'required', tagline: 'required', address: 'required', openingHours: 'required', mapsUrl: 'required', receiptFooter: 'required' },
    );
  });

  it.each(SEMUA_FIELD)('field %s tidak dikirim → required di field itu saja', async (field) => {
    const isi: Record<string, unknown> = { ...PROFIL };
    delete isi[field];

    harapGalat(await api.put('/api/outlet', { token: pemilik.token, json: isi }), 422, 'validation_failed', { [field]: 'required' });
  });

  const KASUS_422: Array<[string, Record<string, unknown>, Record<string, string>]> = [
    ['nomor kosong', { phone: '' }, { phone: 'required' }],
    ['nomor hanya spasi dan tanda hubung', { phone: ' - - ' }, { phone: 'required' }],
    ['nomor huruf', { phone: 'wa-kami' }, { phone: 'invalid_format' }],
    ['nomor +08… (awalan salah)', { phone: '+0812 9999 0000' }, { phone: 'invalid_format' }],
    ['nomor 6208… (awalan salah)', { phone: '6208129999000' }, { phone: 'invalid_format' }],
    ['nomor luar negeri', { phone: '+1 555 1234567' }, { phone: 'invalid_format' }],
    ['nomor telepon rumah', { phone: '021-555-1234' }, { phone: 'invalid_format' }],
    ['nomor dengan kurung', { phone: '(0812) 9999 0000' }, { phone: 'invalid_format' }],
    ['nomor dengan tab di tengah', { phone: '0812\t99990000' }, { phone: 'invalid_format' }],
    ['nomor pendek berformat salah (format sebelum panjang)', { phone: '021' }, { phone: 'invalid_format' }],
    ['nomor angka JSON', { phone: 81299990000 }, { phone: 'invalid_type' }],
    ['nomor boolean', { phone: false }, { phone: 'invalid_type' }],
    ['nomor objek', { phone: {} }, { phone: 'invalid_type' }],
    ['nomor terlalu pendek', { phone: '0812' }, { phone: 'too_short' }],
    ['nama kosong', { name: '  ' }, { name: 'required' }],
    ['nama string kosong', { name: '' }, { name: 'required' }],
    ['nama satu huruf setelah dipangkas', { name: ' B ' }, { name: 'too_short' }],
    ['nama satu emoji', { name: '😀' }, { name: 'too_short' }],
    ['nama 101 karakter', { name: 'B'.repeat(101) }, { name: 'too_long' }],
    ['nama 101 emoji (code point)', { name: '😀'.repeat(101) }, { name: 'too_long' }],
    ['tagline 201 karakter', { tagline: 't'.repeat(201) }, { tagline: 'too_long' }],
    ['tagline 201 emoji', { tagline: '😀'.repeat(201) }, { tagline: 'too_long' }],
    ['alamat 501 karakter', { address: 'a'.repeat(501) }, { address: 'too_long' }],
    ['jam buka 201 karakter', { openingHours: 'j'.repeat(201) }, { openingHours: 'too_long' }],
    ['kaki nota 501 karakter', { receiptFooter: 'k'.repeat(501) }, { receiptFooter: 'too_long' }],
    ['tautan peta 501 karakter (panjang sebelum format)', { mapsUrl: 'x'.repeat(501) }, { mapsUrl: 'too_long' }],
    ['tautan peta https 501 karakter', { mapsUrl: `https://contoh.id/${'a'.repeat(483)}` }, { mapsUrl: 'too_long' }],
    ['tautan peta javascript:', { mapsUrl: 'javascript:alert(1)' }, { mapsUrl: 'invalid_format' }],
    ['tautan peta tanpa skema', { mapsUrl: 'www.contoh.id' }, { mapsUrl: 'invalid_format' }],
    ['tautan peta skema huruf besar', { mapsUrl: 'HTTPS://contoh.id' }, { mapsUrl: 'invalid_format' }],
    ['tautan peta skema Http', { mapsUrl: 'Http://contoh.id' }, { mapsUrl: 'invalid_format' }],
    ['tautan peta ftp', { mapsUrl: 'ftp://contoh.id' }, { mapsUrl: 'invalid_format' }],
    ['tautan peta satu garis miring', { mapsUrl: 'https:/contoh.id' }, { mapsUrl: 'invalid_format' }],
    ['tautan peta hanya skema', { mapsUrl: 'https://' }, { mapsUrl: 'invalid_format' }],
    ['tautan peta berspasi di tengah', { mapsUrl: 'https://contoh .id' }, { mapsUrl: 'invalid_format' }],
    ['tautan peta bertab di tengah', { mapsUrl: 'https://contoh\t.id' }, { mapsUrl: 'invalid_format' }],
    ['tautan peta ber-LF di tengah', { mapsUrl: 'https://contoh.id/\nx' }, { mapsUrl: 'invalid_format' }],
    ['tautan peta diawali teks lain', { mapsUrl: 'lihat https://contoh.id' }, { mapsUrl: 'invalid_format' }],
    [
      'teks bertipe salah',
      { name: 1, tagline: true, address: 1, openingHours: false, mapsUrl: [], receiptFooter: {} },
      { name: 'invalid_type', tagline: 'invalid_type', address: 'invalid_type', openingHours: 'invalid_type', mapsUrl: 'invalid_type', receiptFooter: 'invalid_type' },
    ],
  ];

  it.each(KASUS_422)('%s → 422', async (_nama, isi, fields) => {
    harapGalat(await ganti(isi), 422, 'validation_failed', fields);
  });

  it('batas yang tepat diterima: panjang teks maksimum, juga dalam code point', async () => {
    harapStatus(
      await ganti({ name: 'B'.repeat(100), tagline: 't'.repeat(200), address: 'a'.repeat(500), openingHours: 'j'.repeat(200), receiptFooter: 'k'.repeat(500) }),
      200,
    );
    const res = await ganti({ name: '😀'.repeat(100), tagline: '😀'.repeat(200), address: '😀'.repeat(500), openingHours: '😀'.repeat(200), receiptFooter: '😀'.repeat(500) });
    harapStatus(res, 200);
    expect(res.body.data.receiptFooter).toBe('😀'.repeat(500));
    harapStatus(await ganti({ name: 'Ab' }), 200);
  });

  it('panjang dinilai setelah dipangkas: teks tepat batas berekor spasi masih sah', async () => {
    const res = await ganti({
      tagline: ` ${'t'.repeat(200)} `,
      address: `${'a'.repeat(500)}   `,
      mapsUrl: `  https://contoh.id/${'a'.repeat(482)}\n`,
      receiptFooter: `\n${'k'.repeat(500)} \n`,
    });

    harapStatus(res, 200);
    expect(res.body.data).toMatchObject({ tagline: 't'.repeat(200), address: 'a'.repeat(500), receiptFooter: 'k'.repeat(500) });
    expect(res.body.data.mapsUrl).toHaveLength(500);
  });

  it('angka di field teks → invalid_type, termasuk angka raksasa', async () => {
    const badan = '{"name":1e400,"tagline":"","address":"","phone":null,"openingHours":"","mapsUrl":"","receiptFooter":""}';

    harapGalat(await api.put('/api/outlet', { token: pemilik.token, mentah: badan }), 422, 'validation_failed', { name: 'invalid_type' });
  });

  it('permintaan yang gagal validasi tidak mengubah apa pun; field lain di badan diabaikan', async () => {
    await ganti();
    harapGalat(await ganti({ name: 'Nama Baru', phone: 'bukan-nomor' }), 422, 'validation_failed', { phone: 'invalid_format' });
    harapGalat(await ganti({ name: 'Nama Baru', mapsUrl: 'javascript:alert(1)' }), 422, 'validation_failed', { mapsUrl: 'invalid_format' });

    expect((await api.get('/api/outlet')).body.data).toEqual(HASIL);
    const res = await ganti({ outletId: 7, lain: 'x', updatedAt: '2000-01-01T00:00:00Z' });
    harapStatus(res, 200);
    expect(res.body.data).toEqual(HASIL);
  });

  it('PUT dua kali dengan isi sama menghasilkan profil yang sama', async () => {
    const satu = await ganti();
    const dua = await ganti();

    harapStatus(dua, 200);
    expect(dua.body.data).toEqual(satu.body.data);
  });

  it('kasir dan mekanik → 403 tanpa mengubah apa pun; tanpa token atau token sampah → 401', async () => {
    await ganti();

    harapGalat(await ganti({ name: 'Diubah Kasir' }, (await buatKasir()).token), 403, 'forbidden');
    harapGalat(await ganti({ name: 'Diubah Mekanik' }, (await buatMekanik()).token), 403, 'forbidden');
    harapGalat(await api.put('/api/outlet', { json: PROFIL }), 401, 'unauthenticated');
    harapGalat(await ganti({ name: 'Diubah Sampah' }, tokenAcak()), 401, 'unauthenticated');

    expect((await api.get('/api/outlet')).body.data).toEqual(HASIL);
  });

  it('urutan: 413 → 400 → 401 → 403 → 422', async () => {
    const kasir = await buatKasir();
    const mekanik = await buatMekanik();

    harapGalat(await api.put('/api/outlet', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.put('/api/outlet', { token: kasir.token, mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.put('/api/outlet', { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.put('/api/outlet', { token: mekanik.token, mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.put('/api/outlet', { token: pemilik.token, mentah: '[]' }), 400, 'bad_request');
    harapGalat(await api.put('/api/outlet', { token: pemilik.token, mentah: '' }), 400, 'bad_request');
    harapGalat(await api.put('/api/outlet', { biner: badanUtf8Rusak() }), 400, 'bad_request');
    harapGalat(await api.put('/api/outlet', { json: {} }), 401, 'unauthenticated');
    harapGalat(await api.put('/api/outlet', { token: kasir.token, json: {} }), 403, 'forbidden');
    harapGalat(await api.put('/api/outlet', { token: mekanik.token, json: { ...PROFIL, name: 'x' } }), 403, 'forbidden');
    harapGalat(await api.put('/api/outlet', { token: pemilik.token, json: { ...PROFIL, name: 'x' } }), 422, 'validation_failed', { name: 'too_short' });
  });
});
