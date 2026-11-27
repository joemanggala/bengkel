// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { bookingStaf, buatJasa, buatJasaNonPublik, isianBooking, siapkanBengkel, wajib, type Bengkel } from '../src/data';
import { barisBooking, idBooking, jumlahBaris, nilaiPenghitung } from '../src/db';
import { geserTanggal } from '../src/format';
import { harapGalat, harapStatus } from '../src/galat';
import { api } from '../src/klien';
import { kirimBooking, tanggalWibAman } from './pembantu-booking';

// Validasi isian form booking publik (skema BuatBookingRequest dan bagian
// "Teks" deskripsi API). Setiap 422 dibuktikan tidak menyimpan booking dan
// tidak memakai nomor booking.

let b: Bengkel;
let jasaNonaktif: any;
let jasaNonPublikNonaktif: any;

beforeAll(async () => {
  b = await siapkanBengkel();
  jasaNonaktif = await buatJasa(b.pemilik.token, { isActive: false });
  jasaNonPublikNonaktif = await buatJasaNonPublik(b.pemilik.token, { isActive: false });
});

async function harapTolak(ubah: Record<string, unknown>, fields: Record<string, string>, hapus: string[] = []): Promise<void> {
  const isian = await isianBooking(ubah);
  for (const k of hapus) {
    delete isian[k];
  }
  const n = await nilaiPenghitung('booking_number');
  const jumlah = await jumlahBaris('bookings');

  harapGalat(await kirimBooking(isian), 422, 'validation_failed', fields);

  expect(await nilaiPenghitung('booking_number')).toBe(n);
  expect(await jumlahBaris('bookings')).toBe(jumlah);
}

// Membalas BookingPublik dan Booking (staf) dari booking yang diterima.
async function harapTerima(ubah: Record<string, unknown>): Promise<{ publik: any; staf: any }> {
  const res = await kirimBooking(await isianBooking(ubah));
  harapStatus(res, 201);
  const publik = res.body.data.booking;
  return { publik, staf: await bookingStaf(b.kasir.token, await idBooking(publik.number)) };
}

const KONTROL_DILARANG: Array<[string, string]> = [
  ['U+0000', '\u0000'],
  ['U+0007', '\u0007'],
  ['U+001F', '\u001f'],
  ['U+007F', '\u007f'],
  ['U+0080', '\u0080'],
  ['U+0085', '\u0085'],
  ['U+009F', '\u009f'],
  ['U+2028', ' '],
  ['U+2029', ' '],
  ['U+202A', '‪'],
  ['U+202E', '‮'],
  ['U+2066', '⁦'],
  ['U+2069', '⁩'],
];
const TAB_BARIS: Array<[string, string]> = [
  ['tab', '\t'],
  ['LF', '\n'],
  ['CR', '\r'],
];

describe('badan kosong dan banyak galat sekaligus', () => {
  it('{} → semua field wajib required; vehicleModel dan serviceId opsional tidak dilaporkan', async () => {
    const n = await nilaiPenghitung('booking_number');

    harapGalat(await kirimBooking({}), 422, 'validation_failed', {
      customerName: 'required',
      phone: 'required',
      vehicleType: 'required',
      plate: 'required',
      vehicleBrand: 'required',
      visitDate: 'required',
      complaint: 'required',
    });
    expect(await nilaiPenghitung('booking_number')).toBe(n);
  });

  it('semua field yang gagal dilaporkan sekaligus, termasuk rujukan serviceId', async () => {
    await harapTolak(
      {
        customerName: 'A',
        phone: '08123456',
        vehicleType: 'TRUCK',
        plate: '1234 AB',
        vehicleBrand: '  ',
        vehicleModel: null,
        serviceId: randomUUID(),
        visitDate: await tanggalWibAman(-1),
        complaint: '',
      },
      {
        customerName: 'too_short',
        phone: 'too_short',
        vehicleType: 'invalid_format',
        plate: 'invalid_format',
        vehicleBrand: 'required',
        vehicleModel: 'invalid_type',
        serviceId: 'unknown_reference',
        visitDate: 'out_of_range',
        complaint: 'required',
      },
    );
  });

  it('contoh galat di spec: nomor terlalu pendek, plat salah, tanggal di luar rentang', async () => {
    await harapTolak(
      { phone: '08123456', plate: 'B/1234', visitDate: await tanggalWibAman(31) },
      { phone: 'too_short', plate: 'invalid_format', visitDate: 'out_of_range' },
    );
  });
});

describe('field wajib yang tidak dikirim → required', () => {
  it.each(['customerName', 'phone', 'vehicleType', 'plate', 'vehicleBrand', 'visitDate', 'complaint'])('%s', async (field) => {
    await harapTolak({}, { [field]: 'required' }, [field]);
  });
});

describe('customerName', () => {
  it.each<[string, unknown, string]>([
    ['null', null, 'required'],
    ['kosong', '', 'required'],
    ['hanya spasi, tab, CR, LF', ' \t\r\n ', 'required'],
    ['angka', 123, 'invalid_type'],
    ['boolean', true, 'invalid_type'],
    ['satu karakter', 'A', 'too_short'],
    ['satu karakter sesudah dipangkas', '  A  ', 'too_short'],
    ['101 karakter', 'x'.repeat(101), 'too_long'],
    ['101 code point emoji', '😀'.repeat(101), 'too_long'],
    ['101 karakter berisi karakter kontrol (too_long lebih dulu)', `${'x'.repeat(100)}\u0007`, 'too_long'],
    ['satu karakter kontrol (panjang dinilai sebelum format)', '\u0007', 'too_short'],
  ])('%s → %s', async (_nama, nilai, kode) => {
    await harapTolak({ customerName: nilai }, { customerName: kode });
  });

  it.each([...TAB_BARIS, ...KONTROL_DILARANG])('memuat %s di tengah → invalid_format', async (_nama, c) => {
    await harapTolak({ customerName: `Bu${c}di` }, { customerName: 'invalid_format' });
  });

  it('diterima: 2 dan 100 karakter, 100 emoji, pinggiran dipangkas, NBSP dan U+202F tidak dibuang dan bukan karakter kontrol', async () => {
    expect((await harapTerima({ customerName: 'Bu' })).publik.customerName).toBe('Bu');
    expect((await harapTerima({ customerName: 'x'.repeat(100) })).publik.customerName).toBe('x'.repeat(100));
    expect((await harapTerima({ customerName: '😀'.repeat(100) })).publik.customerName).toBe('😀'.repeat(100));
    expect((await harapTerima({ customerName: '\t Budi Santoso \r\n' })).staf.customerName).toBe('Budi Santoso');
    expect((await harapTerima({ customerName: ' Budi ' })).staf.customerName).toBe(' Budi ');
    expect((await harapTerima({ customerName: 'Budi Santoso' })).staf.customerName).toBe('Budi Santoso');
  });
});

describe('phone (NomorHpMasukan)', () => {
  it.each<[string, unknown, string]>([
    ['null (field wajib, bukan invalid_type)', null, 'required'],
    ['kosong', '', 'required'],
    ['hanya spasi dan tanda hubung', ' - - ', 'required'],
    ['angka JSON', 81234567890, 'invalid_type'],
    ['nomor rumah 021', '021-555-1234', 'invalid_format'],
    ['tanda kurung', '(0812) 3456', 'invalid_format'],
    ['+08…', '+0812345678', 'invalid_format'],
    ['6208…', '62081234567', 'invalid_format'],
    ['luar negeri', '+6512345678', 'invalid_format'],
    ['huruf', '0812abc4567', 'invalid_format'],
    ['titik', '0812.3456.7890', 'invalid_format'],
    ['tab di tengah', '0812\t34567890', 'invalid_format'],
    ['9 digit seragam', '08123456', 'too_short'],
    ['17 digit seragam', '0812345678901234', 'too_long'],
  ])('%s → %s', async (_nama, nilai, kode) => {
    await harapTolak({ phone: nilai }, { phone: kode });
  });

  it('diterima dan disimpan seragam: batas 10 dan 15 digit, spasi dan tanda hubung, pinggiran dipangkas', async () => {
    for (const [ketik, seragam] of [
      ['081234567', '6281234567'],
      ['+62 857 1234 5678 90', '628571234567890'],
      ['\t0813-2222-3333 \n', '6281322223333'],
      ['62 813 4444 5555', '6281344445555'],
    ] as const) {
      const { publik, staf } = await harapTerima({ phone: ketik });
      expect(staf.phone, ketik).toBe(seragam);
      expect((await barisBooking(publik.number)).customer_phone).toBe(seragam);
    }
  });
});

describe('vehicleType', () => {
  it.each<[string, unknown, string]>([
    ['null', null, 'required'],
    ['kosong', '', 'required'],
    ['angka', 1, 'invalid_type'],
    ['nilai lain', 'TRUCK', 'invalid_format'],
    ['huruf kecil', 'motor', 'invalid_format'],
    ['huruf campur', 'Car', 'invalid_format'],
    ['berspasi (tidak dipangkas)', ' MOTOR', 'invalid_format'],
    ['hanya spasi (bukan kosong)', '  ', 'invalid_format'],
  ])('%s → %s', async (_nama, nilai, kode) => {
    await harapTolak({ vehicleType: nilai }, { vehicleType: kode });
  });
});

describe('plate (PlatMasukan)', () => {
  it.each<[string, unknown, string]>([
    ['null (field wajib, bukan invalid_type)', null, 'required'],
    ['kosong', '', 'required'],
    ['hanya spasi, tanda hubung, titik', ' -. ', 'required'],
    ['angka JSON', 1234, 'invalid_type'],
    ['diawali angka', '1234 AB', 'invalid_format'],
    ['garis miring', 'B/1234', 'invalid_format'],
    ['tab di tengah', 'B\t1234', 'invalid_format'],
    ['huruf non-ASCII', 'BÉ 12', 'invalid_format'],
    ['satu huruf', 'B', 'too_short'],
    ['13 karakter', 'B 1234 ABCDEFGH', 'too_long'],
  ])('%s → %s', async (_nama, nilai, kode) => {
    await harapTolak({ plate: nilai }, { plate: kode });
  });

  it.each([
    ['b1234xyz', 'B1234XYZ', 'B 1234 XYZ'],
    [' B 1234  XYZ ', 'B1234XYZ', 'B 1234 XYZ'],
    ['B-1234-XYZ', 'B1234XYZ', 'B 1234 XYZ'],
    ['ab 12 c', 'AB12C', 'AB 12 C'],
    ['D 1', 'D1', 'D 1'],
    ['RI1', 'RI1', 'RI 1'],
    ['B 1234 XYZ 5', 'B1234XYZ5', 'B1234XYZ5'],
    ['ABCDE', 'ABCDE', 'ABCDE'],
  ])('"%s" disimpan dengan kunci %s dan tampil "%s"', async (ketik, kunci, tampilan) => {
    const { publik, staf } = await harapTerima({ plate: ketik });

    expect(publik.plate).toBe(tampilan);
    expect({ plate: staf.plate, plateKey: staf.plateKey }).toEqual({ plate: tampilan, plateKey: kunci });
  });
});

describe('vehicleBrand dan vehicleModel', () => {
  it.each<[string, string, unknown, string]>([
    ['vehicleBrand', 'null', null, 'required'],
    ['vehicleBrand', 'kosong', '', 'required'],
    ['vehicleBrand', 'hanya spasi', '   ', 'required'],
    ['vehicleBrand', 'angka', 1, 'invalid_type'],
    ['vehicleBrand', '51 karakter', 'x'.repeat(51), 'too_long'],
    ['vehicleBrand', 'tab di tengah', 'Hon\tda', 'invalid_format'],
    ['vehicleBrand', 'U+202E', 'Hon‮da', 'invalid_format'],
    ['vehicleModel', 'null', null, 'invalid_type'],
    ['vehicleModel', 'angka', 125, 'invalid_type'],
    ['vehicleModel', '51 karakter', 'x'.repeat(51), 'too_long'],
    ['vehicleModel', 'LF di tengah', 'Vario\n125', 'invalid_format'],
    ['vehicleModel', 'U+0000', 'Vario\u0000', 'invalid_format'],
  ])('%s %s → %s', async (field, _nama, nilai, kode) => {
    await harapTolak({ [field]: nilai }, { [field]: kode });
  });

  it('diterima: 50 karakter, dipangkas, vehicleModel boleh kosong sesudah dipangkas', async () => {
    const { staf } = await harapTerima({ vehicleBrand: ` ${'y'.repeat(50)} `, vehicleModel: ' \t ' });
    expect({ vehicleBrand: staf.vehicleBrand, vehicleModel: staf.vehicleModel }).toEqual({ vehicleBrand: 'y'.repeat(50), vehicleModel: '' });

    const dua = await harapTerima({ vehicleBrand: 'Honda', vehicleModel: ` ${'z'.repeat(50)} ` });
    expect(dua.staf.vehicleModel).toBe('z'.repeat(50));
  });
});

describe('serviceId', () => {
  it.each<[string, () => unknown, string]>([
    ['kosong', () => '', 'required'],
    ['hanya spasi (UUID tidak dipangkas)', () => '  ', 'invalid_format'],
    ['UUID sah diapit spasi', () => ` ${b.gantiOli.serviceId} `, 'invalid_format'],
    ['angka', () => 5, 'invalid_type'],
    ['bukan UUID', () => 'ganti-oli', 'invalid_format'],
    ['UUID huruf besar', () => b.gantiOli.serviceId.toUpperCase(), 'invalid_format'],
    ['UUID yang tidak ada', () => randomUUID(), 'unknown_reference'],
    ['UUID staf (bukan jasa)', () => b.kasir.staff.staffId, 'unknown_reference'],
    ['jasa yang tidak tampil di website', () => b.cekKelistrikan.serviceId, 'unknown_reference'],
    ['jasa nonpublik dan nonaktif', () => jasaNonPublikNonaktif.serviceId, 'unknown_reference'],
    ['jasa publik yang nonaktif', () => jasaNonaktif.serviceId, 'inactive_reference'],
  ])('%s → %s', async (_nama, nilai, kode) => {
    await harapTolak({ serviceId: nilai() }, { serviceId: kode });
  });

  it('null berarti tanpa jasa; jasa publik yang aktif diterima', async () => {
    expect((await harapTerima({ serviceId: null })).staf.service).toBeNull();
    expect((await harapTerima({ serviceId: b.gantiOli.serviceId })).staf.service).toEqual({ serviceId: b.gantiOli.serviceId, name: b.gantiOli.name });
  });

  it('jasa yang dinonaktifkan sesudah tampil di website langsung ditolak inactive_reference', async () => {
    const jasa = await buatJasa(b.pemilik.token);
    await harapTerima({ serviceId: jasa.serviceId });

    wajib(await api.patch(`/api/services/${jasa.serviceId}`, { token: b.pemilik.token, json: { isActive: false } }), 200);

    await harapTolak({ serviceId: jasa.serviceId }, { serviceId: 'inactive_reference' });
  });
});

describe('visitDate: hari ini sampai 30 hari ke depan menurut tanggal WIB', () => {
  it('hari ini dan hari ke-30 (WIB, jam database) diterima', async () => {
    for (const geser of [0, 30]) {
      const tgl = await tanggalWibAman(geser);
      const { publik } = await harapTerima({ visitDate: tgl });
      expect(publik.visitDate).toBe(tgl);
      expect((await barisBooking(publik.number)).visit_date).toBe(tgl);
    }
  });

  it('kemarin dan hari ke-31 menurut WIB → out_of_range', async () => {
    // Sejak 17.00 UTC, "kemarin WIB" sama dengan tanggal UTC hari ini, jadi
    // backend yang memakai tanggal UTC ikut tertangkap di jam-jam itu.
    await harapTolak({ visitDate: await tanggalWibAman(-1) }, { visitDate: 'out_of_range' });
    await harapTolak({ visitDate: await tanggalWibAman(31) }, { visitDate: 'out_of_range' });
  });

  it('jauh di masa lalu dan masa depan → out_of_range', async () => {
    const hariIni = await tanggalWibAman();
    await harapTolak({ visitDate: '2000-01-01' }, { visitDate: 'out_of_range' });
    await harapTolak({ visitDate: geserTanggal(hariIni, 365) }, { visitDate: 'out_of_range' });
  });

  it.each<[string, (tahun: number) => unknown, string]>([
    ['null', () => null, 'required'],
    ['kosong', () => '', 'required'],
    ['angka', () => 20261128, 'invalid_type'],
    ['DD-MM-YYYY', () => '28-11-2026', 'invalid_format'],
    ['tanpa nol di depan', (t) => `${t}-1-5`, 'invalid_format'],
    ['garis miring', (t) => `${t}/12/01`, 'invalid_format'],
    ['dengan jam', (t) => `${t}-12-01T00:00:00`, 'invalid_format'],
    ['30 Februari (format dinilai sebelum rentang)', (t) => `${t + 1}-02-30`, 'invalid_format'],
    ['bulan 13', (t) => `${t}-13-01`, 'invalid_format'],
    ['hanya spasi (tidak dipangkas, bukan kosong)', () => '  ', 'invalid_format'],
    ['spasi di depan', (t) => ` ${t}-12-01`, 'invalid_format'],
    ['LF di akhir', (t) => `${t}-12-01\n`, 'invalid_format'],
    ['tahun 0000 (ada di kalender Gregorian proleptik)', () => '0000-01-01', 'out_of_range'],
  ])('%s → %s', async (_nama, nilai, kode) => {
    const tahun = Number((await tanggalWibAman()).slice(0, 4));
    await harapTolak({ visitDate: nilai(tahun) }, { visitDate: kode });
  });
});

describe('complaint', () => {
  it.each<[string, unknown, string]>([
    ['null', null, 'required'],
    ['kosong', '', 'required'],
    ['hanya spasi, tab, CR, LF', ' \n\t\r ', 'required'],
    ['angka', 1, 'invalid_type'],
    ['1001 karakter', 'x'.repeat(1001), 'too_long'],
    ['1001 code point emoji', '😀'.repeat(1001), 'too_long'],
  ])('%s → %s', async (_nama, nilai, kode) => {
    await harapTolak({ complaint: nilai }, { complaint: kode });
  });

  it.each(KONTROL_DILARANG)('memuat %s → invalid_format', async (_nama, c) => {
    await harapTolak({ complaint: `Rem bunyi${c} saat dipakai.` }, { complaint: 'invalid_format' });
  });

  it('diterima: tab, LF, dan CR di tengah disimpan apa adanya; 1000 karakter dan 1000 emoji', async () => {
    const isi = 'Rem bunyi.\r\nKadang\tmacet.\nTolong cek.';
    expect((await harapTerima({ complaint: ` \n${isi}\t ` })).staf.complaint).toBe(isi);
    expect((await harapTerima({ complaint: 'x'.repeat(1000) })).staf.complaint).toBe('x'.repeat(1000));
    expect((await harapTerima({ complaint: '😀'.repeat(1000) })).staf.complaint).toBe('😀'.repeat(1000));
  });
});
