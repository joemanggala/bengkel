// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import fixtur from '../fixtur/bcrypt.json';
import { bacaSatu, baca, jumlahBaris, kosongkanDatabase, namaDatabase, pastikanDatabaseUji, sisipkanStaf, TABEL, tutupDatabase } from './db';
import { bacaEnv, samarkanUrl } from './env';
import {
  LABEL_STATUS_SPK,
  nomorSpk,
  normalisasiHp,
  normalisasiPlat,
  OUTLET_AWAL,
  pesanBookingDikonfirmasi,
  pesanBookingDitolak,
  pesanNota,
  pesanSiapDiambil,
  pesanSpkDibuat,
  pesanStokKurang,
  rentangUtcTanggalWib,
  rupiah,
  samarkanHp,
  statusBayar,
  tanggal,
  tanggalWibDari,
  tautanLacak,
  waktuWib,
} from './format';
import { GalatKontrak, validasi, type Respons } from './klien';
import { cekDatabase, pastikanWaPalsu } from './persiapan';
import { bundelSpec, cariOperasi, labelSpec, muatSpec, pesanBaku, skemaKomponen } from './spec';
import { waPalsu } from './wa';

// Membuktikan harness siap tanpa backend: database uji, pengaman nama
// database, pengosongan tabel beserta baris awalnya, WhatsApp palsu (lewat
// permintaan multipart sungguhan), fixtur bcrypt, penyusun pesan dan aturan
// nilai terhadap contoh yang dibaca langsung dari spec, validator respons
// terhadap semua contoh respons di spec, dan header hak cipta serta LF di
// berkas milik Bagian 0. BASE_URL tidak dipakai di sini, tetapi bacaEnv
// mewajibkannya; port 8881 memilih database bengkel_uji dan WhatsApp palsu 8891.
process.env.BASE_URL ??= 'http://localhost:8881';

const AKAR = fileURLToPath(new URL('../../../', import.meta.url));

function ok(pesan: string): void {
  console.log(`OK   ${pesan}`);
}

function samaDengan(nama: string, aktual: unknown, harapan: unknown): void {
  if (JSON.stringify(aktual) !== JSON.stringify(harapan)) {
    throw new Error(`${nama}:\n  harapan ${JSON.stringify(harapan)}\n  dapat   ${JSON.stringify(aktual)}`);
  }
}

// Isi bertanda `…` di sebuah teks, berurutan.
function kutipan(teks: string): string[] {
  return [...teks.matchAll(/`([^`]*)`/g)].map((m) => m[1] ?? '');
}

// Baris tabel markdown (| a | b | c |) di deskripsi spec, tanpa baris judul dan pemisah.
function barisTabel(teks: string): string[][] {
  return teks
    .split('\n')
    .filter((b) => b.trim().startsWith('|') && !/^\|[\s|:-]+\|$/.test(b.trim()))
    .slice(1)
    .map((b) => b.trim().slice(1, -1).split('|').map((s) => s.trim()));
}

async function cekDatabaseDanPengosongan(): Promise<void> {
  const env = bacaEnv();
  await cekDatabase(env);
  ok(`database uji terhubung (${samarkanUrl(env.databaseUrl)}) dan ${TABEL.length} tabel lengkap`);

  const urlDev = new URL(env.databaseUrl);
  urlDev.pathname = '/bengkel';
  let ditolak = false;
  try {
    pastikanDatabaseUji(urlDev.toString());
  } catch (galat) {
    ditolak = true;
    ok(`pengaman menolak database "${namaDatabase(urlDev.toString())}": ${(galat as Error).message}`);
  }
  if (!ditolak) {
    throw new Error('pengaman nama database TIDAK menolak database dev');
  }
  pastikanDatabaseUji(env.databaseUrl);
  ok(`pengaman menerima "${namaDatabase(env.databaseUrl)}"`);

  await sisipkanStaf({ name: 'Cek Harness', email: `cek-${randomUUID().slice(0, 8)}@contoh.id`, role: 'mechanic', passwordHash: fixtur.hash.node });
  const sebelum = await jumlahBaris('staff');
  await kosongkanDatabase();
  const sisa = await Promise.all(TABEL.map(async (t) => [t, await jumlahBaris(t)] as const));
  const harapan: Record<string, number> = { outlet: 1, counters: 2 };
  const salah = sisa.filter(([t, n]) => n !== (harapan[t] ?? 0));
  if (sebelum < 1 || salah.length > 0) {
    throw new Error(`pengosongan gagal: ${JSON.stringify(salah)}`);
  }
  const outlet = await bacaSatu(
    'SELECT name, tagline, address, phone, opening_hours AS openingHours, maps_url AS mapsUrl, receipt_footer AS receiptFooter FROM outlet WHERE outlet_id = 1',
  );
  samaDengan('baris outlet sesudah pengosongan', outlet, OUTLET_AWAL);
  const penghitung = await baca('SELECT name, value FROM counters ORDER BY name');
  samaDengan('baris counters sesudah pengosongan', penghitung.map((p) => [p.name, Number(p.value)]), [
    ['booking_number', 0],
    ['work_order_number', 0],
  ]);
  ok(`pengosongan tabel: staff ${sebelum} → 0, outlet "Nama Bengkel" dan dua penghitung 0 dimasukkan lagi persis migration`);
}

async function cekWaPalsu(): Promise<void> {
  const env = bacaEnv();
  const wa = await pastikanWaPalsu(env);
  try {
    const ping = await waPalsu.ping();
    ok(`WhatsApp palsu menjawab ping di ${env.waPalsuUrl} (token sama, ${wa ? 'dinyalakan harness' : 'sudah menyala'})`);
    await waPalsu.reset();
    const nomor = '6281200000001';
    const isi = 'Nama Bengkel\nSPK S-0001\n\nHalo Budi, kendaraan kamu sudah kami terima untuk diservis.';
    const kirim = async (token: string) => {
      const form = new FormData();
      form.append('target', nomor);
      form.append('message', isi);
      const res = await fetch(`${env.waPalsuUrl}${ping.jalur}`, { method: 'POST', headers: { Authorization: token }, body: form });
      return (await res.json()) as Record<string, unknown>;
    };
    const salahToken = await kirim('token-yang-salah');
    const sah = await kirim(env.waToken);
    const diterima = await waPalsu.terakhir(nomor);
    if (salahToken.Status !== false || sah.status !== true || diterima.pesan !== isi) {
      throw new Error(`WhatsApp palsu tidak berperilaku seperti seharusnya: ${JSON.stringify({ salahToken, sah, diterima })}`);
    }
    await waPalsu.reset();
    ok(`POST ${env.waPalsuUrl}${ping.jalur} menolak token lain ("Status": false) dan menyimpan pesan sah`);
  } finally {
    await wa?.tutup();
  }
}

function cekFixtur(): void {
  for (const [nama, hash] of Object.entries(fixtur.hash)) {
    if (!bcrypt.compareSync(fixtur.sandi, hash) || bcrypt.compareSync(`${fixtur.sandi}x`, hash) || !/^\$2[aby]\$12\$/.test(hash)) {
      throw new Error(`hash bcrypt fixtur "${nama}" tidak cocok dengan sandi uji atau bukan cost 12`);
    }
  }
  ok(`fixtur bcrypt: ${Object.keys(fixtur.hash).join(', ')} cocok dengan sandi uji (cost 12) dan menolak sandi lain`);
}

// Contoh di spec/whatsapp.md dan deskripsi skema openapi; bila salah satunya
// berbeda, penyusun harness tidak sejalan dengan spec.
function cekFormatTerhadapSpec(): void {
  const md = readFileSync(join(AKAR, 'spec/whatsapp.md'), 'utf8');
  const tabelNilai = md.split('\n').filter((b) => b.startsWith('| `'));
  const baris = (awal: string) => tabelNilai.find((b) => b.startsWith(`| \`${awal}`)) ?? '';
  const contohRupiah = kutipan(baris('rupiah(x)')).filter((k) => /^Rp[0-9.]+$/.test(k));
  for (const contoh of contohRupiah) {
    samaDengan(`rupiah ${contoh}`, rupiah(Number(contoh.slice(2).replaceAll('.', ''))), contoh);
  }
  const [dTanggal, hTanggal] = kutipan(baris('tanggal(d)')).slice(-2);
  samaDengan('tanggal()', tanggal(dTanggal ?? ''), hTanggal);
  const waktu = kutipan(baris('waktu(t)')).filter((k) => /^\d{4}-|^\d{2}-/.test(k));
  for (let i = 0; i + 1 < waktu.length; i += 2) {
    samaDengan(`waktu(${waktu[i]})`, waktuWib(waktu[i] ?? ''), waktu[i + 1]);
  }
  if (contohRupiah.length < 5 || waktu.length < 4) {
    throw new Error(`tabel "Format nilai" di whatsapp.md tidak terbaca (${contohRupiah.length} rupiah, ${waktu.length / 2} waktu)`);
  }
  ok(`${contohRupiah.length} contoh rupiah, tanggal, dan ${waktu.length / 2} contoh waktu WIB sama dengan tabel "Format nilai" di whatsapp.md`);

  const blok = [...md.matchAll(/```text\n([\s\S]*?)\n```/g)].map((m) => m[1] ?? '').filter((b) => !b.includes('{'));
  const token = 'Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk';
  const majuJaya = { name: 'Bengkel Maju Jaya', address: 'Jl. Merdeka No. 10, Bandung', openingHours: 'Senin–Sabtu 08.00–17.00', receiptFooter: 'Garansi servis 7 hari.' };
  const kosong = { name: 'Nama Bengkel', address: '', openingHours: '', receiptFooter: '' };
  const vario = { plate: 'B 1234 XYZ', brand: 'Honda', model: 'Vario 125' };
  const budi = { name: 'Budi Santoso' };
  // PUBLIC_WEB_URL sengaja bergaris miring akhir: harus dibuang.
  const tautan = tautanLacak('https://bengkelku.id/', token);
  const dibuat = [
    pesanBookingDikonfirmasi(majuJaya, { number: 'B-0007', plate: 'B 1234 XYZ', visitDate: '2026-11-28', serviceName: 'Ganti Oli' }),
    pesanBookingDikonfirmasi(kosong, { number: 'B-0008', plate: 'D 1', visitDate: '2026-12-01', serviceName: null }),
    pesanBookingDitolak(
      majuJaya,
      { number: 'B-0007', plate: 'B 1234 XYZ', visitDate: '2026-11-28', rejectReason: 'Bengkel tutup tanggal itu, silakan pilih tanggal lain.' },
      'https://bengkelku.id/',
    ),
    pesanSpkDibuat(majuJaya, { number: 'S-0012', customer: budi, vehicle: vario, estimatedDoneAt: '2026-11-28T08:00:00.000Z' }, tautan),
    pesanSiapDiambil(majuJaya, { number: 'S-0012', customer: budi, vehicle: vario, total: 165000, paidAmount: 50000 }, tautan),
    pesanNota(
      majuJaya,
      {
        number: 'S-0012',
        customer: budi,
        vehicle: vario,
        createdAt: '2026-11-28T01:15:00.000Z',
        status: 'DONE',
        items: [
          { name: 'Ganti Oli', quantity: 1, price: 35000, subtotal: 35000 },
          { name: 'Oli Mesin 10W-40 0,8 L', quantity: 1, price: 55000, subtotal: 55000 },
          { name: 'Kampas Rem Depan Vario', quantity: 1, price: 75000, subtotal: 75000 },
        ],
        serviceSubtotal: 35000,
        partSubtotal: 130000,
        total: 165000,
        paidAmount: 50000,
      },
      tautan,
    ),
    pesanNota(
      kosong,
      {
        number: 'S-0013',
        customer: { name: 'Ani' },
        vehicle: { plate: 'D 1', brand: 'Yamaha', model: '' },
        createdAt: '2026-11-28T02:00:00Z',
        status: 'QUEUED',
        items: [],
        serviceSubtotal: 0,
        partSubtotal: 0,
        total: 0,
        paidAmount: 0,
      },
      tautanLacak('http://localhost:3800', token),
    ),
  ];
  samaDengan('jumlah contoh pesan di whatsapp.md', blok.length, dibuat.length);
  for (const [i, pesan] of dibuat.entries()) {
    samaDengan(`contoh pesan ke-${i + 1} di whatsapp.md`, pesan.split('\n'), (blok[i] ?? '').split('\n'));
  }
  ok(`${dibuat.length} contoh pesan WhatsApp di whatsapp.md sama huruf demi huruf dengan penyusun harness`);

  const tabelPlat = barisTabel(String(skemaKomponen('PlatMasukan').description));
  for (const [masuk, kunci, tampil] of tabelPlat) {
    const ketikan = kutipan(masuk ?? '')[0] ?? '';
    const harapan = kunci === '—' ? { galat: kutipan(tampil ?? '')[0] } : { nilai: { kunci: kutipan(kunci ?? '')[0], tampilan: kutipan(tampil ?? '')[0] } };
    samaDengan(`plat "${ketikan}"`, normalisasiPlat(ketikan), harapan);
  }
  const tabelHp = barisTabel(String(skemaKomponen('NomorHpMasukan').description));
  for (const [masuk, hasil] of tabelHp) {
    const nilai = kutipan(hasil ?? '')[0] ?? '';
    samaDengan(`nomor HP "${masuk}"`, normalisasiHp(kutipan(masuk ?? '')[0]), /^\d+$/.test(nilai) ? { nilai } : { galat: nilai });
  }
  const samaran = kutipan(String(skemaKomponen('NomorHpSamaran').description)).filter((k) => /^628/.test(k));
  for (let i = 0; i + 1 < samaran.length; i += 2) {
    samaDengan(`samaran ${samaran[i]}`, samarkanHp(samaran[i] ?? ''), samaran[i + 1]);
  }
  if (tabelPlat.length < 10 || tabelHp.length < 6 || samaran.length < 6) {
    throw new Error(`tabel contoh plat/HP di spec tidak terbaca (${tabelPlat.length}, ${tabelHp.length}, ${samaran.length})`);
  }
  ok(`${tabelPlat.length} contoh plat, ${tabelHp.length} contoh nomor HP, dan ${samaran.length / 2} contoh samaran di skema spec cocok`);

  const deskripsi = String(muatSpec().info.description);
  const contohStok = kutipan(deskripsi).find((k) => k.startsWith('Stok sparepart tidak cukup: Kampas'));
  samaDengan('contoh pesan insufficient_stock', pesanStokKurang({ name: 'Kampas Rem Depan Vario', unit: 'set', butuh: 3, tersedia: 2 }), contohStok);
  samaDengan('x-label StatusSpk', LABEL_STATUS_SPK, labelSpec('StatusSpk'));
  samaDengan('nomor SPK di contoh spec', kutipan(String(skemaKomponen('NomorSpk').description)).filter((k) => /^S-[0-9]+$/.test(k)), [1, 9999, 10000].map(nomorSpk));
  samaDengan('StatusBayar', [statusBayar(0, 0), statusBayar(100, 0), statusBayar(100, 40), statusBayar(100, 100)], ['paid', 'unpaid', 'partial', 'paid']);
  const rentang = rentangUtcTanggalWib('2026-11-27');
  samaDengan('rentang UTC tanggal WIB', [rentang.mulai.toISOString(), rentang.akhir.toISOString()], ['2026-11-26T17:00:00.000Z', '2026-11-27T17:00:00.000Z']);
  // Contoh di BuatBookingRequest.visitDate: 27-11-2026 17.30 UTC = 28-11-2026 WIB.
  samaDengan('tanggal WIB dari waktu UTC', [tanggalWibDari('2026-11-27T16:30:00Z'), tanggalWibDari('2026-11-27T17:30:00.123456Z')], ['2026-11-27', '2026-11-28']);
  ok('pesan insufficient_stock, label status, nomor SPK, status bayar, dan tanggal WIB sesuai spec');
}

function responsPalsu(metode: string, path: string, status: number, body: unknown, opsi: { peran?: Respons['peran']; header?: Record<string, string> } = {}): Respons {
  const header = new Headers(opsi.header);
  if (body !== undefined) {
    header.set('content-type', 'application/json; charset=utf-8');
  }
  const teks = body === undefined ? '' : JSON.stringify(body);
  return { status, header, body, teks, metode, path, peran: opsi.peran };
}

function contohPath(template: string): string {
  return template
    .replace('{number}', 'S-0001')
    .replace(/\{(bookingToken|trackingToken)\}/, 'Vt4mQ9xZ2kLp8RwN5sYb7HcJ3fGd6EaU1oIq0Te_-Xk')
    .replace(/\{[^}]+\}/g, randomUUID());
}

function ditolak(nama: string, res: Respons): void {
  try {
    validasi(res);
  } catch (galat) {
    if (galat instanceof GalatKontrak) {
      return;
    }
    throw galat;
  }
  throw new Error(`validator respons MELOLOSKAN ${nama}`);
}

// Validator respons memakai Ajv langsung terhadap skema spec yang dibundel.
// Semua contoh respons di spec harus lolos (termasuk validation_failed yang
// memakai if/then di skema Galat), dan kebocoran yang dilarang spec harus
// ditolak, termasuk aturan per peran di daftar sparepart.
function cekValidatorRespons(): void {
  const operasi = Object.entries(muatSpec().paths as Record<string, Record<string, any>>).flatMap(([template, item]) =>
    Object.entries(item)
      .filter(([m]) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
      .map(([m, op]) => ({ template, metode: m.toUpperCase(), op })),
  );
  const tidakDikenal = operasi.filter((o) => cariOperasi(o.metode, contohPath(o.template))?.op.operationId !== o.op.operationId);
  if (tidakDikenal.length > 0) {
    throw new Error(`cariOperasi tidak mengenali: ${tidakDikenal.map((o) => `${o.metode} ${o.template}`).join(', ')}`);
  }
  samaDengan('segmen tetap /api/staff/me', cariOperasi('GET', '/api/staff/me')?.op.operationId, 'stafSaya');
  ok(`${operasi.length} operasi spec dikenali pencocok rute (segmen tetap didahulukan)`);

  let jumlah = 0;
  for (const { template, metode, op } of operasi) {
    for (const [kode, respons] of Object.entries(op.responses as Record<string, any>)) {
      const media = respons.content?.['application/json'];
      const contoh: Array<[string, unknown]> = [
        ...(media?.example !== undefined ? [['example', media.example] as [string, unknown]] : []),
        ...Object.entries((media?.examples ?? {}) as Record<string, { value: unknown }>).map(([n, e]) => [n, e.value] as [string, unknown]),
      ];
      for (const [nama, isi] of contoh) {
        const peran = nama === 'kasir' ? 'cashier' : 'owner';
        const header = respons.headers?.['Retry-After'] ? { 'Retry-After': '900' } : undefined;
        validasi(responsPalsu(metode, contohPath(template), Number(kode), isi, { peran, header }));
        jumlah += 1;
      }
    }
  }
  ok(`${jumlah} contoh respons di spec lolos validator respons (Ajv, skema tertutup)`);

  const ex = (nama: string) => (muatSpec().paths['/api/parts'].get.responses['200'].content['application/json'].examples[nama].value as any);
  const kasir = ex('kasir');
  const pemilik = ex('pemilik');
  const detail = muatSpec().paths['/api/work-orders/{number}'].get.responses['200'].content['application/json'].examples.dikerjakan.value as any;
  ditolak('kasir menerima costPrice', responsPalsu('GET', '/api/parts', 200, { ...kasir, data: [{ ...kasir.data[0], costPrice: 1 }] }, { peran: 'cashier' }));
  ditolak('mekanik menerima daftar bentuk pemilik', responsPalsu('GET', '/api/parts?lowStock=true', 200, pemilik, { peran: 'mechanic' }));
  ditolak('pemilik menerima daftar tanpa costPrice', responsPalsu('GET', '/api/parts', 200, kasir, { peran: 'owner' }));
  ditolak('daftar sparepart tanpa peran diketahui', responsPalsu('GET', '/api/parts', 200, pemilik));
  validasi(responsPalsu('GET', '/api/parts', 200, { data: [], meta: { page: 1, limit: 20, total: 0 } }, { peran: 'cashier' }));
  ditolak('costPrice di item SPK', responsPalsu('GET', '/api/work-orders/S-0012', 200, { data: { ...detail.data, items: detail.data.items.map((i: any) => ({ ...i, costPrice: 1 })) } }));
  ditolak('field asing di SpkDetail', responsPalsu('GET', '/api/work-orders/S-0012', 200, { data: { ...detail.data, bookingTokenHash: 'a' } }));
  ditolak('validation_failed tanpa fields', responsPalsu('POST', '/api/customers', 422, { error: { code: 'validation_failed', message: 'Data yang dikirim belum valid' } }));
  ditolak('409 dengan fields', responsPalsu('POST', '/api/customers', 409, { error: { code: 'phone_taken', message: 'x', fields: { phone: 'required' } } }));
  ditolak('kode status tak tertulis', responsPalsu('GET', '/api/health', 404, { error: { code: 'not_found', message: 'x' } }));
  ditolak('rute tak ada di spec', responsPalsu('GET', '/api/orders', 200, { data: [] }));
  ditolak('204 berbadan', responsPalsu('POST', '/api/staff/logout', 204, { ok: true }));
  ditolak('429 tanpa Retry-After', responsPalsu('POST', '/api/staff/login', 429, { error: { code: 'too_many_requests', message: 'Terlalu sering, silakan tunggu sebentar lalu coba lagi' } }));
  ditolak('badan bukan JSON', { ...responsPalsu('GET', '/api/health', 200, undefined), header: new Headers({ 'content-type': 'text/html' }), teks: '<html>' });
  ok('validator respons menolak 14 pelanggaran (costPrice per peran, field asing, fields galat, status, rute, header, media type)');
}

// Header hak cipta dua baris dan akhir baris LF di semua berkas milik
// Bagian 0 (spec, db, docker-compose.yml, tests/kontrak, tests/wa-palsu).
// Berkas yang tidak bisa memuat komentar (JSON, Markdown, .npmrc) hanya
// diperiksa LF-nya.
const HEADER = [
  'Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.',
  'Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.',
];
const PENANDA: Record<string, string> = { ts: '//', js: '//', mjs: '//', cjs: '//', yaml: '#', yml: '#', sql: '--', sh: '#', example: '#' };
const LEWATI = new Set(['node_modules', '.spec-bundel', '.git']);

function semuaBerkas(dir: string): string[] {
  return readdirSync(dir).flatMap((nama) => {
    if (LEWATI.has(nama)) {
      return [];
    }
    const path = join(dir, nama);
    return statSync(path).isDirectory() ? semuaBerkas(path) : [path];
  });
}

function cekHeaderDanLf(): void {
  const berkas = [
    ...['spec', 'db', 'tests/kontrak', 'tests/wa-palsu'].flatMap((d) => semuaBerkas(join(AKAR, d))),
    join(AKAR, 'docker-compose.yml'),
  ].filter((p) => !/\.env$/.test(p));
  const masalah: string[] = [];
  let berheader = 0;
  for (const path of berkas) {
    const isi = readFileSync(path, 'utf8');
    const nama = relative(AKAR, path).replaceAll('\\', '/');
    if (isi.includes('\r')) {
      masalah.push(`${nama}: memuat CR (harus LF)`);
    }
    const penanda = PENANDA[path.split('.').pop() ?? ''];
    if (penanda) {
      berheader += 1;
      const baris = isi.split('\n');
      if (baris[0] !== `${penanda} ${HEADER[0]}` || baris[1] !== `${penanda} ${HEADER[1]}`) {
        masalah.push(`${nama}: dua baris pertama bukan header hak cipta`);
      }
    }
  }
  if (masalah.length > 0) {
    throw new Error(`header hak cipta atau LF:\n  ${masalah.join('\n  ')}`);
  }
  ok(`${berheader} berkas kode berheader hak cipta dua baris; ${berkas.length} berkas memakai LF`);
}

async function utama(): Promise<void> {
  await cekDatabaseDanPengosongan();
  await cekWaPalsu();
  cekFixtur();
  await bundelSpec();
  ok(`spec dibundel; ${Object.keys(pesanBaku()).length} kode galat punya pesan baku`);
  cekFormatTerhadapSpec();
  cekValidatorRespons();
  cekHeaderDanLf();
}

utama()
  .then(async () => {
    await tutupDatabase();
    console.log('Harness siap.');
  })
  .catch(async (galat: unknown) => {
    await tutupDatabase().catch(() => undefined);
    console.error(`GAGAL ${(galat as Error).message}`);
    process.exitCode = 1;
  });
