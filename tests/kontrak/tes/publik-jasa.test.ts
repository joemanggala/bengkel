// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { beforeAll, describe, expect, it } from 'vitest';
import { buatJasa, buatKasir, buatMekanik, buatPemilik, masukStaf, namaUnik, type SesiStaf } from '../src/data';
import { geserSesi } from '../src/db';
import { harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { tokenAcak } from './pembantu-fondasi';
import { saring } from './pembantu-staf';

// GET /api/public/services: hanya jasa yang aktif dan tampil di website.
// Berkas ini berbagi satu database; setiap tes hanya menilai jasa yang ia
// buat sendiri (disaring dengan serviceId), kecuali daftar awal yang dibaca
// sebelum ada jasa.

let pemilik: SesiStaf;
let daftarAwal: Respons;

const KUNCI_JASA_PUBLIK = ['description', 'durationMinutes', 'name', 'price', 'serviceId'];

async function jasaPublik(opsi: { token?: string } = {}): Promise<any[]> {
  const res = await api.get('/api/public/services', opsi);
  harapStatus(res, 200);
  return res.body.data;
}

async function idPublik(): Promise<string[]> {
  return (await jasaPublik()).map((j) => j.serviceId);
}

function ubahJasa(serviceId: string, json: Record<string, unknown>): Promise<Respons> {
  return api.patch(`/api/services/${serviceId}`, { token: pemilik.token, json });
}

beforeAll(async () => {
  daftarAwal = await api.get('/api/public/services');
  pemilik = await buatPemilik();
});

describe('GET /api/public/services', () => {
  it('tanpa jasa: daftar kosong {data: []} tanpa meta', async () => {
    harapStatus(daftarAwal, 200);
    expect(daftarAwal.body).toEqual({ data: [] });
  });

  it('hanya jasa yang aktif dan tampil di website; nonpublik, nonaktif, atau keduanya tidak ikut', async () => {
    const tampil = await buatJasa(pemilik.token);
    const nonpublik = await buatJasa(pemilik.token, { isPublic: false });
    const nonaktif = await buatJasa(pemilik.token, { isActive: false });
    const keduanya = await buatJasa(pemilik.token, { isPublic: false, isActive: false });

    const id = await idPublik();

    expect(id).toContain(tampil.serviceId);
    expect(id).not.toContain(nonpublik.serviceId);
    expect(id).not.toContain(nonaktif.serviceId);
    expect(id).not.toContain(keduanya.serviceId);
  });

  it('bentuk JasaPublik: hanya serviceId, name, description, price, durationMinutes, sama dengan data jasa', async () => {
    const lengkap = await buatJasa(pemilik.token, { name: namaUnik('Tune Up'), description: 'Setel karburator dan busi.', price: 120000, durationMinutes: 90 });
    const polos = await buatJasa(pemilik.token, { price: 0 });

    const daftar = await jasaPublik();

    for (const baris of daftar) {
      expect(Object.keys(baris).sort()).toEqual(KUNCI_JASA_PUBLIK);
    }
    expect(daftar.find((j) => j.serviceId === lengkap.serviceId)).toEqual({
      serviceId: lengkap.serviceId,
      name: lengkap.name,
      description: 'Setel karburator dan busi.',
      price: 120000,
      durationMinutes: 90,
    });
    expect(daftar.find((j) => j.serviceId === polos.serviceId)).toEqual({
      serviceId: polos.serviceId,
      name: polos.name,
      description: '',
      price: 0,
      durationMinutes: null,
    });
  });

  it('urut sortOrder naik, lalu nama menurut collation (huruf besar/kecil dan aksen tidak membedakan)', async () => {
    const awalan = namaUnik('Urut');
    const buat = (akhiran: string, sortOrder: number) => buatJasa(pemilik.token, { name: `${awalan} ${akhiran}`, sortOrder });
    // Dibuat dalam urutan acak supaya urutan waktu dibuat tidak kebetulan benar.
    const eka = await buat('Eka', 5);
    const zulu = await buat('Zulu', 1);
    const citra = await buat('citra', 5);
    const edi = await buat('Édi', 5);
    const andi = await buat('andi', 5);
    const budi = await buat('Budi', 5);
    const akhir = await buat('Alfa', 100000);
    const awal = await buat('Omega', 0);

    const daftar = saring(await jasaPublik(), 'serviceId', [eka, zulu, citra, edi, andi, budi, akhir, awal].map((j) => j.serviceId));

    expect(daftar.map((j) => j.name.slice(awalan.length + 1))).toEqual(['Omega', 'Zulu', 'andi', 'Budi', 'citra', 'Édi', 'Eka', 'Alfa']);
  });

  it('jasa yang dinonaktifkan atau disembunyikan dari website langsung hilang, dan muncul lagi bila dikembalikan', async () => {
    const jasa = await buatJasa(pemilik.token);
    expect(await idPublik()).toContain(jasa.serviceId);

    harapStatus(await ubahJasa(jasa.serviceId, { isActive: false }), 200);
    expect(await idPublik()).not.toContain(jasa.serviceId);
    harapStatus(await ubahJasa(jasa.serviceId, { isActive: true }), 200);
    expect(await idPublik()).toContain(jasa.serviceId);

    harapStatus(await ubahJasa(jasa.serviceId, { isPublic: false }), 200);
    expect(await idPublik()).not.toContain(jasa.serviceId);
    harapStatus(await ubahJasa(jasa.serviceId, { isActive: false, isPublic: true }), 200);
    expect(await idPublik()).not.toContain(jasa.serviceId);
    harapStatus(await ubahJasa(jasa.serviceId, { isActive: true }), 200);
    expect(await idPublik()).toContain(jasa.serviceId);
  });

  it('jasa nonpublik yang dijadikan publik langsung muncul', async () => {
    const jasa = await buatJasa(pemilik.token, { isPublic: false });
    expect(await idPublik()).not.toContain(jasa.serviceId);

    harapStatus(await ubahJasa(jasa.serviceId, { isPublic: true }), 200);

    expect(await idPublik()).toContain(jasa.serviceId);
  });

  it('perubahan nama, harga, deskripsi, durasi, dan urutan langsung tampil', async () => {
    const jasa = await buatJasa(pemilik.token, { durationMinutes: 30 });
    const nama = namaUnik('Servis Besar');

    harapStatus(await ubahJasa(jasa.serviceId, { name: nama, price: 250000, description: 'Bongkar mesin.', durationMinutes: null, sortOrder: 7 }), 200);

    expect((await jasaPublik()).find((j) => j.serviceId === jasa.serviceId)).toEqual({
      serviceId: jasa.serviceId,
      name: nama,
      description: 'Bongkar mesin.',
      price: 250000,
      durationMinutes: null,
    });
  });

  it('token apa pun diabaikan: sampah, kedaluwarsa, atau token tiap peran → 200 dengan isi yang sama', async () => {
    await buatJasa(pemilik.token);
    const lewat = await masukStaf(pemilik.staff.email);
    await geserSesi(lewat.token, { kedaluwarsaDetik: -60, terakhirDipakaiDetikLalu: 7200 });
    const dasar = await jasaPublik();

    for (const token of ['token-sampah', tokenAcak(), lewat.token, (await buatKasir()).token, (await buatMekanik()).token, pemilik.token]) {
      expect(await jasaPublik({ token })).toEqual(dasar);
    }
  });
});
