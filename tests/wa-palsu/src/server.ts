// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { halamanDaftar } from './halaman';
import { JEDA_MAKS_MS, Keadaan, MODE_GANGGUAN, type CatatanPermintaan, type ModeGangguan } from './keadaan';

// Tiruan API kirim Fonnte (POST /send) seperti tertulis di spec/whatsapp.md.
// Yang ditiru hanya bagian yang dipakai backend, dan sengaja lebih ketat dari
// Fonnte (tepat dua field) supaya ketiga backend mengirim permintaan yang sama.

export const JALUR_KIRIM = '/send';
export const TOKEN_BAWAAN = 'token-wa-uji-bengkel-bukan-kunci-asli';
const BATAS_BADAN = 1024 * 1024;
const POLA_TARGET = /^628[0-9]{7,12}$/;

function balasJson(res: ServerResponse, kode: number, isi: unknown): void {
  const teks = JSON.stringify(isi);
  res.writeHead(kode, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(teks) });
  res.end(teks);
}

function balasTeks(res: ServerResponse, kode: number, jenis: string, teks: string): void {
  res.writeHead(kode, { 'Content-Type': jenis, 'Content-Length': Buffer.byteLength(teks), 'Cache-Control': 'no-store' });
  res.end(teks);
}

async function bacaMentah(req: IncomingMessage, batas: number): Promise<Buffer | undefined> {
  const potongan: Buffer[] = [];
  let ukuran = 0;
  for await (const bagian of req) {
    ukuran += (bagian as Buffer).length;
    if (ukuran > batas) {
      return undefined;
    }
    potongan.push(bagian as Buffer);
  }
  return Buffer.concat(potongan);
}

async function bacaJson(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const mentah = await bacaMentah(req, 64 * 1024);
  if (!mentah) {
    return undefined;
  }
  const teks = mentah.toString('utf8');
  if (teks.trim() === '') {
    return {};
  }
  try {
    const isi: unknown = JSON.parse(teks);
    return typeof isi === 'object' && isi !== null && !Array.isArray(isi) ? (isi as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function teksHeader(req: IncomingMessage, nama: string): string | null {
  const nilai = req.headers[nama];
  return (Array.isArray(nilai) ? nilai[0] : nilai) ?? null;
}

interface FieldMultipart {
  teks: Record<string, string[]>;
  berkas: string[];
}

// Pengurai multipart bawaan Node (Request.formData dari undici), supaya
// WhatsApp palsu tidak butuh dependensi produksi.
async function uraiMultipart(contentType: string, badan: Buffer): Promise<FieldMultipart | undefined> {
  try {
    const form = await new Request('http://wa-palsu/send', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: new Uint8Array(badan),
    }).formData();
    const hasil: FieldMultipart = { teks: {}, berkas: [] };
    for (const [nama, nilai] of form.entries()) {
      if (typeof nilai === 'string') {
        (hasil.teks[nama] ??= []).push(nilai);
      } else {
        hasil.berkas.push(nama);
      }
    }
    return hasil;
  } catch {
    return undefined;
  }
}

interface Konteks {
  keadaan: Keadaan;
  token: string;
}

// Balasan meniru contoh di dokumentasi Fonnte: kegagalan selalu HTTP 200
// dengan status false. Contoh "token invalid" di sana memakai "Status"
// berhuruf besar, jadi ditiru apa adanya.
function balasGagal(res: ServerResponse, requestid: number, reason: string, statusBesar = false): void {
  balasJson(res, 200, statusBesar ? { Status: false, reason, requestid } : { reason, status: false, requestid });
}

async function tanganiKirim({ keadaan, token }: Konteks, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestid = keadaan.ambilNomorPermintaan();
  const contentType = teksHeader(req, 'content-type');
  const catatan: CatatanPermintaan = {
    nomor: requestid,
    waktu: new Date().toISOString(),
    metode: req.method ?? '',
    path: JALUR_KIRIM,
    tokenSah: teksHeader(req, 'authorization') === token,
    contentType,
    field: null,
    fieldBerkas: [],
    hasil: 'diproses',
    alasan: null,
    statusHttp: null,
  };
  // Dicatat sejak tiba lalu diperbarui di tempat, supaya permintaan yang
  // sedang ditahan jeda sudah terlihat di /__kendali/permintaan.
  keadaan.catat(catatan);
  // Koneksi yang ditutup pengirim sebelum balasan selesai (batas waktu
  // backend habis selama jeda) ditandai, supaya pesannya tidak disimpan.
  let ditinggal = false;
  res.on('close', () => {
    if (!res.writableFinished) {
      ditinggal = true;
    }
  });
  const tolak = (alasan: string, reason: string, statusBesar = false) => {
    catatan.hasil = 'ditolak';
    catatan.alasan = alasan;
    catatan.statusHttp = 200;
    balasGagal(res, requestid, reason, statusBesar);
  };

  const badan = await bacaMentah(req, BATAS_BADAN);
  if (!badan) {
    catatan.hasil = 'ditolak';
    catatan.alasan = 'badan lebih dari 1 MiB';
    catatan.statusHttp = 413;
    balasJson(res, 413, { reason: 'payload too large', status: false, requestid });
    return;
  }
  if (!catatan.tokenSah) {
    tolak('header Authorization tidak sama dengan WA_TOKEN (tanpa awalan Bearer)', 'token invalid', true);
    return;
  }
  if (!contentType || !/^multipart\/form-data\s*;/i.test(contentType)) {
    tolak(`Content-Type harus multipart/form-data, bukan ${contentType ?? '(kosong)'}`, 'input invalid');
    return;
  }
  const field = await uraiMultipart(contentType, badan);
  if (!field) {
    tolak('badan multipart tidak bisa diurai', 'input invalid');
    return;
  }
  catatan.field = field.teks;
  catatan.fieldBerkas = field.berkas;
  const nama = Object.keys(field.teks).sort();
  if (field.berkas.length > 0 || nama.join(',') !== 'message,target') {
    tolak(`field wajib tepat "target" dan "message"; diterima: ${[...nama, ...field.berkas].join(', ') || '(tidak ada)'}`, 'input invalid');
    return;
  }
  const target = field.teks.target ?? [];
  const pesan = field.teks.message ?? [];
  if (target.length !== 1 || pesan.length !== 1) {
    tolak('"target" dan "message" masing-masing wajib dikirim tepat sekali', 'input invalid');
    return;
  }
  if (!POLA_TARGET.test(target[0] ?? '')) {
    tolak(`target harus satu nomor 628… (10-15 digit), bukan "${target[0]}"`, 'target invalid');
    return;
  }
  if ((pesan[0] ?? '').trim() === '') {
    tolak('message kosong', 'input invalid');
    return;
  }

  const jeda = keadaan.jedaUntuk(target[0] ?? '');
  if (jeda > 0) {
    await new Promise((selesai) => setTimeout(selesai, jeda));
  }
  if (ditinggal) {
    catatan.hasil = 'ditinggal';
    catatan.alasan = `pengirim menutup koneksi sebelum jeda ${jeda} ms habis (batas waktu backend?)`;
    return;
  }

  const gangguan = keadaan.gangguanUntuk(target[0] ?? '');
  if (gangguan) {
    catatan.hasil = 'gangguan';
    catatan.alasan = `gangguan ${gangguan}`;
    if (gangguan === 'putus') {
      res.socket?.destroy();
      return;
    }
    catatan.statusHttp = gangguan === 'http-500' ? 500 : 200;
    if (gangguan === 'http-500') {
      balasTeks(res, 500, 'text/html; charset=utf-8', '<html><body><h1>500 Internal Server Error</h1></body></html>');
    } else if (gangguan === 'alasan-panjang') {
      balasGagal(res, requestid, `gagal kirim: ${'é'.repeat(600)}`);
    } else if (gangguan === 'gema-token') {
      balasGagal(res, requestid, `token tidak dikenali: ${teksHeader(req, 'authorization') ?? ''}`);
    } else if (gangguan === 'status-besar') {
      balasGagal(res, requestid, 'device disconnected', true);
    } else {
      balasGagal(res, requestid, 'device disconnected');
    }
    return;
  }

  const disimpan = keadaan.simpan(target[0] ?? '', pesan[0] ?? '');
  catatan.hasil = 'terkirim';
  catatan.statusHttp = 200;
  balasJson(res, 200, {
    detail: 'success! message in queue',
    id: [String(disimpan.nomor)],
    process: 'pending',
    requestid,
    status: true,
    target: [disimpan.target],
  });
}

async function aturGangguan(keadaan: Keadaan, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const isi = await bacaJson(req);
  if (!isi || typeof isi.gagal !== 'boolean') {
    balasJson(res, 400, { error: `badan wajib {"gagal": true|false, "nomor"?: "628…", "mode"?: ${MODE_GANGGUAN.map((m) => `"${m}"`).join('|')}}` });
    return;
  }
  if (isi.nomor !== undefined && (typeof isi.nomor !== 'string' || !POLA_TARGET.test(isi.nomor))) {
    balasJson(res, 400, { error: 'nomor harus satu nomor 628…' });
    return;
  }
  if (isi.mode !== undefined && !MODE_GANGGUAN.includes(isi.mode as ModeGangguan)) {
    balasJson(res, 400, { error: `mode harus salah satu dari ${MODE_GANGGUAN.join(', ')}` });
    return;
  }
  const mode = (isi.mode as ModeGangguan | undefined) ?? 'status-false';
  const nomor = isi.nomor as string | undefined;
  if (isi.gagal) {
    if (nomor) {
      keadaan.gangguanNomor.set(nomor, mode);
    } else {
      keadaan.gangguanSemua = mode;
    }
  } else if (nomor) {
    keadaan.gangguanNomor.delete(nomor);
  } else {
    keadaan.gangguanSemua = null;
    keadaan.gangguanNomor.clear();
  }
  balasJson(res, 200, { ok: true, gangguan: keadaan.ringkasGangguan() });
}

async function aturJeda(keadaan: Keadaan, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const isi = await bacaJson(req);
  const ms = isi?.ms;
  if (!isi || typeof ms !== 'number' || !Number.isInteger(ms) || ms < 0 || ms > JEDA_MAKS_MS) {
    balasJson(res, 400, { error: `badan wajib {"ms": 0..${JEDA_MAKS_MS}, "nomor"?: "628…"}` });
    return;
  }
  if (isi.nomor !== undefined && (typeof isi.nomor !== 'string' || !POLA_TARGET.test(isi.nomor))) {
    balasJson(res, 400, { error: 'nomor harus satu nomor 628…' });
    return;
  }
  if (typeof isi.nomor === 'string') {
    if (ms === 0) {
      keadaan.jedaNomor.delete(isi.nomor);
    } else {
      keadaan.jedaNomor.set(isi.nomor, ms);
    }
  } else {
    keadaan.jedaSemua = ms;
    if (ms === 0) {
      keadaan.jedaNomor.clear();
    }
  }
  balasJson(res, 200, { ok: true, jeda: { semua: keadaan.jedaSemua, nomor: Object.fromEntries(keadaan.jedaNomor) } });
}

async function tangani(ktx: Konteks, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://wa-palsu');
  const rute = `${req.method} ${url.pathname}`;
  switch (rute) {
    case `POST ${JALUR_KIRIM}`:
      await tanganiKirim(ktx, req, res);
      return;
    case 'GET /':
      balasTeks(res, 200, 'text/html; charset=utf-8', halamanDaftar(ktx.keadaan.pesan, url.searchParams.get('nomor') ?? undefined));
      return;
    case 'GET /__kendali/ping':
      balasJson(res, 200, {
        ok: true,
        layanan: 'wa-palsu',
        jalur: JALUR_KIRIM,
        // Sidik token, bukan tokennya: harness memastikan WhatsApp palsu yang
        // sudah menyala memakai WA_TOKEN yang sama dengan backend uji.
        sidikToken: createHash('sha256').update(ktx.token).digest('hex'),
      });
      return;
    case 'POST /__kendali/reset':
      req.resume();
      ktx.keadaan.reset();
      // Tombol "Kosongkan" di halaman mengirim form biasa; browser dibawa
      // kembali ke daftar pesan, sedangkan klien JSON menerima {"ok": true}.
      if ((req.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded')) {
        res.writeHead(303, { Location: '/' });
        res.end();
      } else {
        balasJson(res, 200, { ok: true });
      }
      return;
    case 'GET /__kendali/pesan':
      balasJson(res, 200, { data: ktx.keadaan.untuk(url.searchParams.get('to') ?? undefined) });
      return;
    case 'GET /__kendali/permintaan':
      balasJson(res, 200, { data: ktx.keadaan.permintaan });
      return;
    case 'POST /__kendali/gangguan':
      await aturGangguan(ktx.keadaan, req, res);
      return;
    case 'POST /__kendali/jeda':
      await aturJeda(ktx.keadaan, req, res);
      return;
    default:
      req.resume();
      balasJson(res, 404, { error: `rute ${rute} tidak ada di WhatsApp palsu` });
  }
}

export interface WaPalsuHidup {
  keadaan: Keadaan;
  alamat: string;
  port: number;
  tutup(): Promise<void>;
}

// Port 0 memilih port bebas (dipakai tes unit).
export async function nyalakanWaPalsu(opsi: { port: number; host?: string | undefined; token?: string | undefined }): Promise<WaPalsuHidup> {
  const keadaan = new Keadaan();
  const ktx: Konteks = { keadaan, token: opsi.token || TOKEN_BAWAAN };
  const server = createServer((req, res) => {
    tangani(ktx, req, res).catch((galat: unknown) => {
      if (!res.headersSent) {
        balasJson(res, 500, { error: (galat as Error).message });
      } else {
        res.destroy();
      }
    });
  });
  await new Promise<void>((selesai, gagal) => {
    server.once('error', gagal);
    server.listen(opsi.port, opsi.host, () => {
      server.off('error', gagal);
      selesai();
    });
  });
  const port = (server.address() as AddressInfo).port;
  return {
    keadaan,
    alamat: `http://localhost:${port}`,
    port,
    tutup: async () => {
      server.closeAllConnections();
      await new Promise<void>((selesai) => server.close(() => selesai()));
    },
  };
}
