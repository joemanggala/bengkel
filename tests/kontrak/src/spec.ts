// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

const SPEC_AKAR = fileURLToPath(new URL('../../../spec/openapi.yaml', import.meta.url));
const KONFIG_REDOCLY = fileURLToPath(new URL('../../../spec/redocly.yaml', import.meta.url));
export const BERKAS_BUNDEL = fileURLToPath(new URL('../.spec-bundel/openapi.json', import.meta.url));

type Objek = Record<string, any>;

// Spec dipecah ke banyak berkas YAML dengan $ref. Untuk validasi, semuanya
// digabung dan semua $ref diuraikan (dereference) sehingga setiap skema
// respons berdiri sendiri dan bisa langsung dikompilasi Ajv.
export async function bundelSpec(): Promise<void> {
  const { bundle, loadConfig } = await import('@redocly/openapi-core');
  const config = await loadConfig({ configPath: KONFIG_REDOCLY });
  const hasil = await bundle({ ref: SPEC_AKAR, config, dereference: true });
  const masalah = hasil.problems.filter((p) => p.severity === 'error');
  if (masalah.length > 0) {
    throw new Error(`Spec gagal dibundel: ${masalah.map((p) => p.message).join('; ')}`);
  }
  mkdirSync(dirname(BERKAS_BUNDEL), { recursive: true });
  writeFileSync(BERKAS_BUNDEL, JSON.stringify(hasil.bundle.parsed, null, 2));
}

let spec: Objek | undefined;

export function muatSpec(): Objek {
  if (!spec) {
    try {
      spec = JSON.parse(readFileSync(BERKAS_BUNDEL, 'utf8')) as Objek;
    } catch {
      throw new Error(`Spec belum dibundel di ${BERKAS_BUNDEL}; jalankan lewat "npm test" atau "npm run bundel-spec"`);
    }
  }
  return spec;
}

interface Rute {
  template: string;
  pola: RegExp;
  item: Objek;
}

let rute: Rute[] | undefined;

function daftarRute(): Rute[] {
  if (!rute) {
    rute = Object.entries(muatSpec().paths as Objek).map(([template, item]) => ({
      template,
      pola: new RegExp(`^${template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}$`),
      item: item as Objek,
    }));
    // Template dengan lebih sedikit parameter dicoba dulu, supaya segmen
    // tetap selalu menang atas segmen berparameter.
    rute.sort((a, b) => (a.template.match(/\{/g)?.length ?? 0) - (b.template.match(/\{/g)?.length ?? 0));
  }
  return rute;
}

export interface Operasi {
  template: string;
  op: Objek;
}

export function cariOperasi(metode: string, path: string): Operasi | undefined {
  const tanpaQuery = path.split('?')[0] ?? path;
  for (const r of daftarRute()) {
    const op = r.item[metode.toLowerCase()];
    if (op && r.pola.test(tanpaQuery)) {
      return { template: r.template, op };
    }
  }
  return undefined;
}

const addFormats = (addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ?? addFormatsModule;
// strict: false karena skema OpenAPI memuat kata kunci non-JSON-Schema
// seperti x-pesan-baku; yang divalidasi tetap struktur, tipe, dan format.
const ajv = new Ajv2020({ strict: false, allErrors: true });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const cacheValidator = new Map<string, ValidateFunction>();

export function validatorSkema(kunci: string, skema: Objek): ValidateFunction {
  let v = cacheValidator.get(kunci);
  if (!v) {
    v = ajv.compile(skema);
    cacheValidator.set(kunci, v);
  }
  return v;
}

export function uraiGalatAjv(v: ValidateFunction): string {
  return (v.errors ?? [])
    .slice(0, 8)
    .map((e) => `${e.instancePath || '(akar)'} ${e.message ?? ''}${e.params ? ` ${JSON.stringify(e.params)}` : ''}`)
    .join('\n  ');
}

export function pesanBaku(): Record<string, string> {
  return (muatSpec().components?.schemas?.KodeGalat?.['x-pesan-baku'] ?? {}) as Record<string, string>;
}

// Skema bernama di components.schemas bundel (sudah tanpa $ref), mis.
// "SparepartStaf". Dipakai validator respons untuk aturan per peran dan oleh
// cek-harness untuk membaca contoh dan tabel aturan langsung dari spec.
export function skemaKomponen(nama: string): Objek {
  const skema = muatSpec().components?.schemas?.[nama] as Objek | undefined;
  if (!skema) {
    throw new Error(`Skema ${nama} tidak ada di components.schemas spec`);
  }
  return skema;
}

// Label Indonesia (`x-label`) sebuah enum, mis. labelSpec('StatusSpk').DONE = "Selesai".
export function labelSpec(nama: string): Record<string, string> {
  return (skemaKomponen(nama)['x-label'] ?? {}) as Record<string, string>;
}
