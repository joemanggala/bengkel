// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Cara WhatsApp palsu menolak pesan saat gangguan dinyalakan:
// - "status-false": HTTP 200 dengan {"status": false, "reason": ...}, seperti
//   Fonnte saat perangkat terputus. Backend yang hanya memeriksa kode HTTP
//   akan salah mengira pesan terkirim, dan tes menangkapnya.
// - "http-500": HTTP 500 dengan badan HTML (bukan JSON).
// - "putus": koneksi ditutup tanpa balasan.
// - "alasan-panjang": seperti status-false, tetapi "reason" berisi 600 huruf
//   non-ASCII. Backend wajib memotong alasan gagal menjadi 255 karakter
//   (code point) sebelum menyimpannya; INSERT yang gagal sesudah transaksi
//   di-commit tidak boleh mengubah balasan menjadi 500.
// - "gema-token": seperti status-false, tetapi "reason" memuat ulang isi
//   header Authorization (ada penyedia yang begitu). Backend wajib
//   menyamarkan WA_TOKEN sebelum menyimpan atau mencatat alasan.
export type ModeGangguan = 'status-false' | 'http-500' | 'putus' | 'alasan-panjang' | 'gema-token';
export const MODE_GANGGUAN: readonly ModeGangguan[] = ['status-false', 'http-500', 'putus', 'alasan-panjang', 'gema-token'];

// Jeda paling lama yang boleh diatur, supaya tes yang lupa mematikannya
// tidak menahan backend melewati batas waktu 10 detiknya.
export const JEDA_MAKS_MS = 5000;

export interface Pesan {
  // Nomor urut pesan yang diterima, mulai 1; juga dipakai sebagai "id" balasan.
  nomor: number;
  waktu: string;
  target: string;
  // Isi pesan sesudah CRLF diganti LF. FormData di Node mengubah LF menjadi
  // CRLF saat menyusun multipart, sedangkan pustaka Go dan PHP tidak; yang
  // dibandingkan adalah teksnya, bukan cara pengirimannya.
  pesan: string;
}

// "diproses" = permintaan sudah tiba dan sedang ditahan jeda; tes memakainya
// untuk tahu persis kapan backend sedang menunggu penyedia WhatsApp.
export type HasilPermintaan = 'diproses' | 'terkirim' | 'ditolak' | 'gangguan';

// Setiap permintaan ke /send, termasuk yang ditolak, supaya alasan
// penolakan bisa dibaca saat tes gagal. Token tidak pernah disimpan.
export interface CatatanPermintaan {
  nomor: number;
  waktu: string;
  metode: string;
  path: string;
  tokenSah: boolean;
  contentType: string | null;
  // Field teks multipart (nama → semua nilainya), null bila badan tidak bisa
  // diurai sebagai multipart.
  field: Record<string, string[]> | null;
  // Nama field yang berisi berkas, bukan teks.
  fieldBerkas: string[];
  hasil: HasilPermintaan;
  alasan: string | null;
  statusHttp: number | null;
}

export class Keadaan {
  pesan: Pesan[] = [];
  permintaan: CatatanPermintaan[] = [];
  // null = normal. Gangguan per nomor mengalahkan gangguan untuk semua nomor.
  gangguanSemua: ModeGangguan | null = null;
  gangguanNomor = new Map<string, ModeGangguan>();
  // Penundaan balasan dalam milidetik; per nomor mengalahkan semua nomor.
  jedaSemua = 0;
  jedaNomor = new Map<string, number>();
  private nomorPesan = 1;
  private nomorPermintaan = 1;

  ambilNomorPermintaan(): number {
    return this.nomorPermintaan++;
  }

  catat(catatan: CatatanPermintaan): void {
    this.permintaan.push(catatan);
  }

  simpan(target: string, mentah: string): Pesan {
    const pesan = mentah.replace(/\r\n/g, '\n');
    const lengkap: Pesan = { nomor: this.nomorPesan++, waktu: new Date().toISOString(), target, pesan };
    this.pesan.push(lengkap);
    return lengkap;
  }

  gangguanUntuk(target: string): ModeGangguan | null {
    return this.gangguanNomor.get(target) ?? this.gangguanSemua;
  }

  jedaUntuk(target: string): number {
    return this.jedaNomor.get(target) ?? this.jedaSemua;
  }

  untuk(target: string | undefined): Pesan[] {
    return target ? this.pesan.filter((p) => p.target === target.trim()) : this.pesan;
  }

  ringkasGangguan(): { semua: ModeGangguan | null; nomor: Record<string, ModeGangguan> } {
    return { semua: this.gangguanSemua, nomor: Object.fromEntries(this.gangguanNomor) };
  }

  reset(): void {
    this.pesan = [];
    this.permintaan = [];
    this.gangguanSemua = null;
    this.gangguanNomor.clear();
    this.jedaSemua = 0;
    this.jedaNomor.clear();
    this.nomorPesan = 1;
    this.nomorPermintaan = 1;
  }
}
