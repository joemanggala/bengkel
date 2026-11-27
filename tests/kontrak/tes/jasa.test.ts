// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { beforeAll, describe, expect, it } from 'vitest';
import { buatJasa, buatKasir, buatMekanik, buatPemilik, namaUnik, type SesiStaf } from '../src/data';
import { jumlahBaris } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { badanUtf8Rusak, JSON_RUSAK, jsonLebihDariSatuMib, tokenAcak } from './pembantu-fondasi';
import { KUNCI_JASA, saring } from './pembantu-staf';

// GET dan POST /api/services. PATCH ada di jasa-2. Berkas ini berbagi satu
// database; setiap tes memberi nama jasanya awalan unik dan hanya menilai
// jasa miliknya.

let pemilik: SesiStaf;
let kasir: SesiStaf;
let mekanik: SesiStaf;

function buat(isi: Record<string, unknown> = {}, token: string | undefined = pemilik.token): Promise<Respons> {
  return api.post('/api/services', { token, json: { name: namaUnik('Jasa'), price: 35000, ...isi } });
}

async function daftar(query = '', token: string = kasir.token): Promise<any[]> {
  const res = await api.get(`/api/services${query}`, { token });
  harapStatus(res, 200);
  return res.body.data;
}

async function idCocok(query: string): Promise<string[]> {
  return (await daftar(query)).map((j) => j.serviceId);
}

beforeAll(async () => {
  pemilik = await buatPemilik();
  kasir = await buatKasir();
  mekanik = await buatMekanik();
});

describe('GET /api/services', () => {
  it('ketiga peran melihat semua jasa, termasuk nonpublik dan nonaktif, tanpa meta, dalam bentuk Jasa', async () => {
    const publik = await buatJasa(pemilik.token);
    const nonpublik = await buatJasa(pemilik.token, { isPublic: false });
    const nonaktif = await buatJasa(pemilik.token, { isActive: false, isPublic: false });

    for (const token of [pemilik.token, kasir.token, mekanik.token]) {
      const res = await api.get('/api/services', { token });

      harapStatus(res, 200);
      expect(Object.keys(res.body)).toEqual(['data']);
      const id = res.body.data.map((j: any) => j.serviceId);
      expect(id).toEqual(expect.arrayContaining([publik.serviceId, nonpublik.serviceId, nonaktif.serviceId]));
      for (const baris of res.body.data) {
        expect(Object.keys(baris).sort()).toEqual(KUNCI_JASA);
      }
      expect(res.body.data.find((j: any) => j.serviceId === nonaktif.serviceId)).toMatchObject({ isActive: false, isPublic: false });
    }
  });

  it('urut sortOrder naik, lalu nama menurut collation (huruf besar/kecil dan aksen tidak membedakan); publik dan aktif tidak memengaruhi urutan', async () => {
    const awalan = namaUnik('Urut');
    const buatUrut = (akhiran: string, sortOrder: number, lain: Record<string, unknown> = {}) =>
      buatJasa(pemilik.token, { name: `${awalan} ${akhiran}`, sortOrder, ...lain });
    const semua = [
      await buatUrut('Eka', 5),
      await buatUrut('Zulu', 1, { isActive: false }),
      await buatUrut('citra', 5, { isPublic: false }),
      await buatUrut('Édi', 5),
      await buatUrut('andi', 5, { isActive: false }),
      await buatUrut('Budi', 5),
      await buatUrut('Alfa', 100000),
      await buatUrut('Omega', 0, { isPublic: false }),
    ];

    const urutan = saring(await daftar(), 'serviceId', semua.map((j) => j.serviceId));

    expect(urutan.map((j) => j.name.slice(awalan.length + 1))).toEqual(['Omega', 'Zulu', 'andi', 'Budi', 'citra', 'Édi', 'Eka', 'Alfa']);
  });

  it('isActive=true hanya yang aktif, isActive=false hanya yang nonaktif', async () => {
    const aktif = await buatJasa(pemilik.token);
    const nonaktif = await buatJasa(pemilik.token, { isActive: false });

    const hanyaAktif = await daftar('?isActive=true');
    const hanyaNonaktif = await daftar('?isActive=false');

    expect(hanyaAktif.every((j) => j.isActive === true)).toBe(true);
    expect(hanyaNonaktif.every((j) => j.isActive === false)).toBe(true);
    expect(hanyaAktif.map((j) => j.serviceId)).toContain(aktif.serviceId);
    expect(hanyaNonaktif.map((j) => j.serviceId)).toContain(nonaktif.serviceId);
    expect(hanyaAktif.length + hanyaNonaktif.length).toBe((await daftar()).length);
  });

  it.each(['', '1', '0', 'TRUE', 'False', 'yes', 'true%20', '%20true'])('isActive=%s → 422 fields.isActive invalid_format', async (nilai) => {
    harapGalat(await api.get(`/api/services?isActive=${nilai}`, { token: kasir.token }), 422, 'validation_failed', { isActive: 'invalid_format' });
  });

  it('urutan: 401 → 422 (query); kasir dan mekanik tidak 403', async () => {
    harapGalat(await api.get('/api/services?isActive=ya'), 401, 'unauthenticated');
    harapGalat(await api.get('/api/services?isActive=ya', { token: tokenAcak() }), 401, 'unauthenticated');
    harapGalat(await api.get('/api/services?isActive=ya', { token: mekanik.token }), 422, 'validation_failed', { isActive: 'invalid_format' });
  });

  describe('search mencocokkan nama jasa', () => {
    it('sebagian nama, tanpa membedakan huruf besar/kecil dan aksen; dipangkas lebih dulu', async () => {
      const tag = namaUnik('Cari');
      const jasa = await buatJasa(pemilik.token, { name: `${tag} Rém Cakram` });
      const lain = await buatJasa(pemilik.token, { name: `${tag} Ganti Oli` });

      for (const term of ['REM CAKRAM', 'rem', 'RÉM', `${tag} rem`, '  cakram  ', '\tcakram\n']) {
        const id = await idCocok(`?search=${encodeURIComponent(term)}`);
        expect(id, term).toContain(jasa.serviceId);
        expect(id, term).not.toContain(lain.serviceId);
      }
    });

    it('hanya nama yang dicocokkan, bukan deskripsi', async () => {
      const kata = `deskripsiunik${Date.now().toString(36)}`;
      const jasa = await buatJasa(pemilik.token, { description: `Berisi ${kata}.` });

      expect(await idCocok(`?search=${kata}`)).not.toContain(jasa.serviceId);
    });

    it('%, _, dan \\ dicocokkan apa adanya, bukan sebagai wildcard LIKE', async () => {
      const tag = namaUnik('Lambang');
      const persen = await buatJasa(pemilik.token, { name: `${tag} Paket 100%` });
      const angka = await buatJasa(pemilik.token, { name: `${tag} Paket 1000` });
      const garis = await buatJasa(pemilik.token, { name: `${tag} Oli_Mesin` });
      const huruf = await buatJasa(pemilik.token, { name: `${tag} OliXMesin` });
      const miring = await buatJasa(pemilik.token, { name: `${tag} Oli\\Gardan` });
      const polos = await buatJasa(pemilik.token, { name: `${tag} Oli Gardan` });

      const cari = async (term: string) => saring(await daftar(`?search=${encodeURIComponent(term)}`), 'serviceId', [persen, angka, garis, huruf, miring, polos].map((j) => j.serviceId)).map((j) => j.serviceId);

      expect(await cari('100%')).toEqual([persen.serviceId]);
      expect(await cari('i_M')).toEqual([garis.serviceId]);
      expect(await cari('\\')).toEqual([miring.serviceId]);
      expect(await cari('i\\G')).toEqual([miring.serviceId]);
      expect(await cari('Paket 100%')).toEqual([persen.serviceId]);
      // Sebagai wildcard, keduanya akan cocok dengan keenam jasa.
      expect(await cari(`${tag} %`)).toEqual([]);
      expect(await cari(`${tag} _`)).toEqual([]);
    });

    it('+ di query berarti spasi; titik koma adalah data biasa', async () => {
      const tag = namaUnik('Kueri');
      const spasi = await buatJasa(pemilik.token, { name: `${tag} Servis Ringan` });
      const koma = await buatJasa(pemilik.token, { name: `${tag} Paket A;B` });

      expect(await idCocok('?search=Servis+Ringan')).toContain(spasi.serviceId);
      expect(await idCocok(`?search=${encodeURIComponent(tag)}+Servis`)).toContain(spasi.serviceId);
      const titikKoma = await idCocok('?search=A;B');
      expect(titikKoma).toContain(koma.serviceId);
      expect(titikKoma).not.toContain(spasi.serviceId);
    });

    it('search kosong atau hanya spasi berarti tanpa filter', async () => {
      await buatJasa(pemilik.token);
      const semua = await idCocok('');

      expect(await idCocok('?search=')).toEqual(semua);
      expect(await idCocok('?search=%20%20')).toEqual(semua);
      expect(await idCocok('?search=+')).toEqual(semua);
    });

    it('term dengan byte UTF-8 tidak sah tidak pernah cocok: 200 dengan daftar kosong', async () => {
      await buatJasa(pemilik.token);

      expect(await daftar('?search=%FF')).toEqual([]);
      expect(await daftar('?search=a%FFb')).toEqual([]);
    });

    it('digabung dengan isActive: irisan keduanya', async () => {
      const tag = namaUnik('Gabung');
      const aktif = await buatJasa(pemilik.token, { name: `${tag} Satu` });
      const nonaktif = await buatJasa(pemilik.token, { name: `${tag} Dua`, isActive: false });

      expect(await idCocok(`?search=${encodeURIComponent(tag)}&isActive=false`)).toEqual([nonaktif.serviceId]);
      expect(await idCocok(`?search=${encodeURIComponent(tag)}&isActive=true`)).toEqual([aktif.serviceId]);
      harapGalat(await api.get(`/api/services?search=${encodeURIComponent(tag)}&isActive=`, { token: kasir.token }), 422, 'validation_failed', {
        isActive: 'invalid_format',
      });
    });
  });
});

describe('POST /api/services', () => {
  it('201 dengan nilai bawaan: deskripsi kosong, durasi null, tampil di website, aktif, urutan 0', async () => {
    const nama = namaUnik('Ganti Oli');
    const res = await buat({ name: nama, price: 35000 });

    harapStatus(res, 201);
    expect(Object.keys(res.body.data).sort()).toEqual(KUNCI_JASA);
    expect(res.body.data).toMatchObject({ name: nama, description: '', price: 35000, durationMinutes: null, isPublic: true, isActive: true, sortOrder: 0 });
    expect((await daftar()).find((j) => j.serviceId === res.body.data.serviceId)).toEqual(res.body.data);
  });

  it('semua field diisi; teks dipangkas (NBSP dibiarkan); field lain diabaikan', async () => {
    const nama = namaUnik('Tune Up');
    const res = await buat({
      name: `  ${nama}\t`,
      description: '\n Setel karburator\ndan busi. \r\n',
      price: 120000,
      durationMinutes: 90,
      isPublic: false,
      isActive: false,
      sortOrder: 3,
      serviceId: 'x',
      createdAt: '2000-01-01T00:00:00Z',
      lain: 1,
    });

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({
      name: nama,
      description: 'Setel karburator\ndan busi.',
      price: 120000,
      durationMinutes: 90,
      isPublic: false,
      isActive: false,
      sortOrder: 3,
    });
    expect(res.body.data.serviceId).not.toBe('x');
    const nbsp = await buat({ name: ` ${nama}`, description: ' ' });
    harapStatus(nbsp, 201);
    expect(nbsp.body.data).toMatchObject({ name: ` ${nama}`, description: ' ' });
  });

  it('batas yang sah: harga 0 dan 100.000.000, durasi 1 dan 1.440, urutan 100.000, nama 2 huruf dan 100 emoji, deskripsi 1.000 emoji', async () => {
    harapStatus(await buat({ price: 0, durationMinutes: 1, sortOrder: 0 }), 201);
    harapStatus(await buat({ price: 100000000, durationMinutes: 1440, sortOrder: 100000 }), 201);
    harapStatus(await buat({ name: `${Date.now().toString(36).slice(-2).toUpperCase()}` }), 201);
    const emoji = await buat({ name: `${'😀'.repeat(90)}${Date.now().toString().slice(-10)}`, description: '😀'.repeat(1000) });
    harapStatus(emoji, 201);
    expect(emoji.body.data.description).toBe('😀'.repeat(1000));
  });

  it('integer boleh ditulis 35000.0 atau 3.5e4; durasi null eksplisit sah', async () => {
    const mentah = `{"name":"${namaUnik('Pecahan')}","price":35000.0,"durationMinutes":null,"sortOrder":2e1}`;
    const res = await api.post('/api/services', { token: pemilik.token, mentah });

    harapStatus(res, 201);
    expect(res.body.data).toMatchObject({ price: 35000, durationMinutes: null, sortOrder: 20 });
    const lain = await api.post('/api/services', { token: pemilik.token, mentah: `{"name":"${namaUnik('Pangkat')}","price":3.5e4}` });
    expect(lain.body.data.price).toBe(35000);
  });

  it('nama kembar menurut collation (huruf besar/kecil, aksen, spasi di tepi, termasuk jasa nonaktif) → 409 service_name_taken', async () => {
    const nama = namaUnik('Cek Rem');
    harapStatus(await buat({ name: nama, isActive: false, isPublic: false }), 201);

    for (const kembar of [nama, nama.toUpperCase(), nama.toLowerCase(), nama.replace('Rem', 'Rém'), `  ${nama} `]) {
      harapGalat(await buat({ name: kembar }), 409, 'service_name_taken');
    }
    expect(await jumlahBaris('services', 'name = ?', [nama])).toBe(1);
  });

  it('validasi (422) lebih dulu dari nama kembar (409)', async () => {
    const nama = namaUnik('Kembar');
    harapStatus(await buat({ name: nama }), 201);

    harapGalat(await buat({ name: nama, price: -1 }), 422, 'validation_failed', { price: 'out_of_range' });
  });

  it('tidak dikirim atau null pada field wajib → required; null pada field opsional selain durasi → invalid_type; semua dilaporkan sekaligus', async () => {
    harapGalat(await api.post('/api/services', { token: pemilik.token, json: {} }), 422, 'validation_failed', { name: 'required', price: 'required' });
    harapGalat(
      await api.post('/api/services', {
        token: pemilik.token,
        json: { name: null, price: null, description: null, durationMinutes: null, isPublic: null, isActive: null, sortOrder: null },
      }),
      422,
      'validation_failed',
      { name: 'required', price: 'required', description: 'invalid_type', isPublic: 'invalid_type', isActive: 'invalid_type', sortOrder: 'invalid_type' },
    );
  });

  const KASUS_422: Array<[string, Record<string, unknown>, Record<string, string>]> = [
    ['nama kosong', { name: '' }, { name: 'required' }],
    ['nama hanya spasi', { name: ' \t\r\n ' }, { name: 'required' }],
    ['nama satu huruf', { name: ' A ' }, { name: 'too_short' }],
    ['nama satu emoji', { name: '😀' }, { name: 'too_short' }],
    ['nama 101 karakter', { name: 'n'.repeat(101) }, { name: 'too_long' }],
    ['nama 101 emoji', { name: '😀'.repeat(101) }, { name: 'too_long' }],
    ['nama angka', { name: 123 }, { name: 'invalid_type' }],
    ['deskripsi 1001 karakter', { description: 'd'.repeat(1001) }, { description: 'too_long' }],
    ['deskripsi angka', { description: 1 }, { description: 'invalid_type' }],
    ['harga teks', { price: '35000' }, { price: 'invalid_type' }],
    ['harga pecahan', { price: 1500.5 }, { price: 'invalid_type' }],
    ['harga boolean', { price: true }, { price: 'invalid_type' }],
    ['harga negatif', { price: -1 }, { price: 'out_of_range' }],
    ['harga lebih dari 100.000.000', { price: 100000001 }, { price: 'out_of_range' }],
    ['harga lebih dari 2^53−1', { price: 9007199254740992 }, { price: 'out_of_range' }],
    ['durasi 0', { durationMinutes: 0 }, { durationMinutes: 'out_of_range' }],
    ['durasi 1441', { durationMinutes: 1441 }, { durationMinutes: 'out_of_range' }],
    ['durasi negatif', { durationMinutes: -30 }, { durationMinutes: 'out_of_range' }],
    ['durasi teks', { durationMinutes: '30' }, { durationMinutes: 'invalid_type' }],
    ['durasi pecahan', { durationMinutes: 30.5 }, { durationMinutes: 'invalid_type' }],
    ['isPublic angka 1', { isPublic: 1 }, { isPublic: 'invalid_type' }],
    ['isPublic teks "true"', { isPublic: 'true' }, { isPublic: 'invalid_type' }],
    ['isActive angka 0', { isActive: 0 }, { isActive: 'invalid_type' }],
    ['urutan negatif', { sortOrder: -1 }, { sortOrder: 'out_of_range' }],
    ['urutan 100.001', { sortOrder: 100001 }, { sortOrder: 'out_of_range' }],
    ['urutan pecahan', { sortOrder: 1.5 }, { sortOrder: 'invalid_type' }],
    ['urutan teks', { sortOrder: '1' }, { sortOrder: 'invalid_type' }],
  ];

  it.each(KASUS_422)('%s → 422, tanpa jasa baru', async (_nama, isi, fields) => {
    const sebelum = await jumlahBaris('services');

    harapGalat(await buat(isi), 422, 'validation_failed', fields);
    expect(await jumlahBaris('services')).toBe(sebelum);
  });

  it('angka raksasa: 1e400 di field integer → out_of_range (tanpa menilai bulat); di field teks atau boolean → invalid_type', async () => {
    const nama = namaUnik('Raksasa');
    const kirim = (mentah: string) => api.post('/api/services', { token: pemilik.token, mentah });

    harapGalat(await kirim(`{"name":"${nama}","price":1e400}`), 422, 'validation_failed', { price: 'out_of_range' });
    harapGalat(await kirim(`{"name":"${nama}","price":-1e400,"durationMinutes":1e400,"sortOrder":9007199254740993.5}`), 422, 'validation_failed', {
      price: 'out_of_range',
      durationMinutes: 'out_of_range',
      sortOrder: 'out_of_range',
    });
    harapGalat(await kirim(`{"name":1e400,"price":1,"description":1e400,"isPublic":1e400}`), 422, 'validation_failed', {
      name: 'invalid_type',
      description: 'invalid_type',
      isPublic: 'invalid_type',
    });
  });

  it('kasir dan mekanik → 403, tanpa jasa baru', async () => {
    const sebelum = await jumlahBaris('services');

    harapGalat(await buat({}, kasir.token), 403, 'forbidden');
    harapGalat(await buat({}, mekanik.token), 403, 'forbidden');
    expect(await jumlahBaris('services')).toBe(sebelum);
  });

  it('urutan: 413 → 400 → 401 → 403 → 422 → 409', async () => {
    const nama = namaUnik('Urutan');
    harapStatus(await buat({ name: nama }), 201);

    harapGalat(await api.post('/api/services', { mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.post('/api/services', { token: kasir.token, mentah: jsonLebihDariSatuMib() }), 413, 'payload_too_large');
    harapGalat(await api.post('/api/services', { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.post('/api/services', { token: mekanik.token, mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.post('/api/services', { token: pemilik.token, mentah: '[]' }), 400, 'bad_request');
    harapGalat(await api.post('/api/services', { token: pemilik.token, mentah: '' }), 400, 'bad_request');
    harapGalat(await api.post('/api/services', { biner: badanUtf8Rusak() }), 400, 'bad_request');
    harapGalat(await api.post('/api/services', { json: {} }), 401, 'unauthenticated');
    harapGalat(await api.post('/api/services', { token: kasir.token, json: {} }), 403, 'forbidden');
    harapGalat(await buat({ name: nama }, mekanik.token), 403, 'forbidden');
    harapGalat(await buat({ name: nama, price: '1' }), 422, 'validation_failed', { price: 'invalid_type' });
    harapGalat(await buat({ name: nama }), 409, 'service_name_taken');
  });

  it('serentak dengan nama kembar (termasuk beda huruf) → satu 201 dan sisanya 409, tidak pernah 500', async () => {
    const nama = namaUnik('Serentak');
    const bentuk = [nama, nama.toUpperCase(), nama.toLowerCase(), nama];

    const semua = await Promise.all(bentuk.map((n) => buat({ name: n })));

    expect(semua.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
    for (const res of semua.filter((r) => r.status === 409)) {
      harapGalat(res, 409, 'service_name_taken');
    }
  });

  it('serentak dengan nama berbeda semuanya 201', async () => {
    const semua = await Promise.all(Array.from({ length: 5 }, () => buat()));

    expect(semua.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
  });
});
