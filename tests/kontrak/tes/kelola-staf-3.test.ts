// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { beforeAll, describe, expect, it } from 'vitest';
import { buatKasir, buatMekanik, buatPelangganDenganKendaraan, buatPemilik, buatSpk, detailSpk, emailUnik, masukStaf, SANDI_UJI, type SesiStaf } from '../src/data';
import { geserSesi } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { tokenAcak } from './pembantu-fondasi';
import { masukDengan, saring, stafDb, stafLangsung } from './pembantu-staf';

// GET /api/mechanics (keputusan 0a-2) dan akibat perubahan staf pada SPK.
// Berkas ini membuat SPK, jadi tabel staf tidak dikosongkan per tes: setiap
// tes membuat mekaniknya sendiri dan hanya menilai baris miliknya.

let pemilik: SesiStaf;
let kasir: SesiStaf;

function mekanikAktif(token: string = kasir.token): Promise<Respons> {
  return api.get('/api/mechanics', { token });
}

async function idMekanik(token: string = kasir.token): Promise<string[]> {
  const res = await mekanikAktif(token);
  harapStatus(res, 200);
  return res.body.data.map((m: any) => m.staffId);
}

function ubah(staffId: string, json: unknown): Promise<Respons> {
  return api.patch(`/api/staff/${staffId}`, { token: pemilik.token, json });
}

beforeAll(async () => {
  pemilik = await buatPemilik({ name: 'Ibu Sari' });
  kasir = await buatKasir({ name: 'Rina Kasir' });
});

describe('GET /api/mechanics', () => {
  it('pemilik dan kasir: hanya mekanik aktif {staffId, name}, tanpa email dan tanpa meta', async () => {
    const aktif = await stafLangsung('Andi Mekanik', { role: 'mechanic' });
    const nonaktif = await stafLangsung('Budi Mekanik', { role: 'mechanic', aktif: false });
    const kasirLain = await stafLangsung('Citra Kasir');
    const pemilikLain = await stafLangsung('Dodi Pemilik', { role: 'owner' });

    for (const token of [pemilik.token, kasir.token]) {
      const res = await mekanikAktif(token);

      harapStatus(res, 200);
      expect(Object.keys(res.body)).toEqual(['data']);
      expect(res.body.data).toContainEqual({ staffId: aktif.staffId, name: 'Andi Mekanik' });
      const id = res.body.data.map((m: any) => m.staffId);
      expect(id).not.toContain(nonaktif.staffId);
      expect(id).not.toContain(kasirLain.staffId);
      expect(id).not.toContain(pemilikLain.staffId);
      expect(id).not.toContain(pemilik.staff.staffId);
      expect(id).not.toContain(kasir.staff.staffId);
      for (const baris of res.body.data) {
        expect(Object.keys(baris).sort()).toEqual(['name', 'staffId']);
        expect(await stafDb(baris.staffId)).toMatchObject({ role: 'mechanic', aktif: true });
      }
    }
  });

  it('urut nama menurut collation (huruf besar/kecil dan aksen tidak membedakan), lalu staffId naik', async () => {
    const awalan = `Urut${Date.now().toString(36)}`;
    const nama = [`${awalan} andi`, `${awalan} Budi`, `${awalan} citra`, `${awalan} Édi`, `${awalan} Eka`];
    const id: Record<string, string> = {};
    for (const n of [...nama].reverse()) {
      id[n] = (await stafLangsung(n, { role: 'mechanic' })).staffId;
    }
    const kembar = [
      (await stafLangsung(`${awalan} Zaki`, { role: 'mechanic' })).staffId,
      (await stafLangsung(`${awalan} zaki`, { role: 'mechanic' })).staffId,
      (await stafLangsung(`${awalan} Zakí`, { role: 'mechanic' })).staffId,
    ];

    const res = await mekanikAktif();

    const semuaId = [...Object.values(id), ...kembar];
    const urutan = saring(res.body.data, 'staffId', semuaId).map((m: any) => m.staffId);
    expect(urutan).toEqual([...nama.map((n) => id[n]), ...[...kembar].sort()]);
  });

  it('mekanik → 403; tanpa token, token sampah, atau sesi kedaluwarsa → 401', async () => {
    const mekanik = await buatMekanik();

    harapGalat(await mekanikAktif(mekanik.token), 403, 'forbidden');
    harapGalat(await api.get('/api/mechanics'), 401, 'unauthenticated');
    harapGalat(await mekanikAktif(tokenAcak()), 401, 'unauthenticated');
    const lewat = await masukStaf(mekanik.staff.email);
    await geserSesi(lewat.token, { kedaluwarsaDetik: -60, terakhirDipakaiDetikLalu: 7200 });
    harapGalat(await mekanikAktif(lewat.token), 401, 'unauthenticated');
  });


  it('mekanik yang dibuat lewat POST /api/staff langsung muncul', async () => {
    const res = await api.post('/api/staff', {
      token: pemilik.token,
      json: { name: 'Eko Mekanik', email: emailUnik('mekanik'), password: SANDI_UJI, role: 'mechanic' },
    });
    harapStatus(res, 201);

    expect((await mekanikAktif()).body.data).toContainEqual({ staffId: res.body.data.staffId, name: 'Eko Mekanik' });
  });

  it('mekanik yang dinonaktifkan hilang dari daftar dan muncul lagi saat diaktifkan; nama baru langsung tampil', async () => {
    const { staffId } = await stafLangsung('Fajar Mekanik', { role: 'mechanic' });
    expect(await idMekanik()).toContain(staffId);

    harapStatus(await ubah(staffId, { isActive: false }), 200);
    expect(await idMekanik()).not.toContain(staffId);

    harapStatus(await ubah(staffId, { isActive: true, name: 'Fajar Sidik' }), 200);
    expect((await mekanikAktif()).body.data).toContainEqual({ staffId, name: 'Fajar Sidik' });
  });

  it('peran dibaca saat itu juga: mekanik yang diubah menjadi kasir hilang, kasir yang diubah menjadi mekanik muncul', async () => {
    const mekanik = await stafLangsung('Gilang Mekanik', { role: 'mechanic' });
    const kasirBaru = await stafLangsung('Hana Kasir');

    harapStatus(await ubah(mekanik.staffId, { role: 'cashier' }), 200);
    harapStatus(await ubah(kasirBaru.staffId, { role: 'mechanic' }), 200);

    const id = await idMekanik(pemilik.token);
    expect(id).not.toContain(mekanik.staffId);
    expect(id).toContain(kasirBaru.staffId);
  });
});

describe('perubahan staf dan SPK yang sudah ditugaskan', () => {
  async function spkUntuk(mechanicId: string): Promise<any> {
    const { kendaraan } = await buatPelangganDenganKendaraan(kasir.token);
    return buatSpk(kasir.token, kendaraan.vehicleId, { mechanicId });
  }

  async function spkBaru(mechanicId: string): Promise<Respons> {
    const { kendaraan } = await buatPelangganDenganKendaraan(kasir.token);
    return api.post('/api/work-orders', { token: kasir.token, json: { vehicleId: kendaraan.vehicleId, complaint: 'Servis rutin.', mechanicId } });
  }

  it('mekanik yang dinonaktifkan tetap tertera di SPK lamanya, tetapi tidak bisa ditugaskan lagi (inactive_reference); sesinya mati', async () => {
    const mekanik = await buatMekanik({ name: 'Iwan Mekanik' });
    const spk = await spkUntuk(mekanik.staff.staffId);

    harapStatus(await ubah(mekanik.staff.staffId, { isActive: false }), 200);

    expect((await detailSpk(kasir.token, spk.number)).mechanic).toEqual({ staffId: mekanik.staff.staffId, name: 'Iwan Mekanik' });
    expect((await detailSpk(pemilik.token, spk.number)).mechanic).toEqual({ staffId: mekanik.staff.staffId, name: 'Iwan Mekanik' });
    harapGalat(await spkBaru(mekanik.staff.staffId), 422, 'validation_failed', { mechanicId: 'inactive_reference' });
    harapGalat(await api.get(`/api/work-orders/${spk.number}`, { token: mekanik.token }), 401, 'unauthenticated');
    harapGalat(await masukDengan(mekanik.staff.email), 401, 'invalid_credentials');
  });

  it('mekanik yang diaktifkan lagi bisa ditugaskan lagi', async () => {
    const mekanik = await buatMekanik({ name: 'Joko Mekanik' });
    harapStatus(await ubah(mekanik.staff.staffId, { isActive: false }), 200);
    harapStatus(await ubah(mekanik.staff.staffId, { isActive: true }), 200);

    const res = await spkBaru(mekanik.staff.staffId);

    harapStatus(res, 201);
    expect(res.body.data.mechanic).toEqual({ staffId: mekanik.staff.staffId, name: 'Joko Mekanik' });
  });

  it('mekanik yang diubah menjadi kasir tetap tertera di SPK lamanya; menugaskannya lagi → unknown_reference', async () => {
    const mekanik = await buatMekanik({ name: 'Kiki Mekanik' });
    const spk = await spkUntuk(mekanik.staff.staffId);

    harapStatus(await ubah(mekanik.staff.staffId, { role: 'cashier' }), 200);

    expect((await detailSpk(kasir.token, spk.number)).mechanic).toEqual({ staffId: mekanik.staff.staffId, name: 'Kiki Mekanik' });
    harapGalat(await spkBaru(mekanik.staff.staffId), 422, 'validation_failed', { mechanicId: 'unknown_reference' });
    // Peran barunya langsung berlaku untuk sesi yang sedang berjalan.
    harapStatus(await mekanikAktif(mekanik.token), 200);
  });
});
