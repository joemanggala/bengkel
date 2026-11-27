// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { expect } from 'vitest';

// Tiap bahasa menulis pecahan detik berbeda ("…05Z", "…05.123Z",
// "…05.123456789Z"), dan nilai yang baru dibuat di memori bisa lebih presisi
// daripada DATETIME(3) yang dibaca ulang dari database. Karena itu field
// waktu (nama berakhiran "At") dianggap sama bila selisihnya ≤ 2 ms.
const TOLERANSI_MS = 2;

function samakan(aktual: unknown, harapan: unknown): unknown {
  if (Array.isArray(aktual) && Array.isArray(harapan)) {
    return aktual.map((nilai, i) => samakan(nilai, harapan[i]));
  }
  if (aktual && harapan && typeof aktual === 'object' && typeof harapan === 'object') {
    const hasil: Record<string, unknown> = {};
    for (const [kunci, nilai] of Object.entries(aktual as Record<string, unknown>)) {
      const lawan = (harapan as Record<string, unknown>)[kunci];
      if (kunci.endsWith('At') && typeof nilai === 'string' && typeof lawan === 'string') {
        const selisih = Math.abs(Date.parse(nilai) - Date.parse(lawan));
        hasil[kunci] = Number.isFinite(selisih) && selisih <= TOLERANSI_MS ? lawan : nilai;
      } else {
        hasil[kunci] = samakan(nilai, lawan);
      }
    }
    return hasil;
  }
  return aktual;
}

export function harapSetara(aktual: unknown, harapan: unknown, pesan?: string): void {
  expect(samakan(aktual, harapan), pesan).toEqual(harapan);
}
