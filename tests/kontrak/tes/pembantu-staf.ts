// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Pembantu khusus tes area staf, outlet, dan jasa (staf-auth, kelola-staf,
// outlet, publik-jasa, jasa, sandi-lintas-backend). Fungsi persiapan di sini
// melempar bila backend membalas di luar harapan, sama seperti src/data.ts.

import fixtur from '../fixtur/bcrypt.json';
import { emailUnik, SANDI_UJI } from '../src/data';
import { bacaSatu, sisipkanStaf, type PeranStaf } from '../src/db';
import { api, type Respons } from '../src/klien';

// Hash bcrypt cost 12 dengan salah satu dari tiga awalan yang wajib diterima.
export const POLA_BCRYPT_12 = /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/;

// Kunci objek Staf di respons, untuk membuktikan tidak ada field lain
// (mis. passwordHash) walau validator sudah menolaknya.
export const KUNCI_STAF = ['createdAt', 'email', 'isActive', 'name', 'role', 'staffId'];

// Kunci objek Jasa di respons staf.
export const KUNCI_JASA = ['createdAt', 'description', 'durationMinutes', 'isActive', 'isPublic', 'name', 'price', 'serviceId', 'sortOrder', 'updatedAt'];

export function masuk(json: unknown): Promise<Respons> {
  return api.post('/api/staff/login', { json });
}

export function masukDengan(email: string, password: string = SANDI_UJI): Promise<Respons> {
  return masuk({ email, password });
}

// Staf disisipkan langsung ke database dengan hash fixtur (sandi SANDI_UJI).
// Membalas staffId dan email-nya.
export async function stafLangsung(
  name: string,
  opsi: { role?: PeranStaf; aktif?: boolean; email?: string; hash?: string } = {},
): Promise<{ staffId: string; email: string }> {
  const email = opsi.email ?? emailUnik(opsi.role ?? 'kasir');
  const staffId = await sisipkanStaf({
    name,
    email,
    role: opsi.role ?? 'cashier',
    passwordHash: opsi.hash ?? fixtur.hash.node,
    aktif: opsi.aktif,
  });
  return { staffId, email };
}

export async function hashSandi(staffId: string): Promise<string> {
  const baris = await bacaSatu<{ password_hash: string }>('SELECT password_hash FROM staff WHERE staff_id = ?', [staffId]);
  if (!baris) {
    throw new Error(`Staf ${staffId} tidak ada di database`);
  }
  return baris.password_hash;
}

// Peran dan status aktif langsung dari database.
export async function stafDb(staffId: string): Promise<{ role: string; aktif: boolean; name: string; email: string }> {
  const baris = await bacaSatu<{ role: string; is_active: number; name: string; email: string }>(
    'SELECT role, is_active, name, email FROM staff WHERE staff_id = ?',
    [staffId],
  );
  if (!baris) {
    throw new Error(`Staf ${staffId} tidak ada di database`);
  }
  return { role: baris.role, aktif: Boolean(baris.is_active), name: baris.name, email: baris.email };
}

// JSON dengan objek bersarang `tingkat` lapis, untuk aturan "bersarang lebih
// dari 64 tingkat → 400". Dipakai 65 lapis objek, yang lebih dari 64 apa pun
// cara menghitungnya (dengan atau tanpa nilai daun).
export function jsonBersarang(tingkat: number): string {
  return `${'{"a":'.repeat(tingkat)}1${'}'.repeat(tingkat)}`;
}

// Hanya baris daftar yang ID-nya termasuk `id`, dengan urutan dari backend.
export function saring<T extends Record<string, unknown>>(daftar: T[], kunci: keyof T, id: string[]): T[] {
  return daftar.filter((baris) => id.includes(baris[kunci] as string));
}
