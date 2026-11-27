// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Penyusun nilai dan pesan yang diharapkan, ditulis ulang dari spec/whatsapp.md
// (bagian 4 dan 5) dan spec/openapi.yaml (skema NomorHpMasukan, NomorHpSamaran,
// PlatMasukan, StatusBayar, RekapHarian, dan bagian "Sparepart dan stok") tanpa
// melihat kode backend mana pun. Tes membandingkan pesan yang tiba di WhatsApp
// palsu dan angka di respons dengan hasil fungsi di sini, huruf demi huruf.
// cek-harness membuktikan setiap fungsi sama dengan contoh di spec.

// --- Angka, uang, tanggal, waktu ---------------------------------------------

// Angka bulat dengan titik setiap tiga digit dari kanan.
export function angka(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// rupiah(x) di whatsapp.md: "Rp" + angka, tanpa spasi.
export function rupiah(n: number): string {
  return `Rp${angka(n)}`;
}

function duaDigit(n: number): string {
  return String(n).padStart(2, '0');
}

// tanggal(d): DATE "YYYY-MM-DD" (sudah WIB) → "DD-MM-YYYY".
export function tanggal(d: string): string {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!cocok) {
    throw new Error(`tanggal() butuh "YYYY-MM-DD", dapat "${d}"`);
  }
  return `${cocok[3]}-${cocok[2]}-${cocok[1]}`;
}

// Pecahan detik dari backend boleh berapa digit pun; yang lebih dari tiga
// digit dipotong (bukan dibulatkan) sebelum diurai.
function uraiWaktu(iso: string): number {
  const ms = Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'));
  if (!Number.isFinite(ms)) {
    throw new Error(`Waktu tidak bisa diurai: "${iso}"`);
  }
  return ms;
}

const TUJUH_JAM_MS = 7 * 60 * 60 * 1000;

// waktu(t): UTC + 7 jam, "DD-MM-YYYY HH:MM WIB", detik dan milidetik dibuang.
export function waktuWib(iso: string): string {
  const t = new Date(uraiWaktu(iso) + TUJUH_JAM_MS);
  return (
    `${duaDigit(t.getUTCDate())}-${duaDigit(t.getUTCMonth() + 1)}-${t.getUTCFullYear()} ` +
    `${duaDigit(t.getUTCHours())}:${duaDigit(t.getUTCMinutes())} WIB`
  );
}

// Tanggal WIB ("YYYY-MM-DD") dari sebuah waktu UTC, untuk filter `date` dan
// rekap harian.
export function tanggalWibDari(waktu: string | Date): string {
  const ms = typeof waktu === 'string' ? uraiWaktu(waktu) : waktu.getTime();
  return new Date(ms + TUJUH_JAM_MS).toISOString().slice(0, 10);
}

// Rentang UTC satu tanggal WIB (RekapHarian): [tanggal − 1 hari 17:00:00.000,
// tanggal 17:00:00.000).
export function rentangUtcTanggalWib(tgl: string): { mulai: Date; akhir: Date } {
  const akhir = new Date(`${tgl}T17:00:00.000Z`);
  if (!Number.isFinite(akhir.getTime())) {
    throw new Error(`Tanggal tidak sah: "${tgl}"`);
  }
  return { mulai: new Date(akhir.getTime() - 24 * 60 * 60 * 1000), akhir };
}

// Geser tanggal "YYYY-MM-DD" sebanyak `hari` (kalender, tanpa zona waktu).
export function geserTanggal(tgl: string, hari: number): string {
  const t = new Date(`${tgl}T00:00:00.000Z`);
  t.setUTCDate(t.getUTCDate() + hari);
  return t.toISOString().slice(0, 10);
}

// --- Nomor --------------------------------------------------------------------

// "S-" / "B-" + angka, diisi nol di depan sampai minimal 4 digit.
export function nomorSpk(n: number): string {
  return `S-${String(n).padStart(4, '0')}`;
}

export function nomorBooking(n: number): string {
  return `B-${String(n).padStart(4, '0')}`;
}

// --- Nomor HP dan plat (skema NomorHpMasukan, NomorHpSamaran, PlatMasukan) ----

export type KodeTolak = 'required' | 'invalid_type' | 'invalid_format' | 'too_short' | 'too_long';
export type Hasil<T> = { nilai: T; galat?: undefined } | { nilai?: undefined; galat: KodeTolak };

// "Dipangkas" di spec: hanya spasi, tab, CR, dan LF di awal dan akhir (NBSP
// dan spasi lebar penuh tidak dibuang).
export function pangkas(teks: string): string {
  return teks.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
}

// NomorHpMasukan, diperiksa berurutan: tipe → kosong → pola → panjang.
export function normalisasiHp(masukan: unknown): Hasil<string> {
  if (typeof masukan !== 'string') {
    return { galat: 'invalid_type' };
  }
  const bersih = pangkas(masukan).replace(/[ -]/g, '');
  if (bersih === '') {
    return { galat: 'required' };
  }
  const cocok = /^(\+62|62|0)(8[0-9]*)$/.exec(bersih);
  if (!cocok) {
    return { galat: 'invalid_format' };
  }
  const seragam = `62${cocok[2]}`;
  if (seragam.length < 10) {
    return { galat: 'too_short' };
  }
  if (seragam.length > 15) {
    return { galat: 'too_long' };
  }
  return { nilai: seragam };
}

// Bentuk seragam 628…; melempar bila masukan tidak sah (untuk menyusun data uji).
export function hpSeragam(masukan: string): string {
  const hasil = normalisasiHp(masukan);
  if (hasil.galat) {
    throw new Error(`Nomor HP "${masukan}" tidak sah menurut spec (${hasil.galat})`);
  }
  return hasil.nilai;
}

// NomorHpSamaran: 4 digit pertama, tepat empat "*", 4 digit terakhir.
export function samarkanHp(seragam: string): string {
  return `${seragam.slice(0, 4)}****${seragam.slice(-4)}`;
}

export interface Plat {
  kunci: string;
  tampilan: string;
}

// PlatMasukan, diperiksa berurutan: tipe → kosong → karakter/huruf depan →
// panjang. Tampilan diturunkan dari kunci.
export function normalisasiPlat(masukan: unknown): Hasil<Plat> {
  if (typeof masukan !== 'string') {
    return { galat: 'invalid_type' };
  }
  const kunci = pangkas(masukan)
    .replace(/[ .-]/g, '')
    .replace(/[a-z]/g, (h) => h.toUpperCase());
  if (kunci === '') {
    return { galat: 'required' };
  }
  if (!/^[A-Z][A-Z0-9]*$/.test(kunci)) {
    return { galat: 'invalid_format' };
  }
  if (kunci.length < 2) {
    return { galat: 'too_short' };
  }
  if (kunci.length > 12) {
    return { galat: 'too_long' };
  }
  const pola = /^([A-Z]+)([0-9]+)([A-Z]*)$/.exec(kunci);
  const tampilan = pola ? [pola[1], pola[2], pola[3]].filter((k) => k !== '').join(' ') : kunci;
  return { nilai: { kunci, tampilan } };
}

// Kunci dan tampilan plat; melempar bila masukan tidak sah.
export function plat(masukan: string): Plat {
  const hasil = normalisasiPlat(masukan);
  if (hasil.galat) {
    throw new Error(`Plat "${masukan}" tidak sah menurut spec (${hasil.galat})`);
  }
  return hasil.nilai;
}

// --- Uang SPK (bagian "SPK, uang, dan pembayaran" dan StatusBayar) -----------

export function hitungTotal(items: Array<{ type: 'SERVICE' | 'PART'; subtotal: number }>): {
  serviceSubtotal: number;
  partSubtotal: number;
  total: number;
} {
  const jumlah = (jenis: 'SERVICE' | 'PART') => items.filter((i) => i.type === jenis).reduce((j, i) => j + i.subtotal, 0);
  const serviceSubtotal = jumlah('SERVICE');
  const partSubtotal = jumlah('PART');
  return { serviceSubtotal, partSubtotal, total: serviceSubtotal + partSubtotal };
}

// paid bila paidAmount = total (termasuk total 0), selain itu partial bila
// paidAmount > 0, selain itu unpaid.
export function statusBayar(total: number, paidAmount: number): 'unpaid' | 'partial' | 'paid' {
  if (paidAmount === total) {
    return 'paid';
  }
  return paidAmount > 0 ? 'partial' : 'unpaid';
}

// x-label StatusSpk (ditulis ulang di sini; cek-harness membandingkannya
// dengan spec).
export const LABEL_STATUS_SPK: Record<string, string> = {
  QUEUED: 'Antre',
  IN_PROGRESS: 'Dikerjakan',
  WAITING_PARTS: 'Menunggu part',
  DONE: 'Selesai',
  PICKED_UP: 'Diambil',
  CANCELLED: 'Dibatalkan',
};

// --- Pesan 409 insufficient_stock -------------------------------------------

export interface KekuranganStok {
  name: string;
  unit: string;
  butuh: number;
  tersedia: number;
}

// Angka polos tanpa pemisah ribuan.
export function pesanStokKurang(k: KekuranganStok): string {
  return `Stok sparepart tidak cukup: ${k.name} (butuh ${k.butuh} ${k.unit}, tersedia ${k.tersedia} ${k.unit})`;
}

// --- Pesan WhatsApp (whatsapp.md bagian 5) ----------------------------------

export interface OutletPesan {
  name: string;
  address: string;
  openingHours: string;
  receiptFooter: string;
}

// Profil outlet sesudah migration (dan sesudah harness mengosongkan database).
export const OUTLET_AWAL = {
  name: 'Nama Bengkel',
  tagline: '',
  address: '',
  phone: null,
  openingHours: '',
  mapsUrl: '',
  receiptFooter: '',
} as const;

function kosong(nilai: string | null | undefined): boolean {
  return nilai === null || nilai === undefined || nilai === '';
}

// Baris opsional: hilang (null) bila nilainya kosong.
function opsional(nilai: string | null | undefined, susun: (v: string) => string): string | null {
  return kosong(nilai) ? null : susun(nilai as string);
}

// Pesan = blok yang dipisah satu baris kosong; baris null dibuang, blok yang
// semua barisnya hilang ikut dibuang. Tanpa LF di akhir pesan.
function susunPesan(blok: Array<Array<string | null>>): string {
  return blok
    .map((b) => b.filter((baris): baris is string => baris !== null))
    .filter((b) => b.length > 0)
    .map((b) => b.join('\n'))
    .join('\n\n');
}

// {tautanLacak}: garis miring akhir PUBLIC_WEB_URL dibuang.
export function tautanLacak(publicWebUrl: string, trackingToken: string): string {
  return `${publicWebUrl.replace(/\/+$/, '')}/servis/${trackingToken}`;
}

export interface KendaraanPesan {
  plate: string;
  brand: string;
  model: string;
}

// {kendaraan}: "{plate} ({brand} {model})", atau "{plate} ({brand})" bila
// model kosong.
export function teksKendaraan(k: KendaraanPesan): string {
  return k.model === '' ? `${k.plate} (${k.brand})` : `${k.plate} (${k.brand} ${k.model})`;
}

// {salam}: "Halo {customer.name}".
export function salam(nama: string): string {
  return `Halo ${nama}`;
}

export interface BookingPesan {
  number: string;
  plate: string;
  visitDate: string;
  // Salinan nama jasa saat booking dibuat (Booking.service?.name atau
  // BookingPublik.serviceName), null bila tanpa jasa.
  serviceName: string | null;
}

// 5.1 booking_confirmed. Tidak memuat nama pemesan.
export function pesanBookingDikonfirmasi(outlet: Pick<OutletPesan, 'name' | 'address' | 'openingHours'>, b: BookingPesan): string {
  return susunPesan([
    [outlet.name, `Booking ${b.number}`],
    [`Halo, booking servis kamu untuk ${b.plate} pada ${tanggal(b.visitDate)} sudah dikonfirmasi.`],
    [opsional(b.serviceName, (v) => `Jasa: ${v}`)],
    [opsional(outlet.address, (v) => `Alamat: ${v}`), opsional(outlet.openingHours, (v) => `Jam buka: ${v}`)],
  ]);
}

// 5.2 booking_rejected.
export function pesanBookingDitolak(
  outlet: Pick<OutletPesan, 'name'>,
  b: Omit<BookingPesan, 'serviceName'> & { rejectReason: string },
  publicWebUrl: string,
): string {
  return susunPesan([
    [outlet.name, `Booking ${b.number}`],
    [`Halo, mohon maaf, booking servis kamu untuk ${b.plate} pada ${tanggal(b.visitDate)} belum bisa kami terima.`],
    [`Alasan: ${b.rejectReason}`],
    [`Silakan booking ulang di ${publicWebUrl.replace(/\/+$/, '')}/booking`],
  ]);
}

export interface SpkPesan {
  number: string;
  customer: { name: string };
  vehicle: KendaraanPesan;
  estimatedDoneAt: string | null;
  createdAt: string;
  status: string;
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  serviceSubtotal: number;
  partSubtotal: number;
  total: number;
  paidAmount: number;
}

// 5.3 work_order_created.
export function pesanSpkDibuat(
  outlet: Pick<OutletPesan, 'name'>,
  spk: Pick<SpkPesan, 'number' | 'customer' | 'vehicle' | 'estimatedDoneAt'>,
  tautan: string,
): string {
  return susunPesan([
    [outlet.name, `SPK ${spk.number}`],
    [`${salam(spk.customer.name)}, kendaraan kamu sudah kami terima untuk diservis.`],
    [`Kendaraan: ${teksKendaraan(spk.vehicle)}`, opsional(spk.estimatedDoneAt, (v) => `Estimasi selesai: ${waktuWib(v)}`)],
    ['Pantau status servis dan nota di:', tautan],
  ]);
}

// 5.4 work_order_done.
export function pesanSiapDiambil(
  outlet: Pick<OutletPesan, 'name' | 'openingHours'>,
  spk: Pick<SpkPesan, 'number' | 'customer' | 'total' | 'paidAmount'> & { vehicle: { plate: string } },
  tautan: string,
): string {
  return susunPesan([
    [outlet.name, `SPK ${spk.number}`],
    [`${salam(spk.customer.name)}, servis ${spk.vehicle.plate} sudah selesai dan kendaraan siap diambil.`],
    [`Total: ${rupiah(spk.total)}`, `Dibayar: ${rupiah(spk.paidAmount)}`, `Sisa: ${rupiah(spk.total - spk.paidAmount)}`],
    ['Rincian dan nota:', tautan],
    [opsional(outlet.openingHours, (v) => `Jam buka: ${v}`)],
  ]);
}

// 5.5 receipt. Harga beli tidak pernah ada di nota.
export function pesanNota(
  outlet: Pick<OutletPesan, 'name' | 'receiptFooter'>,
  spk: Omit<SpkPesan, 'estimatedDoneAt'>,
  tautan: string,
): string {
  const label = LABEL_STATUS_SPK[spk.status];
  if (label === undefined) {
    throw new Error(`Status SPK tidak dikenal: ${spk.status}`);
  }
  const item =
    spk.items.length === 0
      ? ['Belum ada item.']
      : spk.items.map((i) => `- ${i.name}: ${i.quantity} x ${rupiah(i.price)} = ${rupiah(i.subtotal)}`);
  return susunPesan([
    [outlet.name, `Nota SPK ${spk.number}`],
    [`${salam(spk.customer.name)}, terima kasih sudah servis di ${outlet.name}.`],
    [`Kendaraan: ${teksKendaraan(spk.vehicle)}`, `Waktu: ${waktuWib(spk.createdAt)}`, `Status: ${label}`],
    item,
    [
      `Jasa: ${rupiah(spk.serviceSubtotal)}`,
      `Sparepart: ${rupiah(spk.partSubtotal)}`,
      `Total: ${rupiah(spk.total)}`,
      `Dibayar: ${rupiah(spk.paidAmount)}`,
      `Sisa: ${rupiah(spk.total - spk.paidAmount)}`,
    ],
    ['Nota online:', tautan],
    [opsional(outlet.receiptFooter, (v) => v)],
  ]);
}
