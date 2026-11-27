// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { beforeAll, describe, expect, it } from 'vitest';
import { harapSetara } from '../src/banding';
import { buatKasir, buatMekanik, buatPemilik, emailUnik, masukStaf, SANDI_UJI, type SesiStaf } from '../src/data';
import { bacaSatu, geserSesi, jalankan, jumlahBaris, setAktif, sha256Hex, sisipkanSesi, waktuSesi } from '../src/db';
import { harapGalat, harapStatus } from '../src/galat';
import { api, type Respons } from '../src/klien';
import { badanUtf8Rusak, JSON_RUSAK, SATU_MIB, SEHARI, tokenAcak, tukarHuruf } from './pembantu-fondasi';
import { jsonBersarang, KUNCI_STAF, masuk, masukDengan, stafLangsung } from './pembantu-staf';

// Batas 10 percobaan masuk per email ada di staf-auth-2.test.ts. Di berkas ini
// setiap tes yang sengaja salah sandi memakai email staf barunya sendiri,
// supaya hitungan percobaan tidak menumpuk di satu email.

function me(header: Record<string, string>): Promise<Respons> {
  return api.get('/api/staff/me', { header });
}

let pemilik: SesiStaf;

beforeAll(async () => {
  pemilik = await buatPemilik({ name: 'Ibu Sari' });
});

describe('POST /api/staff/login', () => {
  it.each([
    ['owner', 'Ibu Pemilik'],
    ['cashier', 'Rina Kasir'],
    ['mechanic', 'Andi Mekanik'],
  ] as const)('peran %s masuk: 200 dengan token 43 karakter base64url dan profil staf', async (role, name) => {
    const { staffId, email } = await stafLangsung(name, { role });

    const res = await masukDengan(email);

    harapStatus(res, 200);
    expect(res.body.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Object.keys(res.body.data.staff).sort()).toEqual(KUNCI_STAF);
    expect(res.body.data.staff).toMatchObject({ staffId, name, email, role, isActive: true });
    const profil = await api.get('/api/staff/me', { token: res.body.data.token });
    harapSetara(profil.body.data, res.body.data.staff);
  });

  it('email dipangkas (spasi, tab, CR, LF) dan huruf A-Z dikecilkan sebelum dicari', async () => {
    const { staffId, email } = await stafLangsung('Kasir Pangkas');

    for (const ketik of [`  ${email.toUpperCase()} `, `\t${email}\r\n`, email.replace('contoh', 'CoNtOh')]) {
      const res = await masukDengan(ketik);
      harapStatus(res, 200);
      expect(res.body.data.staff.staffId).toBe(staffId);
    }
  });

  it('database hanya menyimpan sha256 hex token, berlaku 30 hari; sesi lain milik staf yang sama tetap berlaku', async () => {
    const lama = await masukStaf(pemilik.staff.email);
    const sesi = await masukStaf(pemilik.staff.email);

    expect(await bacaSatu('SELECT staff_id FROM staff_sessions WHERE token_hash = ?', [sha256Hex(sesi.token)])).toEqual({
      staff_id: pemilik.staff.staffId,
    });
    expect(await jumlahBaris('staff_sessions', 'token_hash = ?', [sesi.token])).toBe(0);
    const waktu = await waktuSesi(sesi.token);
    expect(waktu?.sisa).toBeGreaterThanOrEqual(30 * SEHARI - 300);
    expect(waktu?.sisa).toBeLessThanOrEqual(30 * SEHARI + 300);
    expect(sesi.token).not.toBe(lama.token);
    harapStatus(await api.get('/api/staff/me', { token: lama.token }), 200);
    harapStatus(await api.get('/api/staff/me', { token: pemilik.token }), 200);
  });

  it('sandi salah, email tak dikenal, email non-ASCII, dan staf nonaktif → 401 invalid_credentials yang sama persis, tanpa sesi baru', async () => {
    const aktif = await stafLangsung('Kasir Aktif');
    const nonaktif = await stafLangsung('Mantan Kasir', { aktif: false });
    const mekanikNonaktif = await stafLangsung('Mantan Mekanik', { role: 'mechanic', aktif: false });
    const sebelum = await jumlahBaris('staff_sessions');

    const hasil = [
      await masukDengan(aktif.email, 'SandiSalah123!'),
      await masukDengan(emailUnik('hantu')),
      await masukDengan(emailUnik('josé')),
      await masukDengan(emailUnik('JOSÉ').toUpperCase()),
      await masukDengan(nonaktif.email),
      await masukDengan(mekanikNonaktif.email),
    ];

    for (const res of hasil) {
      harapGalat(res, 401, 'invalid_credentials');
      expect(res.body).toEqual(hasil[0]?.body);
    }
    expect(await jumlahBaris('staff_sessions')).toBe(sebelum);
  });

  it('email/sandi tidak dikirim, null, atau kosong → required; bukan string → invalid_type', async () => {
    const wajib = { email: 'required', password: 'required' };
    harapGalat(await masuk({ email: '', password: '' }), 422, 'validation_failed', wajib);
    harapGalat(await masuk({}), 422, 'validation_failed', wajib);
    harapGalat(await masuk({ email: null, password: null }), 422, 'validation_failed', wajib);
    harapGalat(await masuk({ email: pemilik.staff.email }), 422, 'validation_failed', { password: 'required' });
    harapGalat(await masuk({ password: SANDI_UJI }), 422, 'validation_failed', { email: 'required' });
    harapGalat(await masuk({ email: 5, password: ['x'] }), 422, 'validation_failed', { email: 'invalid_type', password: 'invalid_type' });
    harapGalat(await masuk({ email: true, password: {} }), 422, 'validation_failed', { email: 'invalid_type', password: 'invalid_type' });
    harapGalat(await masuk({ email: ['a@b.id'], password: 12345678 }), 422, 'validation_failed', { email: 'invalid_type', password: 'invalid_type' });
  });

  it('email dinilai setelah dipangkas (hanya spasi → required); sandi tidak dipangkas (spasi saja bukan kosong)', async () => {
    harapGalat(await masuk({ email: ' \t\r\n ', password: SANDI_UJI }), 422, 'validation_failed', { email: 'required' });
    harapGalat(await masuk({ email: '   ', password: '   ' }), 422, 'validation_failed', { email: 'required' });
    const { email } = await stafLangsung('Kasir Spasi');
    harapGalat(await masukDengan(email, ' '), 401, 'invalid_credentials');
  });

  it('format email dan panjang sandi tidak divalidasi saat masuk: semuanya 401, bukan 422', async () => {
    const { email } = await stafLangsung('Kasir Format');

    // Email unik: backend satu proses boleh menyimpan hitungan percobaan di
    // memori, jadi email tetap bisa terkunci bila suite dijalankan berulang.
    harapGalat(await masukDengan(emailUnik('bukan-email').replace('@', '')), 401, 'invalid_credentials');
    harapGalat(await masukDengan(`${'a'.repeat(300)}${emailUnik('x')}`), 401, 'invalid_credentials');
    harapGalat(await masukDengan(email, 'a'), 401, 'invalid_credentials');
    harapGalat(await masukDengan(email, 'a'.repeat(5000)), 401, 'invalid_credentials');
  });

  it('sandi dinilai apa adanya: spasi di awal atau akhir dan huruf besar membuat sandi benar menjadi salah', async () => {
    const { email } = await stafLangsung('Kasir Persis');

    harapGalat(await masukDengan(email, ` ${SANDI_UJI}`), 401, 'invalid_credentials');
    harapGalat(await masukDengan(email, `${SANDI_UJI} `), 401, 'invalid_credentials');
    harapGalat(await masukDengan(email, SANDI_UJI.toUpperCase()), 401, 'invalid_credentials');
    harapStatus(await masukDengan(email), 200);
  });

  it('sandi bermuatan NUL atau lebih dari 72 byte tidak pernah cocok → 401, bukan 500; tepat 72 byte masih cocok', async () => {
    const email = emailUnik('panjang');
    harapStatus(
      await api.post('/api/staff', { token: pemilik.token, json: { name: 'Kasir Panjang', email, password: 'a'.repeat(72), role: 'cashier' } }),
      201,
    );

    harapStatus(await masukDengan(email, 'a'.repeat(72)), 200);
    // bcrypt mengabaikan byte setelah ke-72; backend tidak boleh ikut mengabaikannya.
    harapGalat(await masukDengan(email, 'a'.repeat(73)), 401, 'invalid_credentials');
    harapGalat(await masukDengan(email, `${'a'.repeat(72)}\u0000`), 401, 'invalid_credentials');
    harapGalat(await masukDengan(email, `a\u0000${'a'.repeat(70)}`), 401, 'invalid_credentials');
  });

  it('sandi non-ASCII dihitung dalam byte: 36 huruf é (72 byte) cocok, 37 (74 byte) tidak', async () => {
    const email = emailUnik('aksen');
    harapStatus(await api.post('/api/staff', { token: pemilik.token, json: { name: 'Kasir Aksen', email, password: 'é'.repeat(36), role: 'cashier' } }), 201);

    harapStatus(await masukDengan(email, 'é'.repeat(36)), 200);
    harapGalat(await masukDengan(email, 'é'.repeat(37)), 401, 'invalid_credentials');
  });

  it('field lain di badan diabaikan (role, staffId tidak mengubah apa pun)', async () => {
    const { staffId, email } = await stafLangsung('Kasir Lain');

    const res = await masuk({ email, password: SANDI_UJI, role: 'owner', staffId: pemilik.staff.staffId, lain: 1 });

    harapStatus(res, 200);
    expect(res.body.data.staff).toMatchObject({ staffId, role: 'cashier' });
  });

  it('staf berbeda masuk bersamaan semuanya berhasil, dengan token berbeda', async () => {
    const semua = await Promise.all(Array.from({ length: 4 }, (_, i) => stafLangsung(`Kasir Serentak ${i}`)));

    const hasil = await Promise.all(semua.map((s) => masukDengan(s.email)));

    for (const res of hasil) {
      harapStatus(res, 200);
    }
    expect(new Set(hasil.map((r) => r.body.data.token)).size).toBe(4);
  });

  it('JSON rusak, kosong, atau bukan objek → 400 bad_request', async () => {
    for (const mentah of [JSON_RUSAK, 'bukan json', '', 'null', '[]', '"teks"', '123', 'true']) {
      harapGalat(await api.post('/api/staff/login', { mentah }), 400, 'bad_request');
    }
  });

  it('byte UTF-8 tidak sah, surrogat tunggal, atau bersarang lebih dari 64 tingkat → 400, bukan 422 atau 401', async () => {
    harapGalat(await api.post('/api/staff/login', { biner: badanUtf8Rusak() }), 400, 'bad_request');
    harapGalat(await api.post('/api/staff/login', { mentah: '{"email":"\\ud800@contoh.id","password":"SandiUji123!"}' }), 400, 'bad_request');
    harapGalat(await api.post('/api/staff/login', { mentah: jsonBersarang(65) }), 400, 'bad_request');
  });

  it('lebih dari 1 MiB → 413, mengalahkan 400 dan 422', async () => {
    harapGalat(await masuk({ email: 'a'.repeat(SATU_MIB + 10), password: SANDI_UJI }), 413, 'payload_too_large');
    harapGalat(await masuk({ catatan: 'a'.repeat(SATU_MIB + 10) }), 413, 'payload_too_large');
    harapGalat(await api.post('/api/staff/login', { mentah: `${JSON_RUSAK}${'a'.repeat(SATU_MIB + 10)}` }), 413, 'payload_too_large');
  });
});

describe('GET /api/staff/me dan sesi staf', () => {
  it('membalas profil yang sama dengan saat masuk, untuk ketiga peran', async () => {
    for (const sesi of [pemilik, await buatKasir(), await buatMekanik()]) {
      const res = await api.get('/api/staff/me', { token: sesi.token });

      harapStatus(res, 200);
      harapSetara(res.body.data, sesi.staff);
    }
  });

  it('peran dibaca dari database pada setiap permintaan: naik dan turun langsung berlaku tanpa masuk ulang', async () => {
    const mekanik = await buatMekanik();
    harapGalat(await api.get('/api/mechanics', { token: mekanik.token }), 403, 'forbidden');

    await jalankan("UPDATE staff SET role = 'cashier' WHERE staff_id = ?", [mekanik.staff.staffId]);
    expect((await api.get('/api/staff/me', { token: mekanik.token })).body.data.role).toBe('cashier');
    harapStatus(await api.get('/api/mechanics', { token: mekanik.token }), 200);
    harapGalat(await api.get('/api/staff', { token: mekanik.token }), 403, 'forbidden');

    await jalankan("UPDATE staff SET role = 'owner' WHERE staff_id = ?", [mekanik.staff.staffId]);
    expect((await api.get('/api/staff/me', { token: mekanik.token })).body.data.role).toBe('owner');
    harapStatus(await api.get('/api/staff', { token: mekanik.token }), 200);

    await jalankan("UPDATE staff SET role = 'mechanic' WHERE staff_id = ?", [mekanik.staff.staffId]);
    expect((await api.get('/api/staff/me', { token: mekanik.token })).body.data.role).toBe('mechanic');
    harapGalat(await api.get('/api/staff', { token: mekanik.token }), 403, 'forbidden');
  });

  it('tanpa header, skema lain, Bearer tanpa token, atau token tanpa skema → 401', async () => {
    const t = pemilik.token;

    harapGalat(await api.get('/api/staff/me'), 401, 'unauthenticated');
    for (const nilai of [`Basic ${t}`, `Token ${t}`, 'Bearer', 'Bearer ', '', t, `Bearer${t}`]) {
      harapGalat(await me({ Authorization: nilai }), 401, 'unauthenticated');
    }
  });

  it('token tak dikenal, terlalu pendek, terlalu panjang, berpadding, atau berkarakter di luar base64url → 401', async () => {
    const t = pemilik.token;

    for (const token of [tokenAcak(), 'x'.repeat(43), t.slice(0, 42), `${t}x`, `${t}=`, `${t.slice(0, 42)}+`, `${t.slice(0, 42)}/`, sha256Hex(t)]) {
      harapGalat(await api.get('/api/staff/me', { token }), 401, 'unauthenticated');
    }
  });

  it('token peka huruf besar/kecil', async () => {
    const alt = tukarHuruf(pemilik.token);
    if (alt === undefined) {
      return;
    }

    harapGalat(await api.get('/api/staff/me', { token: alt }), 401, 'unauthenticated');
  });

  it('header: nama skema tidak peka huruf besar/kecil; tepat satu spasi sebelum token', async () => {
    const t = pemilik.token;

    for (const skema of ['bearer', 'BEARER', 'BeArEr']) {
      harapStatus(await me({ Authorization: `${skema} ${t}` }), 200);
    }
    for (const nilai of [`Bearer  ${t}`, `Bearer\t${t}`, `Bearer ${t} x`, `Bearer: ${t}`, `Bearer ${t},${t}`]) {
      harapGalat(await me({ Authorization: nilai }), 401, 'unauthenticated');
    }
  });

  it('sesi yang dibuat dengan aturan bersama oleh backend lain (base64url 43 karakter, sha256 hex) diterima', async () => {
    const mekanik = await buatMekanik();
    for (const staf of [pemilik.staff, mekanik.staff]) {
      const token = await sisipkanSesi(staf.staffId);

      const res = await api.get('/api/staff/me', { token });

      harapStatus(res, 200);
      expect(res.body.data.staffId).toBe(staf.staffId);
    }
  });

  it('sesi yang sudah lewat expires_at → 401; yang belum lewat → 200', async () => {
    const lewat = await masukStaf(pemilik.staff.email);
    await geserSesi(lewat.token, { kedaluwarsaDetik: -60, terakhirDipakaiDetikLalu: 7200 });
    const belum = await masukStaf(pemilik.staff.email);
    await geserSesi(belum.token, { kedaluwarsaDetik: 120, terakhirDipakaiDetikLalu: 60 });

    harapGalat(await api.get('/api/staff/me', { token: lewat.token }), 401, 'unauthenticated');
    harapStatus(await api.get('/api/staff/me', { token: belum.token }), 200);
  });

  it('sesi bergeser: last_used_at sudah satu jam lalu → expires_at menjadi sekarang + 30 hari, last_used_at diperbarui (rute mana pun)', async () => {
    const kasir = await buatKasir();
    const mekanik = await buatMekanik();
    const kasus: Array<[SesiStaf, string]> = [
      [pemilik, '/api/staff/me'],
      [pemilik, '/api/staff'],
      [kasir, '/api/mechanics'],
      [mekanik, '/api/services'],
    ];

    for (const [staf, path] of kasus) {
      const sesi = await masukStaf(staf.staff.email);
      await geserSesi(sesi.token, { kedaluwarsaDetik: 3600, terakhirDipakaiDetikLalu: 3600 });

      harapStatus(await api.get(path, { token: sesi.token }), 200);

      const waktu = await waktuSesi(sesi.token);
      expect(waktu?.sisa, path).toBeGreaterThanOrEqual(30 * SEHARI - 300);
      expect(waktu?.sisa, path).toBeLessThanOrEqual(30 * SEHARI + 300);
      expect(waktu?.sejakDipakai, path).toBeLessThanOrEqual(60);
    }
  });

  it('staf yang dinonaktifkan langsung di database → token lamanya dan sesi baru di database 401', async () => {
    for (const sesi of [await buatKasir(), await buatMekanik()]) {
      await setAktif('staff', sesi.staff.staffId, false);

      harapGalat(await api.get('/api/staff/me', { token: sesi.token }), 401, 'unauthenticated');
      const tokenLuar = await sisipkanSesi(sesi.staff.staffId);
      harapGalat(await api.get('/api/staff/me', { token: tokenLuar }), 401, 'unauthenticated');
    }
  });
});

describe('POST /api/staff/logout', () => {
  it('204 tanpa badan untuk ketiga peran; token itu lalu ditolak dan barisnya hilang; sesi lain tetap berlaku', async () => {
    for (const staf of [pemilik, await buatKasir(), await buatMekanik()]) {
      const satu = await masukStaf(staf.staff.email);
      const dua = await masukStaf(staf.staff.email);

      const res = await api.post('/api/staff/logout', { token: satu.token });

      harapStatus(res, 204);
      expect(res.teks).toBe('');
      harapGalat(await api.get('/api/staff/me', { token: satu.token }), 401, 'unauthenticated');
      expect(await jumlahBaris('staff_sessions', 'token_hash = ?', [sha256Hex(satu.token)])).toBe(0);
      harapStatus(await api.get('/api/staff/me', { token: dua.token }), 200);
    }
  });

  it('keluar dua kali dengan token yang sama: yang kedua 401', async () => {
    const sesi = await masukStaf(pemilik.staff.email);
    harapStatus(await api.post('/api/staff/logout', { token: sesi.token }), 204);

    harapGalat(await api.post('/api/staff/logout', { token: sesi.token }), 401, 'unauthenticated');
  });

  it('tanpa token, token sampah, atau sesi kedaluwarsa → 401', async () => {
    harapGalat(await api.post('/api/staff/logout'), 401, 'unauthenticated');
    harapGalat(await api.post('/api/staff/logout', { token: tokenAcak() }), 401, 'unauthenticated');
    const lewat = await masukStaf(pemilik.staff.email);
    await geserSesi(lewat.token, { kedaluwarsaDetik: -60, terakhirDipakaiDetikLalu: 7200 });
    harapGalat(await api.post('/api/staff/logout', { token: lewat.token }), 401, 'unauthenticated');
  });

  it('badan diabaikan sepenuhnya: JSON rusak atau lebih dari 1 MiB dengan token sah tetap 204, tanpa token tetap 401 (bukan 400/413)', async () => {
    harapGalat(await api.post('/api/staff/logout', { mentah: JSON_RUSAK }), 401, 'unauthenticated');
    harapGalat(await api.post('/api/staff/logout', { mentah: `{"a":"${'a'.repeat(SATU_MIB + 10)}"}` }), 401, 'unauthenticated');
    harapStatus(await api.post('/api/staff/logout', { token: (await masukStaf(pemilik.staff.email)).token, mentah: JSON_RUSAK }), 204);
    harapStatus(await api.post('/api/staff/logout', { token: (await masukStaf(pemilik.staff.email)).token, mentah: '[]' }), 204);
    harapStatus(
      await api.post('/api/staff/logout', { token: (await masukStaf(pemilik.staff.email)).token, mentah: `{"a":"${'a'.repeat(SATU_MIB + 10)}"}` }),
      204,
    );
  });
});
