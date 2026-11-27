// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { describe, expect, it } from 'vitest';
import { emailUnik, SANDI_UJI } from '../src/data';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { JSON_RUSAK } from './pembantu-fondasi';
import { masuk, masukDengan, stafLangsung } from './pembantu-staf';

// Batas percobaan masuk (langkah 3 POST /api/staff/login): email yang sama
// (dipangkas, A-Z dikecilkan) yang sudah 10 kali berturut-turut gagal → 429
// dengan Retry-After, terkunci 15 menit sejak percobaan ke-10. Setiap tes
// memakai email barunya sendiri. Lama kunci 15 menit tidak diuji (hitungan
// boleh disimpan di memori backend, jadi waktunya tidak bisa digeser dari
// database); yang diuji batas atas Retry-After dan nilainya sesaat sesudah
// percobaan ke-10.

const SANDI_SALAH = 'SandiSalah123!';
const MAKS_PERCOBAAN = 10;
const DURASI_KUNCI_DETIK = 15 * 60;

async function salahSebanyak(email: string, jumlah: number): Promise<void> {
  for (let i = 1; i <= jumlah; i++) {
    harapGalat(await masukDengan(email, SANDI_SALAH), 401, 'invalid_credentials');
  }
}

function retryAfter(res: Respons): number {
  const teks = res.header.get('retry-after') ?? '';
  expect(teks, 'Retry-After berupa bilangan bulat detik').toMatch(/^[0-9]+$/);
  return Number(teks);
}

describe('POST /api/staff/login: batas percobaan', () => {
  it('10 kali salah → 401; ke-11 → 429 dengan Retry-After mendekati 900 detik; sandi benar pun ditolak selama dikunci', async () => {
    const { email } = await stafLangsung('Uji Batas');
    await salahSebanyak(email, MAKS_PERCOBAAN);

    const ditolak = await masukDengan(email, SANDI_SALAH);
    harapGalat(ditolak, 429, 'too_many_requests');
    // Kunci 15 menit sejak percobaan ke-10 yang baru saja terjadi.
    const detik = retryAfter(ditolak);
    expect(detik).toBeGreaterThanOrEqual(DURASI_KUNCI_DETIK - 20);
    expect(detik).toBeLessThanOrEqual(DURASI_KUNCI_DETIK);

    const benar = await masukDengan(email, SANDI_UJI);
    harapGalat(benar, 429, 'too_many_requests');
    expect(retryAfter(benar)).toBeGreaterThanOrEqual(1);
    expect(retryAfter(benar)).toBeLessThanOrEqual(DURASI_KUNCI_DETIK);
  });

  it('sembilan kali salah lalu sandi benar → 200 (batasnya tepat 10)', async () => {
    const { email } = await stafLangsung('Uji Sembilan');
    await salahSebanyak(email, MAKS_PERCOBAAN - 1);

    harapStatus(await masukDengan(email, SANDI_UJI), 200);
  });

  it('kesepuluh kali salah masih 401, bukan 429; ke-11 dengan sandi benar → 429', async () => {
    const { email } = await stafLangsung('Uji Sepuluh');
    await salahSebanyak(email, MAKS_PERCOBAAN - 1);

    harapGalat(await masukDengan(email, SANDI_SALAH), 401, 'invalid_credentials');
    harapGalat(await masukDengan(email, SANDI_UJI), 429, 'too_many_requests');
  });

  it('email yang tidak terdaftar dan staf nonaktif dikunci dengan cara yang sama, jadi 429 tidak membocorkan email mana yang ada', async () => {
    const tidakAda = emailUnik('tidak-ada');
    const { email: nonaktif } = await stafLangsung('Mantan Kasir', { aktif: false });

    for (const email of [tidakAda, nonaktif]) {
      await salahSebanyak(email, MAKS_PERCOBAAN);
      harapGalat(await masukDengan(email, SANDI_SALAH), 429, 'too_many_requests');
    }
    // Staf nonaktif yang memakai sandinya yang benar juga dihitung (langkah 3 sebelum 4).
    const { email: nonaktifBenar } = await stafLangsung('Mantan Mekanik', { role: 'mechanic', aktif: false });
    for (let i = 1; i <= MAKS_PERCOBAAN; i++) {
      harapGalat(await masukDengan(nonaktifBenar, SANDI_UJI), 401, 'invalid_credentials');
    }
    harapGalat(await masukDengan(nonaktifBenar, SANDI_UJI), 429, 'too_many_requests');
  });

  it('email yang sama dalam bentuk lain (huruf besar, spasi di tepi) berbagi satu hitungan', async () => {
    const { email } = await stafLangsung('Uji Bentuk');
    const bentuk = [email, email.toUpperCase(), `  ${email}\t`, `\r\n${email.replace('contoh', 'CONTOH')} `];

    for (let i = 0; i < MAKS_PERCOBAAN; i++) {
      harapGalat(await masukDengan(bentuk[i % bentuk.length] ?? email, SANDI_SALAH), 401, 'invalid_credentials');
    }

    harapGalat(await masukDengan(email, SANDI_UJI), 429, 'too_many_requests');
    harapGalat(await masukDengan(email.toUpperCase(), SANDI_UJI), 429, 'too_many_requests');
  });

  it('email lain tidak ikut terkunci', async () => {
    const { email: terkunci } = await stafLangsung('Uji Terkunci');
    const { email: lain } = await stafLangsung('Uji Lain');
    await salahSebanyak(terkunci, MAKS_PERCOBAAN);
    harapGalat(await masukDengan(terkunci, SANDI_SALAH), 429, 'too_many_requests');

    harapStatus(await masukDengan(lain, SANDI_UJI), 200);
  });

  it('login yang berhasil menghapus hitungan salah sebelumnya', async () => {
    const { email } = await stafLangsung('Uji Hapus');
    await salahSebanyak(email, MAKS_PERCOBAAN - 1);
    harapStatus(await masukDengan(email.toUpperCase(), SANDI_UJI), 200);

    // Hitungan mulai dari nol lagi: 10 kali salah berikutnya masih 401.
    await salahSebanyak(email, MAKS_PERCOBAAN);
    harapGalat(await masukDengan(email, SANDI_SALAH), 429, 'too_many_requests');
  });

  it('badan yang gagal validasi (422) tidak dihitung sebagai percobaan', async () => {
    const { email } = await stafLangsung('Uji Validasi');
    await salahSebanyak(email, MAKS_PERCOBAAN - 1);

    for (let i = 0; i < 5; i++) {
      harapGalat(await masuk({ email, password: '' }), 422, 'validation_failed', { password: 'required' });
      harapGalat(await masuk({ email, password: 12345678 }), 422, 'validation_failed', { password: 'invalid_type' });
    }

    // Masih percobaan ke-10, bukan ke-20.
    harapStatus(await masukDengan(email, SANDI_UJI), 200);
  });

  it('selama dikunci, 400 dan 422 tetap didahulukan dari 429', async () => {
    const { email } = await stafLangsung('Uji Urutan');
    await salahSebanyak(email, MAKS_PERCOBAAN);
    harapGalat(await masukDengan(email, SANDI_SALAH), 429, 'too_many_requests');

    harapGalat(await api.post('/api/staff/login', { mentah: JSON_RUSAK }), 400, 'bad_request');
    harapGalat(await masuk({ email, password: '' }), 422, 'validation_failed', { password: 'required' });
    harapGalat(await masuk({ email, password: null }), 422, 'validation_failed', { password: 'required' });
  });

  it('15 percobaan salah serentak untuk satu email → tepat 10 kali 401 dan 5 kali 429', async () => {
    const { email } = await stafLangsung('Uji Serentak');

    const hasil = await Promise.all(Array.from({ length: 15 }, () => masukDengan(email, SANDI_SALAH)));

    expect(hasil.filter((r) => r.status === 401)).toHaveLength(MAKS_PERCOBAAN);
    expect(hasil.filter((r) => r.status === 429)).toHaveLength(5);
    for (const res of hasil) {
      harapGalat(res, res.status, res.status === 401 ? 'invalid_credentials' : 'too_many_requests');
    }
    harapGalat(await masukDengan(email, SANDI_UJI), 429, 'too_many_requests');
  });
});
