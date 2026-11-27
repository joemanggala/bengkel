// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { expect } from 'vitest';
import { pesanStokKurang, type KekuranganStok } from './format';
import { ringkas, type Respons } from './klien';
import { pesanBaku } from './spec';

// Memeriksa satu galat: kode HTTP, `code`, pesan baku dari spec (bila kode itu
// punya), dan, bila diberikan, isi `fields` secara persis (nama field → kode
// aturan). Field yang tidak disebut harapan tidak boleh ikut muncul.
export function harapGalat(res: Respons, status: number, code: string, fields?: Record<string, string>): void {
  expect(res.status, ringkas(res)).toBe(status);
  expect(res.body?.error?.code, ringkas(res)).toBe(code);
  const baku = pesanBaku()[code];
  if (baku !== undefined) {
    expect(res.body.error.message, `pesan baku untuk ${code}`).toBe(baku);
  }
  if (fields) {
    expect(res.body.error.fields, ringkas(res)).toEqual(fields);
  }
}

export function harapStatus(res: Respons, status: number): void {
  expect(res.status, ringkas(res)).toBe(status);
}

// 409 insufficient_stock tidak punya pesan baku di x-pesan-baku, tetapi
// formatnya baku (bagian "Sparepart dan stok" di spec): pesannya dibandingkan
// huruf demi huruf dengan pesanStokKurang.
export function harapStokKurang(res: Respons, kurang: KekuranganStok): void {
  harapGalat(res, 409, 'insufficient_stock');
  expect(res.body.error.message, ringkas(res)).toBe(pesanStokKurang(kurang));
}
