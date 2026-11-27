// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nyalakanWaPalsu, TOKEN_BAWAAN, type WaPalsuHidup } from '../src/server';

const TOKEN = 'token-tes-unit-wa-palsu';
const NOMOR = '6281234567890';
const LAIN = '6285700001111';

let hidup: WaPalsuHidup;

async function kendali(path: string, badan?: unknown) {
  const res = await fetch(`${hidup.alamat}/__kendali/${path}`, {
    method: badan === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: badan === undefined ? undefined : JSON.stringify(badan),
  });
  return { status: res.status, body: (await res.json()) as any };
}

function form(field: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [nama, nilai] of Object.entries(field)) {
    for (const v of Array.isArray(nilai) ? nilai : [nilai]) {
      f.append(nama, v);
    }
  }
  return f;
}

async function kirim(badan: NonNullable<RequestInit['body']>, header: Record<string, string> = {}) {
  const res = await fetch(`${hidup.alamat}/send`, { method: 'POST', headers: { Authorization: TOKEN, ...header }, body: badan });
  const teks = await res.text();
  let body: any;
  try {
    body = JSON.parse(teks);
  } catch {
    body = undefined;
  }
  return { status: res.status, body, teks, contentType: res.headers.get('content-type') };
}

// Multipart yang disusun tangan seperti pustaka Go/PHP: LF di dalam nilai
// dikirim apa adanya, tidak diubah menjadi CRLF.
function multipartTangan(field: Array<[string, string]>, batas = 'batasUji123'): { badan: string; jenis: string } {
  const bagian = field.map(([nama, nilai]) => `--${batas}\r\nContent-Disposition: form-data; name="${nama}"\r\n\r\n${nilai}\r\n`);
  return { badan: `${bagian.join('')}--${batas}--\r\n`, jenis: `multipart/form-data; boundary=${batas}` };
}

beforeAll(async () => {
  hidup = await nyalakanWaPalsu({ port: 0, token: TOKEN });
});

afterAll(async () => {
  await hidup.tutup();
});

beforeEach(async () => {
  await kendali('reset', {});
});

describe('kendali', () => {
  it('ping menyebut layanan, jalur kirim, dan sidik sha256 token (bukan tokennya)', async () => {
    const res = await kendali('ping');

    expect(res.body).toEqual({
      ok: true,
      layanan: 'wa-palsu',
      jalur: '/send',
      sidikToken: createHash('sha256').update(TOKEN).digest('hex'),
    });
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
  });

  it('token bawaan dipakai bila tidak diberikan', async () => {
    const lain = await nyalakanWaPalsu({ port: 0 });
    try {
      const ping = (await (await fetch(`${lain.alamat}/__kendali/ping`)).json()) as any;
      expect(ping.sidikToken).toBe(createHash('sha256').update(TOKEN_BAWAAN).digest('hex'));
    } finally {
      await lain.tutup();
    }
  });

  it('rute tak dikenal dan GET /send → 404; badan gangguan salah → 400', async () => {
    expect((await kendali('entah')).status).toBe(404);
    expect((await fetch(`${hidup.alamat}/send`)).status).toBe(404);
    expect((await kendali('gangguan', { gagal: 'ya' })).status).toBe(400);
    expect((await kendali('gangguan', { gagal: true, mode: 'lambat' })).status).toBe(400);
    expect((await kendali('gangguan', { gagal: true, nomor: '0812345' })).status).toBe(400);
  });

  it('reset mengosongkan pesan, catatan permintaan, gangguan, dan nomor urut', async () => {
    await kirim(form({ target: NOMOR, message: 'satu' }));
    await kendali('gangguan', { gagal: true });

    await kendali('reset', {});

    expect((await kendali('pesan')).body.data).toEqual([]);
    expect((await kendali('permintaan')).body.data).toEqual([]);
    const res = await kirim(form({ target: NOMOR, message: 'dua' }));
    expect(res.body).toMatchObject({ status: true, requestid: 1, id: ['1'] });
  });
});

describe('POST /send yang sah', () => {
  it('membalas seperti contoh Fonnte dan menyimpan pesan', async () => {
    const res = await kirim(form({ target: NOMOR, message: 'Halo Budi Santoso, servis B 1234 XYZ sudah selesai dan kendaraan siap diambil.\n\nTotal: Rp165.000' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      detail: 'success! message in queue',
      id: ['1'],
      process: 'pending',
      requestid: 1,
      status: true,
      target: [NOMOR],
    });
    const [pesan] = (await kendali('pesan')).body.data;
    expect(pesan).toEqual({
      nomor: 1,
      waktu: expect.any(String),
      target: NOMOR,
      pesan: 'Halo Budi Santoso, servis B 1234 XYZ sudah selesai dan kendaraan siap diambil.\n\nTotal: Rp165.000',
    });
  });

  it('LF yang diubah FormData menjadi CRLF dan LF apa adanya tersimpan sama', async () => {
    const teks = 'baris satu\nbaris dua\n\nbaris empat';
    await kirim(form({ target: NOMOR, message: teks }));
    const tangan = multipartTangan([
      ['message', teks],
      ['target', NOMOR],
    ]);
    await kirim(tangan.badan, { 'Content-Type': tangan.jenis });

    const pesan = (await kendali('pesan')).body.data.map((p: any) => p.pesan);
    expect(pesan).toEqual([teks, teks]);
  });

  it('teks non-ASCII (tanda pisah "–" di jam buka, huruf beraksen) tersimpan apa adanya', async () => {
    const teks = 'Bengkel Maju Jaya\nSPK S-0012\n\nJam buka: Senin–Sabtu 08.00–17.00\nCatatan: José, kaki nota\nbaris dua';
    await kirim(form({ target: NOMOR, message: teks }));
    const tangan = multipartTangan([
      ['target', NOMOR],
      ['message', teks],
    ]);
    await kirim(tangan.badan, { 'Content-Type': `${tangan.jenis}` });

    expect((await kendali('pesan')).body.data.map((p: any) => p.pesan)).toEqual([teks, teks]);
  });

  it('tidak menafsirkan isi pesan: tidak ada kolom kode dan angka enam digit tetap teks biasa', async () => {
    await kirim(form({ target: NOMOR, message: 'Halo\nTotal: 123456' }));

    const [pesan] = (await kendali('pesan')).body.data;
    expect(Object.keys(pesan).sort()).toEqual(['nomor', 'pesan', 'target', 'waktu']);
  });

  it('?to= menyaring per nomor tujuan, urut dari yang pertama masuk', async () => {
    await kirim(form({ target: NOMOR, message: 'a' }));
    await kirim(form({ target: LAIN, message: 'b' }));
    await kirim(form({ target: NOMOR, message: 'c' }));

    expect((await kendali(`pesan?to=${NOMOR}`)).body.data.map((p: any) => p.pesan)).toEqual(['a', 'c']);
    expect((await kendali(`pesan?to=${LAIN}`)).body.data.map((p: any) => p.nomor)).toEqual([2]);
    expect((await kendali('pesan')).body.data).toHaveLength(3);
  });

  it('setiap permintaan tercatat beserta field-nya, tanpa token', async () => {
    await kirim(form({ target: NOMOR, message: 'tercatat' }));

    const [catatan] = (await kendali('permintaan')).body.data;
    expect(catatan).toMatchObject({
      nomor: 1,
      metode: 'POST',
      path: '/send',
      tokenSah: true,
      field: { target: [NOMOR], message: ['tercatat'] },
      fieldBerkas: [],
      hasil: 'terkirim',
      alasan: null,
      statusHttp: 200,
    });
    expect(catatan.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(JSON.stringify(catatan)).not.toContain(TOKEN);
  });
});

describe('penolakan meniru Fonnte: HTTP 200 dengan status false', () => {
  it.each([
    ['tanpa Authorization', {}],
    ['token lain', { Authorization: 'token-lain' }],
    ['memakai awalan Bearer', { Authorization: `Bearer ${TOKEN}` }],
  ])('%s → "Status": false, "token invalid"', async (_nama, header) => {
    const res = await fetch(`${hidup.alamat}/send`, { method: 'POST', headers: header, body: form({ target: NOMOR, message: 'x' }) });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body).toEqual({ Status: false, reason: 'token invalid', requestid: 1 });
    expect((await kendali('pesan')).body.data).toEqual([]);
    expect((await kendali('permintaan')).body.data[0]).toMatchObject({ tokenSah: false, hasil: 'ditolak' });
  });

  it.each([
    ['JSON', JSON.stringify({ target: NOMOR, message: 'x' }), 'application/json'],
    ['urlencoded', new URLSearchParams({ target: NOMOR, message: 'x' }).toString(), 'application/x-www-form-urlencoded'],
  ])('badan %s → "input invalid"', async (_nama, badan, jenis) => {
    const res = await kirim(badan, { 'Content-Type': jenis });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reason: 'input invalid', status: false, requestid: 1 });
    expect((await kendali('pesan')).body.data).toEqual([]);
  });

  it.each([
    ['field tambahan countryCode', { target: NOMOR, message: 'x', countryCode: '62' }],
    ['tanpa message', { target: NOMOR }],
    ['tanpa target', { message: 'x' }],
    ['target dua kali', { target: [NOMOR, NOMOR], message: 'x' }],
    ['message kosong', { target: NOMOR, message: '  ' }],
  ])('%s → "input invalid"', async (_nama, field) => {
    const res = await kirim(form(field));

    expect(res.body).toEqual({ reason: 'input invalid', status: false, requestid: 1 });
    expect((await kendali('permintaan')).body.data[0].alasan).toEqual(expect.any(String));
  });

  it('field berkas → "input invalid"', async () => {
    const f = form({ target: NOMOR, message: 'x' });
    f.append('file', new Blob(['isi']), 'nota.txt');

    expect((await kirim(f)).body).toMatchObject({ reason: 'input invalid', status: false });
    expect((await kendali('permintaan')).body.data[0].fieldBerkas).toEqual(['file']);
  });

  it.each([
    ['awalan 08', '081234567890'],
    ['dua nomor', `${NOMOR},${LAIN}`],
    ['terlalu pendek', '628123'],
    ['huruf', '62812345678a'],
  ])('target %s → "target invalid"', async (_nama, target) => {
    expect((await kirim(form({ target, message: 'x' }))).body).toEqual({ reason: 'target invalid', status: false, requestid: 1 });
  });
});

describe('gangguan', () => {
  it('status-false (bawaan) untuk semua nomor: HTTP 200 dengan status false, pesan tidak tersimpan', async () => {
    expect((await kendali('gangguan', { gagal: true })).body.gangguan).toEqual({ semua: 'status-false', nomor: {} });

    const res = await kirim(form({ target: NOMOR, message: 'x' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reason: 'device disconnected', status: false, requestid: 1 });
    expect((await kendali('pesan')).body.data).toEqual([]);
    expect((await kendali('permintaan')).body.data[0]).toMatchObject({ hasil: 'gangguan', alasan: 'gangguan status-false' });
  });

  it('http-500: balasan HTML berstatus 500', async () => {
    await kendali('gangguan', { gagal: true, mode: 'http-500' });

    const res = await kirim(form({ target: NOMOR, message: 'x' }));

    expect(res.status).toBe(500);
    expect(res.contentType).toMatch(/^text\/html/);
    expect(res.body).toBeUndefined();
  });

  it('putus: koneksi ditutup tanpa balasan', async () => {
    await kendali('gangguan', { gagal: true, mode: 'putus' });

    const galat = await kirim(form({ target: NOMOR, message: 'x' })).catch((g: unknown) => g);

    expect(galat).toBeInstanceOf(Error);
    expect((await kendali('permintaan')).body.data[0]).toMatchObject({ hasil: 'gangguan', statusHttp: null });
  });

  it('gangguan per nomor hanya mengenai nomor itu, lalu bisa dimatikan', async () => {
    await kendali('gangguan', { gagal: true, nomor: LAIN, mode: 'http-500' });

    expect((await kirim(form({ target: NOMOR, message: 'lolos' }))).body.status).toBe(true);
    expect((await kirim(form({ target: LAIN, message: 'gagal' }))).status).toBe(500);

    await kendali('gangguan', { gagal: false, nomor: LAIN });
    expect((await kirim(form({ target: LAIN, message: 'lolos lagi' }))).body.status).toBe(true);
    expect((await kendali('pesan')).body.data.map((p: any) => p.pesan)).toEqual(['lolos', 'lolos lagi']);
  });

  it('gangguan per nomor mengalahkan gangguan semua; gagal:false tanpa nomor mematikan semuanya', async () => {
    await kendali('gangguan', { gagal: true, mode: 'http-500' });
    await kendali('gangguan', { gagal: true, nomor: NOMOR, mode: 'status-false' });

    expect((await kirim(form({ target: NOMOR, message: 'x' }))).status).toBe(200);
    expect((await kirim(form({ target: LAIN, message: 'x' }))).status).toBe(500);

    expect((await kendali('gangguan', { gagal: false })).body.gangguan).toEqual({ semua: null, nomor: {} });
    expect((await kirim(form({ target: NOMOR, message: 'x' }))).body.status).toBe(true);
  });
});

describe('mode gangguan untuk alasan gagal', () => {
  it('alasan-panjang: status false dengan reason 600 huruf non-ASCII', async () => {
    await kendali('gangguan', { gagal: true, mode: 'alasan-panjang' });

    const res = await kirim(form({ target: NOMOR, message: 'x' }));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(false);
    expect([...res.body.reason].length).toBeGreaterThan(600);
    expect(res.body.reason).toContain('é');
  });

  it('gema-token: reason memuat ulang header Authorization', async () => {
    await kendali('gangguan', { gagal: true, nomor: NOMOR, mode: 'gema-token' });

    const res = await kirim(form({ target: NOMOR, message: 'x' }));

    expect(res.body).toMatchObject({ status: false, reason: `token tidak dikenali: ${TOKEN}` });
    expect((await kendali('pesan')).body.data).toEqual([]);
  });

  it('status-besar: HTTP 200 dengan "Status": false tanpa field status huruf kecil', async () => {
    await kendali('gangguan', { gagal: true, nomor: NOMOR, mode: 'status-besar' });

    const res = await kirim(form({ target: NOMOR, message: 'x' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ Status: false, reason: 'device disconnected', requestid: 1 });
    expect('status' in res.body).toBe(false);
    expect((await kendali('pesan')).body.data).toEqual([]);
    expect((await kendali('permintaan')).body.data[0]).toMatchObject({ hasil: 'gangguan', alasan: 'gangguan status-besar', statusHttp: 200 });
  });
});

describe('jeda', () => {
  it('menahan balasan; selama ditahan, permintaan tercatat "diproses"', async () => {
    expect((await kendali('jeda', { ms: 400, nomor: NOMOR })).body.jeda).toEqual({ semua: 0, nomor: { [NOMOR]: 400 } });

    const mulai = Date.now();
    const janji = kirim(form({ target: NOMOR, message: 'tertunda' }));
    await new Promise((r) => setTimeout(r, 150));
    const selamaDitahan = (await kendali('permintaan')).body.data;
    const res = await janji;

    expect(selamaDitahan).toHaveLength(1);
    expect(selamaDitahan[0]).toMatchObject({ hasil: 'diproses', statusHttp: null, field: { target: [NOMOR] } });
    expect(Date.now() - mulai).toBeGreaterThanOrEqual(380);
    expect(res.body.status).toBe(true);
    expect((await kendali('permintaan')).body.data[0]).toMatchObject({ hasil: 'terkirim', statusHttp: 200 });
  });

  it('jeda hanya untuk nomor yang disebut; ms 0 mematikannya; reset mematikan semua', async () => {
    await kendali('jeda', { ms: 3000, nomor: LAIN });

    const mulai = Date.now();
    await kirim(form({ target: NOMOR, message: 'cepat' }));
    expect(Date.now() - mulai).toBeLessThan(1000);

    await kendali('jeda', { ms: 0, nomor: LAIN });
    await kendali('jeda', { ms: 3000 });
    await kendali('reset', {});
    const lagi = Date.now();
    await kirim(form({ target: LAIN, message: 'cepat juga' }));
    expect(Date.now() - lagi).toBeLessThan(1000);
  });

  it('badan jeda tidak sah → 400; jeda lebih dari 10 detik (batas waktu backend) sampai 15 detik boleh', async () => {
    expect((await kendali('jeda', {})).status).toBe(400);
    expect((await kendali('jeda', { ms: -1 })).status).toBe(400);
    expect((await kendali('jeda', { ms: 15_001 })).status).toBe(400);
    expect((await kendali('jeda', { ms: 10, nomor: '0812' })).status).toBe(400);
    expect((await kendali('jeda', { ms: 15_000, nomor: NOMOR })).body.jeda).toEqual({ semua: 0, nomor: { [NOMOR]: 15_000 } });
    expect((await kendali('jeda', { ms: 12_000 })).body.jeda).toEqual({ semua: 12_000, nomor: { [NOMOR]: 15_000 } });
  });

  it('pengirim yang menutup koneksi selama jeda (waktu habis): tercatat "ditinggal" dan pesannya tidak disimpan', async () => {
    await kendali('jeda', { ms: 800, nomor: NOMOR });

    const galat = await fetch(`${hidup.alamat}/send`, {
      method: 'POST',
      headers: { Authorization: TOKEN },
      body: form({ target: NOMOR, message: 'ditinggal' }),
      signal: AbortSignal.timeout(200),
    }).catch((g: unknown) => g);
    expect(galat).toBeInstanceOf(Error);
    await new Promise((r) => setTimeout(r, 900));

    expect((await kendali('permintaan')).body.data[0]).toMatchObject({ hasil: 'ditinggal', statusHttp: null, field: { target: [NOMOR] } });
    expect((await kendali('pesan')).body.data).toEqual([]);
  });
});

describe('halaman web', () => {
  it('mengelompokkan per nomor, terbaru di atas, dan isi di-escape', async () => {
    await kirim(form({ target: NOMOR, message: 'Halo Budi Santoso, kendaraan kamu sudah kami terima untuk diservis.' }));
    await kirim(form({ target: LAIN, message: 'SPK <b>S-0001</b>' }));

    const res = await fetch(`${hidup.alamat}/`);
    const html = await res.text();

    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(html).toContain('Halo Budi Santoso, kendaraan kamu sudah kami terima untuk diservis.');
    expect(html).toContain('SPK &lt;b&gt;S-0001&lt;/b&gt;');
    expect(html).not.toContain('<b>S-0001</b>');
    expect(html.indexOf(`+${LAIN}`)).toBeLessThan(html.indexOf(`+${NOMOR}`));
  });

  it('?nomor= hanya menampilkan satu nomor; tombol Kosongkan kembali ke daftar', async () => {
    await kirim(form({ target: NOMOR, message: 'punya nomor satu' }));
    await kirim(form({ target: LAIN, message: 'punya nomor dua' }));

    const html = await (await fetch(`${hidup.alamat}/?nomor=${NOMOR}`)).text();
    expect(html).toContain('punya nomor satu');
    expect(html).not.toContain('punya nomor dua');

    const reset = await fetch(`${hidup.alamat}/__kendali/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
    });
    expect(reset.status).toBe(303);
    expect(reset.headers.get('location')).toBe('/');
    expect((await kendali('pesan')).body.data).toEqual([]);
  });
});
