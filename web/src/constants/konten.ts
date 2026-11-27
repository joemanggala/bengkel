// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Isi halaman depan website yang tidak berasal dari database:
// langkah booking dan tanya jawab. Isinya jarang berubah, jadi cukup diedit di berkas ini lalu
// build ulang web; tidak perlu CMS. Nama, tagline, alamat, nomor WhatsApp, jam buka, dan tautan
// peta TIDAK ditulis di sini: semuanya diambil dari profil outlet (halaman Outlet di panel).
//
// Teks memakai sapaan "kamu" seperti seluruh aplikasi. Hindari menjanjikan hal yang tidak
// dikerjakan aplikasi (mis. "konfirmasi otomatis"): booking selalu dikonfirmasi staf.

export type LangkahBooking = { judul: string; isi: string }

export type TanyaJawab = { tanya: string; jawab: string }

export const JUDUL_LANGKAH = 'Cara booking servis'

export const LANGKAH_BOOKING: readonly LangkahBooking[] = [
    {
        judul: 'Isi form booking',
        isi: 'Tulis nama, nomor WhatsApp, data kendaraan, tanggal datang, dan keluhanmu. Tanpa daftar akun.',
    },
    {
        judul: 'Tunggu konfirmasi',
        isi: 'Staf bengkel memeriksa jadwal, lalu mengirim konfirmasi lewat WhatsApp. Status booking juga bisa kamu lihat dari tautan yang muncul setelah booking.',
    },
    {
        judul: 'Datang ke bengkel',
        isi: 'Bawa kendaraanmu pada tanggal yang dipilih. Kasir mencatatnya sebagai surat perintah kerja (SPK).',
    },
    {
        judul: 'Pantau servisnya',
        isi: 'Kamu menerima tautan lacak lewat WhatsApp untuk melihat status pengerjaan, rincian biaya, dan nota.',
    },
]

export const JUDUL_TANYA_JAWAB = 'Pertanyaan yang sering diajukan'

export const TANYA_JAWAB: readonly TanyaJawab[] = [
    {
        tanya: 'Apakah booking langsung pasti dapat jadwal?',
        jawab: 'Belum. Setiap booking diperiksa staf dulu, lalu dikonfirmasi atau ditolak dengan alasan. Kabarnya dikirim lewat WhatsApp.',
    },
    {
        tanya: 'Bisa booking untuk tanggal berapa saja?',
        jawab: 'Mulai hari ini sampai 30 hari ke depan.',
    },
    {
        tanya: 'Bagaimana kalau aku batal datang?',
        jawab: 'Selama booking masih menunggu konfirmasi, kamu bisa membatalkannya sendiri dari halaman status booking. Setelah dikonfirmasi, hubungi bengkel lewat WhatsApp.',
    },
    {
        tanya: 'Harga di daftar jasa sudah termasuk sparepart?',
        jawab: 'Belum. Harga jasa hanya ongkos pengerjaan. Sparepart yang dipakai ditambahkan sesuai pemeriksaan, dan rinciannya bisa kamu lihat di halaman lacak servis.',
    },
    {
        tanya: 'Bisa bayar sebagian dulu?',
        jawab: 'Bisa. Pembayaran boleh dicicil sejak kendaraan masuk, tetapi kendaraan baru bisa diambil setelah lunas.',
    },
]
