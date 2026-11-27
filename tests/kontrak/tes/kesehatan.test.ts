// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { buatBookingPublik, buatKasir, isianBooking, masukStaf, SANDI_UJI, siapkanBengkel, spkBengkel, type Bengkel } from '../src/data';
import { geserSesi, setAktif } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { bentukNotFound, jsonLebihDariSatuMib, JSON_RUSAK, mintaLangsung, NOT_FOUND_JSON, tokenAcak } from './pembantu-fondasi';

// Contoh pola berkas tes: satu bengkel untuk seluruh berkas (database sudah
// dikosongkan harness sebelum berkas ini), tes hanya membaca atau memakai
// rute yang tidak mengubah data penting. Rute yang tertulis dipanggil lewat
// `api` (respons divalidasi otomatis terhadap spec); rute dan metode yang
// tidak tertulis lewat `mintaLangsung` (tanpa validasi spec).

let b: Bengkel;
let auth: Record<string, string>;
let bookingId: string;

beforeAll(async () => {
  b = await siapkanBengkel();
  auth = { Authorization: `Bearer ${b.pemilik.token}` };
  bookingId = (await buatBookingPublik()).bookingId;
});

describe('GET /api/health', () => {
  it('membalas 200 {"status":"ok"} tanpa token dan tanpa pembungkus data, berupa JSON', async () => {
    const res = await api.get('/api/health');

    harapStatus(res, 200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.header.get('content-type')).toMatch(/^application\/json/);
  });

  it('hasilnya sama dengan token staf yang sah', async () => {
    const res = await api.get('/api/health', { token: b.mekanik.token });

    harapStatus(res, 200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('rute publik mengabaikan Authorization sepenuhnya', () => {
  const RUTE_200 = ['/api/health', '/api/setup', '/api/outlet', '/api/public/services'];

  it('header Authorization rusak atau tidak sah pada rute publik yang berhasil tetap 200', async () => {
    const sampah = ['Bearer sampah', 'Bearer', 'Basic dXNlcjpzYW5kaQ==', `Bearer ${'x'.repeat(43)}`, `Bearer  ${tokenAcak()}`, `Bearer ${tokenAcak()}`];

    for (const path of RUTE_200) {
      for (const nilai of sampah) {
        const res = await api.get(path, { header: { Authorization: nilai } });
        expect(res.status, `${path} dengan Authorization "${nilai}"`).toBe(200);
      }
    }
  });

  it('token kedaluwarsa dan token staf nonaktif tidak membuat rute publik menjadi 401', async () => {
    const kedaluwarsa = await masukStaf(b.pemilik.staff.email);
    await geserSesi(kedaluwarsa.token, { kedaluwarsaDetik: -60, terakhirDipakaiDetikLalu: 7200 });
    const nonaktif = await buatKasir();
    await setAktif('staff', nonaktif.staff.staffId, false);

    for (const token of [kedaluwarsa.token, nonaktif.token]) {
      for (const path of RUTE_200) {
        const res = await api.get(path, { token });
        expect(res.status, path).toBe(200);
      }
    }
  });

  it('rute publik bertoken yang membalas 404 tetap 404 (bukan 401) walau Authorization sampah', async () => {
    const sampah = { Authorization: 'Bearer sampah' };
    const t = tokenAcak();

    harapGalat(await api.get(`/api/public/bookings/${t}`, { header: sampah }), 404, 'not_found');
    harapGalat(await api.post(`/api/public/bookings/${t}/cancel`, { header: sampah }), 404, 'not_found');
    harapGalat(await api.get(`/api/public/work-orders/${t}`, { header: sampah }), 404, 'not_found');
    // Rute pembatalan tidak menerima badan, jadi JSON rusak diabaikan: tetap 404.
    harapGalat(await api.post(`/api/public/bookings/${t}/cancel`, { header: sampah, mentah: JSON_RUSAK }), 404, 'not_found');
  });

  it('booking publik dengan Authorization sampah tetap dibuat (201), bukan 401', async () => {
    const res = await api.post('/api/public/bookings', { header: { Authorization: 'Bearer sampah' }, json: await isianBooking() });

    harapStatus(res, 201);
  });

  it('masuk staf (publik) tidak peduli Authorization sampah', async () => {
    const res = await api.post('/api/staff/login', {
      header: { Authorization: 'Bearer sampah' },
      json: { email: b.kasir.staff.email, password: SANDI_UJI },
    });

    harapStatus(res, 200);
  });
});

describe('rute dan metode yang tidak tertulis', () => {
  it.each(['/api/rute-yang-tidak-ada', '/api', '/api/', '/', '/health', '/api/v1/health', '/api/health/extra', '/api/staff/login/x', '/api/orders'])(
    'rute tak dikenal %s → 404 not_found berbentuk galat JSON',
    async (path) => {
      const res = await mintaLangsung('GET', path);

      expect(bentukNotFound(res)).toEqual(NOT_FOUND_JSON);
    },
  );

  const ID = randomUUID();
  const T = tokenAcak();
  const S = 'S-0001';
  const TIDAK_TERTULIS: Array<[string, string]> = [
    ['DELETE', `/api/work-orders/${S}`],
    ['PUT', `/api/work-orders/${S}`],
    ['POST', `/api/work-orders/${S}`],
    ['GET', `/api/work-orders/${S}/status`],
    ['GET', `/api/work-orders/${S}/cancel`],
    ['GET', `/api/work-orders/${S}/items`],
    ['GET', `/api/work-orders/${S}/items/${ID}`],
    ['PATCH', `/api/work-orders/${S}/items/${ID}`],
    ['GET', `/api/work-orders/${S}/payments`],
    ['GET', `/api/work-orders/${S}/wa`],
    ['GET', `/api/work-orders/${S}/tracking-link`],
    ['PUT', '/api/work-orders'],
    ['DELETE', '/api/work-orders'],
    ['POST', '/api/outlet'],
    ['PATCH', '/api/outlet'],
    ['DELETE', '/api/outlet'],
    ['POST', '/api/health'],
    ['PUT', '/api/setup'],
    ['DELETE', '/api/setup'],
    ['GET', '/api/staff/login'],
    ['GET', '/api/staff/logout'],
    ['POST', '/api/staff/me'],
    ['PUT', '/api/staff'],
    ['DELETE', '/api/staff'],
    ['GET', `/api/staff/${ID}`],
    ['DELETE', `/api/staff/${ID}`],
    ['POST', '/api/mechanics'],
    ['POST', '/api/public/services'],
    ['GET', '/api/public/bookings'],
    ['DELETE', `/api/public/bookings/${T}`],
    ['PATCH', `/api/public/bookings/${T}`],
    ['GET', `/api/public/bookings/${T}/cancel`],
    ['POST', `/api/public/work-orders/${T}`],
    ['PUT', '/api/customers'],
    ['PUT', `/api/customers/${ID}`],
    ['DELETE', `/api/customers/${ID}`],
    ['GET', `/api/customers/${ID}/vehicles`],
    ['POST', '/api/vehicles'],
    ['GET', `/api/vehicles/${ID}`],
    ['DELETE', `/api/vehicles/${ID}`],
    ['POST', `/api/vehicles/${ID}/work-orders`],
    ['PUT', '/api/services'],
    ['GET', `/api/services/${ID}`],
    ['DELETE', `/api/services/${ID}`],
    ['GET', `/api/parts/${ID}`],
    ['DELETE', `/api/parts/${ID}`],
    ['POST', `/api/parts/${ID}/movements`],
    ['GET', `/api/parts/${ID}/stock-in`],
    ['GET', `/api/parts/${ID}/stock-out`],
    ['GET', `/api/parts/${ID}/stock-count`],
    ['POST', '/api/bookings'],
    ['PATCH', `/api/bookings/${ID}`],
    ['DELETE', `/api/bookings/${ID}`],
    ['GET', `/api/bookings/${ID}/confirm`],
    ['GET', `/api/bookings/${ID}/reject`],
    ['GET', `/api/bookings/${ID}/convert`],
    ['POST', '/api/reports/daily'],
    ['DELETE', '/api/reports/daily'],
  ];

  it.each(TIDAK_TERTULIS)('metode yang tidak tertulis (%s %s) → 404 JSON, tanpa token maupun dengan token pemilik', async (metode, path) => {
    const tanpaToken = await mintaLangsung(metode, path);
    const denganToken = await mintaLangsung(metode, path, { header: auth });

    // Rute dicocokkan lebih dulu dari semua pemeriksaan lain, jadi bukan 401.
    expect(bentukNotFound(tanpaToken)).toEqual(NOT_FOUND_JSON);
    expect(bentukNotFound(denganToken)).toEqual(NOT_FOUND_JSON);
  });

  it('rute dicocokkan sebelum badan diperiksa: JSON rusak atau lebih dari 1 MiB pada rute/metode tak tertulis → 404, bukan 400/413', async () => {
    for (const [metode, path] of [
      ['POST', '/api/tidak-ada'],
      ['PATCH', '/api/work-orders'],
      ['DELETE', `/api/work-orders/${S}`],
      ['PUT', '/api/staff'],
    ] as const) {
      const rusak = await mintaLangsung(metode, path, { badan: JSON_RUSAK });
      expect(bentukNotFound(rusak), `${metode} ${path} dengan JSON rusak`).toEqual(NOT_FOUND_JSON);
      const besar = await mintaLangsung(metode, path, { badan: jsonLebihDariSatuMib() });
      expect(bentukNotFound(besar), `${metode} ${path} dengan badan besar`).toEqual(NOT_FOUND_JSON);
    }
  });

  it('HEAD di mana pun → 404 tanpa badan', async () => {
    for (const path of ['/api/health', '/api/outlet', '/api/public/services', '/api/staff/me', '/api/rute-yang-tidak-ada']) {
      const res = await mintaLangsung('HEAD', path, { header: auth });

      expect(res.status, `HEAD ${path}`).toBe(404);
      expect(res.teks, `HEAD ${path}`).toBe('');
    }
  });

  it('tidak ada CORS: OPTIONS (preflight) di mana pun → 404 not_found tanpa header Access-Control-*', async () => {
    for (const path of ['/api/outlet', '/api/staff/login', '/api/work-orders', '/api/public/bookings', '/api/rute-yang-tidak-ada']) {
      const res = await mintaLangsung('OPTIONS', path, {
        header: { Origin: 'http://localhost:3800', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' },
      });

      expect(bentukNotFound(res), `OPTIONS ${path}`).toEqual(NOT_FOUND_JSON);
      expect([...res.header.keys()].filter((h) => h.startsWith('access-control-')), `OPTIONS ${path}`).toEqual([]);
    }
  });

  it('permintaan biasa dari browser (header Origin) pun tidak mendapat header Access-Control-*', async () => {
    const asal = { Origin: 'http://localhost:3800' };

    for (const res of [
      await mintaLangsung('GET', '/api/health', { header: asal }),
      await mintaLangsung('GET', '/api/public/services', { header: asal }),
      await mintaLangsung('GET', '/api/staff/me', { header: asal }),
      await mintaLangsung('GET', '/api/rute-yang-tidak-ada', { header: asal }),
    ]) {
      expect([...res.header.keys()].filter((h) => h.startsWith('access-control-'))).toEqual([]);
    }
  });
});

describe('path dicocokkan persis', () => {
  it.each([
    ['GET', '/api/health/'],
    ['GET', '/api/outlet/'],
    ['GET', '/api/work-orders/'],
    ['GET', '/api/staff/'],
    ['GET', '/api/staff/me/'],
    ['POST', '/api/staff/login/'],
    ['GET', '/api/public/services/'],
    ['GET', '/api/setup/'],
    ['GET', '/api//health'],
    ['GET', '/api/work-orders//'],
    ['POST', '/api/work-orders//status'],
    ['POST', '/api/parts//stock-in'],
    ['POST', '/api/bookings//confirm'],
    ['POST', '/api/public/bookings//cancel'],
  ])('garis miring di akhir atau segmen kosong (%s %s) → 404, tanpa token pun', async (metode, path) => {
    const res = await mintaLangsung(metode, path);

    expect(bentukNotFound(res)).toEqual(NOT_FOUND_JSON);
  });

  it('segmen tetap didahulukan atas segmen berparameter: /api/staff/me adalah profil, bukan {staffId}', async () => {
    const res = await api.get('/api/staff/me', { token: b.pemilik.token });

    harapStatus(res, 200);
    expect(res.body.data.staffId).toBe(b.pemilik.staff.staffId);
  });

  it('UUID huruf besar di path diperlakukan sebagai tidak ada (404), UUID huruf kecil yang sama 200', async () => {
    const token = b.pemilik.token;
    const besar = (id: string) => id.toUpperCase();
    const { customerId } = b.pelanggan;
    const { vehicleId } = b.kendaraan;
    const { serviceId } = b.gantiOli;
    const { partId } = b.oli;
    const { staffId } = b.kasir.staff;
    const kasus: Array<[metode: 'get' | 'patch', awal: string, id: string, akhir: string]> = [
      ['get', '/api/customers/', customerId, ''],
      ['patch', '/api/customers/', customerId, ''],
      ['patch', '/api/vehicles/', vehicleId, ''],
      ['get', '/api/vehicles/', vehicleId, '/work-orders'],
      ['patch', '/api/services/', serviceId, ''],
      ['patch', '/api/parts/', partId, ''],
      ['get', '/api/parts/', partId, '/movements'],
      ['patch', '/api/staff/', staffId, ''],
      ['get', '/api/bookings/', bookingId, ''],
    ];

    for (const [metode, awal, id, akhir] of kasus) {
      const opsi = metode === 'patch' ? { token, json: {} } : { token };
      harapStatus(await api[metode](`${awal}${id}${akhir}`, opsi), 200);
      harapGalat(await api[metode](`${awal}${besar(id)}${akhir}`, opsi), 404, 'not_found');
    }
  });

  it('nomor SPK dicocokkan persis: huruf kecil, tanpa nol di depan, atau berekor baris baru → 404', async () => {
    const { number } = await spkBengkel(b);

    harapStatus(await api.get(`/api/work-orders/${number}`, { token: b.kasir.token }), 200);
    harapGalat(await api.get(`/api/work-orders/${number.toLowerCase()}`, { token: b.kasir.token }), 404, 'not_found');
    harapGalat(await api.get('/api/work-orders/S-1', { token: b.kasir.token }), 404, 'not_found');
    // "$" yang sebenarnya = akhir string: "S-0001\n" tidak cocok dengan ^S-[0-9]{4,}$.
    harapGalat(await api.get(`/api/work-orders/${number}%0A`, { token: b.kasir.token }), 404, 'not_found');
  });
});

describe('parameter query', () => {
  it('titik koma adalah data biasa, bukan pemisah: limit=1;page=2 berarti limit "1;page=2" → 422 invalid_format', async () => {
    harapGalat(await api.get('/api/customers?limit=1;page=2', { token: b.kasir.token }), 422, 'validation_failed', { limit: 'invalid_format' });
  });
});

describe('galat selalu JSON, apa pun header Accept', () => {
  const ACCEPT = ['text/html', 'application/xml', 'text/plain', 'image/png', 'application/pdf'];

  it.each(ACCEPT)('Accept: %s → 404, 401, 400, 422 tetap berbadan JSON', async (accept) => {
    const header = { Accept: accept };

    const takDikenal = await mintaLangsung('GET', '/api/rute-yang-tidak-ada', { header });
    expect(bentukNotFound(takDikenal)).toEqual(NOT_FOUND_JSON);
    harapGalat(await api.get('/api/staff/me', { header }), 401, 'unauthenticated');
    harapGalat(await api.post('/api/staff/login', { header, mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await api.post('/api/staff/login', { header, json: {} }), 422, 'validation_failed', { email: 'required', password: 'required' });
    harapGalat(await api.get(`/api/public/work-orders/${tokenAcak()}`, { header }), 404, 'not_found');
  });

  it('header Accept kosong pun tetap menghasilkan galat JSON', async () => {
    const res = await mintaLangsung('GET', '/api/rute-yang-tidak-ada', { header: { Accept: '' } });

    expect(bentukNotFound(res)).toEqual(NOT_FOUND_JSON);
  });
});
