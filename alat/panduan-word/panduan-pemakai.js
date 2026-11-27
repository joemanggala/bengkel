// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Panduan pemakai untuk pemilik, kasir, mekanik, dan pelanggan. Label menu dan tombol disalin dari
// web (web/src); tangkapan layar dibuat dari aplikasi yang berjalan (tangkap-layar.js, npm run
// tangkap). Periksa lagi teks dan gambar bila tampilan berubah.

const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType } = require('docx')
const { p, h1, h2, h3, titik, langkah, kotak, info, tabel, tanyaJawab, gambar, gambarSejajar, sampul, simpan, jarak, WARNA, WARNA_MUDA, LEBAR } = require('./umum')

// Jalur utama SPK sebagai deretan kotak berpanah. Menunggu part dijelaskan di tabel sesudahnya.
function alurStatus() {
    const status = ['Antre', 'Dikerjakan', 'Selesai', 'Diambil']
    const lebarPanah = 360
    const lebarKotak = Math.floor((LEBAR - lebarPanah * 3) / 4)
    const tanpa = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    const batas = { top: tanpa, bottom: tanpa, left: tanpa, right: tanpa }
    const sel = []
    status.forEach((s, i) => {
        const akhir = i === status.length - 1
        sel.push(
            new TableCell({
                width: { size: lebarKotak, type: WidthType.DXA },
                shading: { fill: akhir ? WARNA : WARNA_MUDA, type: ShadingType.CLEAR, color: 'auto' },
                margins: { top: 100, bottom: 100, left: 60, right: 60 },
                borders: batas,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s, bold: true, color: akhir ? 'FFFFFF' : WARNA })] })],
            }),
        )
        if (!akhir) {
            sel.push(
                new TableCell({
                    width: { size: lebarPanah, type: WidthType.DXA },
                    borders: batas,
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '→', bold: true, color: WARNA })] })],
                }),
            )
        }
    })
    const lebar = sel.map((_, i) => (i % 2 === 0 ? lebarKotak : lebarPanah))
    return [
        new Table({ width: { size: lebar.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: lebar, rows: [new TableRow({ children: sel })] }),
        jarak(),
    ]
}

const bab = [
    // ------------------------------------------------------------------------------------------
    [
        h1('1. Kenalan dengan Aplikasi'),
        p('Aplikasi ini membantu satu bengkel motor dan mobil mengelola servis dari pelanggan booking atau datang langsung sampai kendaraan selesai, dibayar, dan diambil. Setiap kendaraan yang diservis dicatat sebagai **SPK** (surat perintah kerja): keluhan, mekanik yang mengerjakan, jasa dan sparepart yang dipakai, pembayaran, dan perjalanan statusnya. Pelanggan dikabari lewat WhatsApp dan bisa melacak servisnya sendiri dari tautan, tanpa mendaftar.'),
        p('Aplikasi punya dua sisi. **Website publik** dibuka pelanggan: halaman depan bengkel dengan daftar jasa dan harga, form booking, halaman status booking, dan halaman lacak servis yang sekaligus menjadi nota online. **Panel staf** di alamat web ditambah `/admin` dipakai pemilik, kasir, dan mekanik. Semuanya dibuka lewat **browser** (Chrome, Edge, atau Safari) di komputer kasir, laptop, tablet, atau HP; tidak ada aplikasi yang perlu dipasang.'),
        h2('1.1 Siapa bisa apa'),
        ...tabel(['Peran', 'Bisa melakukan'], [
            ['**Pemilik**', 'Semua yang bisa kasir, ditambah: mengelola jasa, sparepart (termasuk harga beli) dan stoknya, akun staf, dan profil bengkel, serta melihat rekap harian beserta laba kotornya.'],
            ['**Kasir**', 'Menerima, mengonfirmasi, menolak, dan menjadikan SPK booking dari website; membuat SPK untuk pelanggan yang datang langsung; mengelola pelanggan dan kendaraan; menugaskan mekanik; menambah dan menghapus item jasa dan sparepart; mengubah status; mencatat pembayaran; membatalkan SPK; mengirim WhatsApp; dan mencetak nota. Kasir tidak melihat harga beli sparepart dan rekap.'],
            ['**Mekanik**', 'Melihat SPK yang ditugaskan kepadanya saja, mengubah statusnya (Dikerjakan, Menunggu part, Selesai), dan mengisi diagnosis. Mekanik tidak menyentuh item, harga, pembayaran, atau pembatalan.'],
            ['**Pelanggan**', 'Tanpa akun. Melihat profil bengkel dan daftar jasa, booking lewat website, melihat dan membatalkan booking selama masih menunggu, dan melacak servis serta melihat notanya.'],
        ], [2, 7]),
        h2('1.2 Perjalanan satu SPK'),
        p('Setiap SPK dimulai dari **Antre** dan berakhir di **Diambil**:'),
        ...alurStatus(),
        ...tabel(['Status', 'Artinya'], [
            ['**Antre**', 'SPK baru dicatat dan menunggu dikerjakan. Pelanggan dikirimi WhatsApp berisi nomor SPK dan tautan lacak.'],
            ['**Dikerjakan**', 'Mekanik sedang mengerjakan kendaraan.'],
            ['**Menunggu part**', 'Pekerjaan berhenti karena sparepart belum ada. Dari sini SPK kembali ke **Dikerjakan** begitu part datang. Dikerjakan dan Menunggu part boleh bolak-balik berkali-kali.'],
            ['**Selesai**', 'Pekerjaan beres dan kendaraan siap diambil. Pelanggan otomatis dikirimi WhatsApp "siap diambil" beserta total dan tautan nota. Hanya bisa dari **Dikerjakan**, dan SPK minimal punya satu item.'],
            ['**Diambil**', 'Kendaraan sudah diserahkan ke pelanggan. Hanya bisa setelah **lunas**.'],
            ['**Dibatalkan**', 'SPK dibatalkan kasir dengan alasan, dari Antre, Dikerjakan, atau Menunggu part, dan hanya bila belum ada pembayaran. Semua sparepart di SPK kembali ke stok. SPK batal tidak dihitung di rekap.'],
        ], [3, 6]),
        h2('1.3 Aturan yang perlu kamu tahu'),
        titik('**Booking dari website harus diterima staf.** Booking masuk sebagai **Menunggu**, lalu kasir mengonfirmasi atau menolaknya dengan alasan. Form publik tidak pernah mengirim WhatsApp sendiri; pesan pertama dikirim saat staf mengonfirmasi atau menolak. Satu nomor HP paling banyak punya 3 booking yang menunggu, dan tanggal datang hari ini sampai 30 hari ke depan.'),
        titik('**Sparepart berkurang saat ditambahkan ke SPK**, bukan saat SPK selesai, supaya stok di layar sama dengan isi rak. Stok kembali bila item dihapus atau SPK dibatalkan. Sparepart yang stoknya kurang tidak bisa ditambahkan.'),
        titik('**Harga beli sparepart hanya terlihat pemilik.** Kasir, mekanik, dan pelanggan tidak pernah melihatnya: bukan di layar, nota, halaman lacak, maupun WhatsApp.'),
        titik('**Pembayaran boleh dicicil** sejak SPK dibuat (uang muka), dengan Tunai, Transfer, atau QRIS. Jumlahnya tidak boleh melebihi sisa tagihan. Kendaraan baru bisa diserahkan setelah lunas.'),
        titik('**Nama dan harga disalin ke SPK.** Mengubah harga jasa atau sparepart di katalog tidak mengubah SPK yang sudah ada, termasuk labanya di rekap.'),
        titik('**Nomor SPK dan booking berurutan terus** (`S-0001`, `B-0001`), tidak diulang per hari.'),
        titik('**Plat nomor diketik bebas.** `b1234xyz`, `B 1234 XYZ`, dan `B-1234-XYZ` dianggap plat yang sama dan ditampilkan rapi sebagai **B 1234 XYZ**. Satu plat hanya milik satu pelanggan.'),
        titik('**Belum ada diskon, void, atau refund.** Pembayaran yang sudah dicatat tidak bisa dihapus, jadi periksa jumlahnya sebelum menyimpan.'),
    ],
    // ------------------------------------------------------------------------------------------
    [
        h1('2. Pertama Kali: Pemasangan dan Masuk'),
        h2('2.1 Membuat akun pemilik'),
        p('Aplikasi yang baru dipasang belum punya akun apa pun, dan tidak ada akun atau kata sandi bawaan. Buka panel staf di alamat web ditambah `/admin` (di laptop: http://localhost:3800/admin). Selama belum ada akun, aplikasi membawamu ke halaman **Pemasangan awal**. Langkah ini hanya sekali.'),
        ...gambar('01-pemasangan.png', 'Halaman Pemasangan awal'),
        ...langkah([
            'Isi **Token pemasangan**. Nilainya sama persis dengan `SETUP_TOKEN` yang diisi orang yang memasang aplikasi di server (lihat Panduan Menjalankan di Laptop atau Panduan Upload ke VPS).',
            'Isi **Nama pemilik**, **Email**, dan **Kata sandi** (minimal 8 karakter), lalu **Ulangi kata sandi**.',
            'Klik **Buat akun pemilik**. Kamu langsung masuk dan dibawa ke halaman **Outlet** untuk melengkapi profil bengkel.',
        ]),
        ...kotak('Penting', ['Catat kata sandi pemilik di tempat aman. Aplikasi belum punya fitur "lupa kata sandi". Pemilik bisa mengganti kata sandi kasir dan mekanik dari menu **Staf**.']),
        ...info('Untuk yang memasang aplikasi', ['Setelah akun pemilik dibuat, kosongkan lagi `SETUP_TOKEN` di server. Halaman pemasangan otomatis mati begitu sudah ada akun.']),
        h2('2.2 Masuk dan keluar'),
        ...gambar('02-masuk.png', 'Halaman Masuk; nama bengkel tampil di atas'),
        ...langkah([
            'Buka alamat web aplikasi ditambah `/admin`, atau klik **Masuk ke panel** di bagian bawah halaman depan website.',
            'Isi **Email** dan **Kata sandi**, lalu klik **Masuk**. Semua peran dibawa ke **Papan servis**.',
            'Untuk keluar, klik namamu di pojok kanan atas lalu pilih **Keluar**.',
        ]),
        p('Sesi masuk berlaku 30 hari sejak terakhir kamu memakai aplikasi dan diperpanjang setiap kali dipakai. Email yang 10 kali berturut-turut salah sandi dikunci 15 menit. Di komputer bersama, selalu klik **Keluar** setelah selesai.'),
        ...info('Tombol ikon dan tanda tanya', [
            'Tombol aksi di baris daftar, seperti **Ubah**, **Stok masuk**, atau **Kartu stok**, berupa ikon kecil. Arahkan kursor ke ikonnya (atau pindah ke sana dengan tombol Tab) untuk melihat namanya.',
            'Tombol **?** kecil di samping judul halaman menyimpan penjelasan singkat halaman itu. Klik untuk membukanya, klik lagi untuk menutupnya. Menu di kiri bisa diciutkan lewat tombol garis tiga di pojok kiri atas.',
        ]),
    ],
    // ------------------------------------------------------------------------------------------
    [
        h1('3. Pemilik: Menyiapkan Bengkel'),
        p('Bab ini untuk akun **pemilik**. Menu di kiri memuat **Papan servis**, **SPK baru**, **Booking**, dan **Pelanggan** (juga ada di akun kasir), serta bagian **Khusus pemilik**: **Jasa**, **Sparepart**, **Staf**, **Outlet**, dan **Rekap**. Urutan yang disarankan: profil bengkel, jasa, sparepart beserta stok awalnya, lalu akun kasir dan mekanik.'),
        h2('3.1 Profil bengkel (Outlet)'),
        p('Buka **Outlet**, isi profilnya, lalu klik **Simpan profil**. Data ini tampil di halaman depan website, halaman masuk, nota, dan pesan WhatsApp.'),
        ...gambar('03-outlet.png', 'Halaman Outlet'),
        ...tabel(['Kolom', 'Isi'], [
            ['**Nama bengkel**', 'Bawaannya "Nama Bengkel"; ganti dengan nama bengkelmu.'],
            ['**Tagline**', 'Opsional. Kalimat pendek di bawah nama di halaman depan.'],
            ['**Nomor WhatsApp**', 'Opsional. Nomor bengkel untuk tombol **Tanya lewat WhatsApp** di website, misalnya 0812-3456-7000.'],
            ['**Alamat**, **Jam buka**', 'Opsional; boleh beberapa baris. Tampil di website dan nota.'],
            ['**Tautan peta**', 'Opsional. Tautan bagikan dari Google Maps, diawali `https://`. Menjadi tombol **Buka di peta** di website.'],
            ['**Kaki nota**', 'Kalimat penutup di nota dan pesan WhatsApp nota, misalnya "Garansi servis 7 hari".'],
        ], [3, 6]),
        p('Langkah booking dan daftar tanya jawab di halaman depan tidak diatur dari sini. Keduanya ada di satu berkas di kode web (lihat Panduan Arsitektur dan Teknologi).'),
        h2('3.2 Jasa'),
        p('Buka **Jasa**. Daftar ini berisi jasa yang dijual bengkel beserta harganya. Jasa yang bertanda **Tampil** muncul di halaman depan website dan bisa dipilih pelanggan saat booking; yang **Disembunyikan** hanya bisa dipakai staf di SPK (misalnya pekerjaan yang harganya harus dicek dulu).'),
        ...gambar('04-jasa.png', 'Daftar jasa: harga, durasi, tampil di website atau tidak, dan status'),
        p('Klik **Tambah jasa**, isi dialognya, lalu klik **Tambah jasa** di dalam dialog.'),
        ...gambar('05-dialog-jasa.png', 'Dialog Tambah jasa'),
        ...tabel(['Kolom', 'Isi'], [
            ['**Nama jasa**', 'Harus berbeda dari jasa lain, misalnya Servis Rutin Motor.'],
            ['**Harga**', 'Ongkos pengerjaan dalam rupiah, tanpa sparepart. Ketik angkanya saja; titik ribuan terisi sendiri.'],
            ['**Durasi (menit)**', 'Opsional. Perkiraan lama pengerjaan; di website tampil sebagai "± 1 jam" atau "± 15 menit".'],
            ['**Urutan tampil**', 'Angka kecil tampil lebih dulu di daftar jasa website.'],
            ['**Deskripsi**', 'Opsional. Penjelasan singkat yang tampil di halaman depan.'],
            ['**Tampil di website dan bisa dipilih saat booking**', 'Matikan untuk jasa yang hanya dipakai staf.'],
            ['**Aktif (bisa dipakai di SPK baru)**', 'Jasa nonaktif tidak bisa ditambahkan ke SPK baru dan tidak tampil di website.'],
        ], [3, 6]),
        p('Jasa **tidak pernah dihapus**, karena SPK lama menyimpan salinannya. Jasa yang tidak dipakai lagi cukup dinonaktifkan lewat ikon **Ubah**. Saring daftar dengan **Semua**, **Aktif**, atau **Nonaktif**.'),
        h2('3.3 Sparepart dan stok'),
        p('Buka **Sparepart**. Daftar ini berisi sparepart yang dijual beserta harga jual, harga beli, stok, dan levelnya. Saringan **Stok menipis** menampilkan yang perlu segera dibeli.'),
        ...gambar('06-sparepart.png', 'Daftar sparepart dengan ikon Stok masuk, Stok keluar, Hitung ulang, Kartu stok, dan Ubah'),
        h3('Menambah sparepart'),
        p('Klik **Tambah sparepart** lalu isi:'),
        ...tabel(['Kolom', 'Isi'], [
            ['**SKU**', 'Kode barang, unik, misalnya OLI-1040-08.'],
            ['**Satuan**', 'Satuan jual, misalnya botol, set, atau pcs.'],
            ['**Nama sparepart**', 'Nama yang tampil di SPK, nota, dan halaman lacak.'],
            ['**Harga jual**', 'Harga ke pelanggan per satuan. Harga sparepart di SPK selalu harga jual ini.'],
            ['**Harga beli**', 'Modal per satuan. Rahasia pemilik; dipakai menghitung laba kotor. Boleh 0 dulu, tetapi rekap akan memberi catatan "Harga beli belum lengkap".'],
            ['**Stok minimum**', 'Sparepart ditandai **Menipis** bila stoknya sudah sebesar angka ini atau kurang.'],
            ['**Stok awal**', 'Jumlah yang ada di rak sekarang. Dicatat di kartu stok sebagai "Stok awal".'],
        ], [3, 6]),
        p('Level stok: **Aman** (di atas stok minimum), **Menipis** (sama dengan atau di bawah stok minimum), dan **Habis** (stok 0). Sparepart yang habis tidak bisa dipilih di SPK.'),
        h3('Mencatat perubahan stok'),
        p('Stok **tidak diketik langsung**. Setiap perubahan dicatat lewat ikon di baris sparepart, supaya selalu ada jejaknya di kartu stok:'),
        ...tabel(['Ikon', 'Untuk apa'], [
            ['**Stok masuk**', 'Barang datang dari pemasok. Isi **Jumlah** dan, bila harganya berubah, **Harga beli per satuan**: nilai itu menjadi harga beli sparepart yang baru.'],
            ['**Stok keluar**', 'Barang keluar bukan karena SPK, misalnya rusak, hilang, atau dipakai sendiri. **Catatan** (alasannya) wajib diisi.'],
            ['**Hitung ulang**', 'Stok opname: isi **Stok hasil hitung** sesuai isi rak dan catatannya. Selisihnya dicatat di kartu stok.'],
            ['**Kartu stok**', 'Riwayat semua perubahan stok sparepart itu.'],
            ['**Ubah**', 'Mengganti SKU, nama, satuan, harga, stok minimum, atau menonaktifkan sparepart. Mengubah harga tidak mengubah SPK yang sudah ada.'],
        ], [3, 6]),
        ...gambar('07-stok-masuk.png', 'Dialog Stok masuk'),
        p('Sparepart yang dipasang ke kendaraan pelanggan **tidak** dicatat lewat Stok keluar: stoknya berkurang sendiri saat kasir menambahkannya ke SPK.'),
        ...gambar('08-kartu-stok.png', 'Kartu stok: waktu, jenis, perubahan, stok sesudahnya, keterangan, dan staf'),
        ...tabel(['Jenis di kartu stok', 'Artinya'], [
            ['**Stok masuk**', 'Termasuk "Stok awal" saat sparepart dibuat.'],
            ['**Stok keluar**', 'Pengeluaran manual beserta alasannya.'],
            ['**Hitung ulang**', 'Selisih hasil opname (boleh plus, minus, atau 0).'],
            ['**Terpakai SPK**', 'Dipasang di SPK; nomor SPK-nya tertulis di Keterangan dan bisa diklik.'],
            ['**Kembali dari SPK**', 'Item dihapus dari SPK atau SPK dibatalkan.'],
        ], [3, 6]),
        h2('3.4 Akun staf'),
        p('Buka **Staf** lalu klik **Tambah staf**. Isi **Nama**, **Email** untuk masuk, **Kata sandi** awal (8 sampai 72 karakter), dan **Peran**: **Pemilik**, **Kasir**, atau **Mekanik**.'),
        ...gambar('09-staf.png', 'Daftar staf'),
        titik('Beri tahu staf email dan kata sandinya. Staf tidak bisa mengganti kata sandinya sendiri; pemilik menggantinya lewat ikon **Ubah**.'),
        titik('Akun mekanik muncul di pilihan **Mekanik** saat kasir membuat atau mengubah SPK. Mekanik yang dinonaktifkan tidak bisa masuk dan tidak bisa ditugaskan lagi.'),
        titik('Akun yang tidak dipakai lagi dinonaktifkan, bukan dihapus.'),
        titik('Aplikasi selalu menyisakan **paling sedikit satu pemilik aktif**: pemilik terakhir tidak bisa dinonaktifkan atau diganti perannya.'),
        h2('3.5 Rekap harian dan laba kotor'),
        p('Buka **Rekap** untuk melihat satu hari kerja. Pilih **Tanggal**, atau klik **Sebelumnya** dan **Hari ini**. Tanggal dan jam memakai **WIB**.'),
        ...gambar('10-rekap.png', 'Rekap harian: uang diterima, nilai SPK selesai, laba kotor, dan jumlah SPK'),
        ...tabel(['Angka', 'Artinya'], [
            ['**Uang diterima**', 'Semua pembayaran yang **dicatat** di tanggal itu, juga untuk SPK yang masuk di hari lain. Dirinci per metode di kartu **Uang diterima per metode**.'],
            ['**Nilai SPK selesai**', 'Total SPK yang ditandai **Selesai** di tanggal itu, dirinci menjadi jasa dan part.'],
            ['**Laba kotor**', 'Nilai SPK selesai dikurangi **modal part** (harga beli × jumlah). Jasa dianggap bermodal 0.'],
            ['**SPK**', 'Jumlah SPK selesai, ditambah berapa yang masuk, diambil, dan dibatalkan di tanggal itu.'],
        ], [3, 6]),
        p('Di bawahnya ada **SPK selesai per mekanik**, **Jasa terlaris**, dan **Sparepart terlaris** (lima teratas, untuk sparepart beserta modal dan labanya). SPK yang dibatalkan tidak dihitung.'),
        ...info('Mengapa memakai tanggal Selesai', ['Servis bengkel bisa berhari-hari, dan item SPK baru final saat pekerjaan selesai. Karena itu nilai, modal, laba, dan terlaris dihitung dari SPK yang **Selesai** di tanggal itu, sehingga angka hari yang sudah lewat tidak berubah lagi. Laba kotor belum dikurangi gaji, sewa, listrik, dan biaya lain, jadi bukan laba bersih.']),
        ...kotak('Catatan "Harga beli belum lengkap"', ['Bila ada sparepart terjual yang harga belinya 0, modalnya dihitung 0 dan laba kotornya terlalu besar. Rekap memberi catatan kuning. Lengkapi harga beli di halaman **Sparepart**; SPK berikutnya memakai harga beli yang baru, sedangkan SPK yang sudah ada tetap dengan harga beli saat item ditambahkan.']),
    ],
    // ------------------------------------------------------------------------------------------
    [
        h1('4. Kasir: Bekerja Sehari-hari'),
        p('Kasir melihat empat menu: **Papan servis**, **SPK baru**, **Booking**, dan **Pelanggan**. Halaman khusus pemilik tidak muncul; bila dibuka lewat alamatnya, kasir dikembalikan ke Papan servis dengan penjelasan. Semua yang dijelaskan di bab ini juga bisa dilakukan pemilik.'),
        h2('4.1 Papan servis'),
        p('**Papan servis** adalah layar utama. Isinya SPK yang kendaraannya masih di bengkel, dikelompokkan per status: **Antre**, **Dikerjakan**, **Menunggu part**, dan **Selesai**. Halaman memperbarui dirinya otomatis setiap 20 detik.'),
        ...gambar('11-papan.png', 'Papan servis: satu kolom per status, dengan total dan status bayar tiap SPK'),
        titik('Setiap kartu menunjukkan nomor SPK, plat dan kendaraan, pelanggan, keluhan, mekanik, waktu masuk, total, dan status bayar (**Belum bayar**, **Bayar sebagian**, atau **Lunas**).'),
        titik('**Di bengkel** menampilkan SPK yang sedang berjalan; **Riwayat** menampilkan SPK yang sudah diambil atau dibatalkan.'),
        titik('Saring dengan pilihan **Mekanik**, atau cari dengan nomor SPK, plat, nama, atau nomor HP.'),
        titik('Klik kartu untuk membuka rincian SPK.'),
        h2('4.2 Booking masuk'),
        p('Buka **Booking**. Booking dari website masuk ke tab **Menunggu**. Tab lainnya: **Dikonfirmasi**, **Jadi SPK**, **Ditolak**, **Dibatalkan** (oleh pelanggan), dan **Semua**. Saring dengan **Tanggal datang** (atau **Hari ini**) untuk melihat siapa yang dijadwalkan datang, dan cari dengan nomor, nama, HP, atau plat.'),
        ...gambar('12-booking.png', 'Daftar booking yang menunggu'),
        p('Klik nomor booking untuk membuka rinciannya: tanggal datang, pemesan, nomor WhatsApp, kendaraan, jasa yang dipilih, dan keluhan.'),
        ...gambar('13-booking-rincian.png', 'Rincian booking yang menunggu, dengan tombol Konfirmasi, Jadikan SPK, dan Tolak'),
        h2('4.3 Mengonfirmasi dan menolak booking'),
        ...tabel(['Tombol', 'Yang terjadi'], [
            ['**Konfirmasi**', 'Booking menjadi **Dikonfirmasi** dan pelanggan langsung dikirimi WhatsApp berisi nomor booking, plat, tanggal datang, dan jasanya. Tidak ada dialog tambahan.'],
            ['**Tolak**', 'Membuka dialog **Alasan tolak** (minimal 3 karakter). Klik **Tolak booking**: booking menjadi **Ditolak**, dan alasannya dikirim ke pelanggan lewat WhatsApp serta tampil di halaman bookingnya. Booking yang sudah dikonfirmasi pun masih bisa ditolak.'],
            ['**Jadikan SPK**', 'Dipakai saat pelanggan sudah datang (bagian 4.4).'],
        ], [2, 7]),
        ...gambar('14-tolak-booking.png', 'Dialog tolak booking; alasan ini dibaca pelanggan'),
        ...kotak('Tulis alasan untuk pelanggan', ['Alasan tolak dikirim apa adanya ke pelanggan. Tulis sopan dan beri jalan keluar, misalnya "Tanggal itu sudah penuh. Silakan booking lagi untuk hari Senin."']),
        p('Pesan booking sengaja tidak memuat nama, merek, atau keluhan yang diketik pemesan, karena nomor di form publik belum tentu milik pemesan. Bila pesan konfirmasi atau penolakan gagal terkirim, tidak ada tombol kirim ulang: hubungi pelanggan sendiri lewat nomornya.'),
        h2('4.4 Menjadikan booking SPK'),
        p('Saat pelanggan datang, buka bookingnya lalu klik **Jadikan SPK**. Booking yang masih menunggu juga boleh langsung dijadikan SPK bila pelanggan datang sebelum dikonfirmasi.'),
        ...gambar('15-jadikan-spk.png', 'Dialog Jadikan SPK'),
        ...langkah([
            'Isi **Odometer (km)** dan **Perkiraan selesai** bila ada (keduanya opsional; perkiraan selesai tampil di halaman lacak pelanggan).',
            'Pilih **Mekanik**, atau biarkan **Belum ditugaskan** untuk ditugaskan nanti.',
            'Klik **Jadikan SPK**. Kamu dibawa ke rincian SPK barunya.',
        ]),
        p('Aplikasi mencari pelanggan dari nomor HP dan kendaraan dari plat di booking, lalu membuatnya bila belum ada. Pelanggan lama tidak diganti namanya. Keluhan disalin dari booking, dan jasa yang dipilih pelanggan menjadi item pertama. Pelanggan dikirimi WhatsApp berisi nomor SPK dan tautan lacak.'),
        ...info('Plat milik pelanggan lain', ['Bila plat di booking sudah terdaftar atas nama pelanggan lain, aplikasi menolak dan memintamu memeriksanya. Periksa di menu **Pelanggan**: mungkin kendaraannya sudah berpindah tangan (ubah datanya) atau platnya salah ketik.']),
        h2('4.5 SPK baru untuk pelanggan yang datang langsung'),
        p('Buka **SPK baru** (atau klik **SPK baru** di Papan servis). Ketik plat (misalnya `B 1234`), nomor HP, atau nama di kotak pencarian.'),
        ...gambar('16-spk-baru-cari.png', 'Hasil pencarian: pelanggan beserta kendaraannya'),
        titik('Klik kendaraannya bila sudah terdaftar.'),
        titik('Pelanggan lama dengan kendaraan baru: klik **Kendaraan lain** lalu isi **Jenis kendaraan**, **Plat nomor**, **Merek**, dan bila perlu **Tipe**, **Tahun**, dan **Warna**.'),
        titik('Pelanggan baru: klik **Pelanggan baru**, isi **Nama** dan **Nomor HP (WhatsApp)** (alamat dan catatan opsional), lalu tambahkan kendaraannya.'),
        p('Lalu isi data SPK dan klik **Buat SPK**:'),
        ...gambar('17-spk-baru-form.png', 'Form SPK baru setelah kendaraan dipilih'),
        ...tabel(['Kolom', 'Isi'], [
            ['**Keluhan**', 'Wajib. Keluhan pelanggan atau pekerjaan yang diminta.'],
            ['**Odometer (km)**', 'Opsional. Kilometer saat kendaraan masuk; tercatat di riwayat servis.'],
            ['**Perkiraan selesai**', 'Opsional. Jam WIB; tampil di halaman lacak pelanggan.'],
            ['**Mekanik**', 'Opsional. Mekanik hanya melihat SPK yang ditugaskan kepadanya.'],
        ], [3, 6]),
        p('SPK baru bernomor berikutnya (misalnya `S-0007`) dengan status **Antre**, dan pelanggan dikirimi WhatsApp berisi nomor SPK dan tautan lacak.'),
        h2('4.6 Rincian SPK: item jasa dan sparepart'),
        p('Klik kartu di Papan servis untuk membuka rincian SPK. Kartu **Status** di kiri atas berisi tombol perpindahan status yang sah saat itu; di bawahnya **Item jasa dan sparepart** dan **Pembayaran**. Di kanan ada **Data SPK**, **WhatsApp dan tautan lacak**, dan **Linimasa**.'),
        ...gambar('18-rincian-spk.png', 'Rincian SPK yang sedang dikerjakan'),
        p('Klik **Tambah item**, pilih **Jasa** atau **Sparepart**, lalu klik **Tambah item** di dalam dialog:'),
        ...gambar('19-tambah-item.png', 'Dialog Tambah item: memilih sparepart beserta stoknya'),
        titik('**Jasa**: pilih dari daftar. **Harga per satuan** terisi harga katalog dan boleh diganti untuk item ini saja, misalnya pekerjaan tambahan yang harganya beda. Jasa yang disembunyikan dari website tetap bisa dipilih.'),
        titik('**Sparepart**: cari nama atau SKU lalu klik sparepart-nya. Harganya selalu harga jual katalog, dan stoknya **langsung berkurang**. Sparepart yang habis tidak bisa diklik; bila jumlahnya melebihi stok, aplikasi menolak dan menyebut sisa stoknya.'),
        titik('**Jumlah** 1 sampai 99 per item, paling banyak 50 item per SPK. Total dihitung otomatis: jasa + sparepart.'),
        titik('Ikon **Hapus** di baris item menghapusnya; stok sparepart-nya kembali. Item tidak bisa dihapus bila total jadi lebih kecil dari yang sudah dibayar.'),
        p('Item hanya bisa ditambah dan dihapus selama SPK **Antre**, **Dikerjakan**, atau **Menunggu part**. Sesudah **Selesai**, item terkunci supaya nilai SPK dan rekapnya tidak berubah lagi.'),
        h2('4.7 Menugaskan mekanik dan mengubah data SPK'),
        p('Klik **Ubah** di kartu **Data SPK** untuk mengganti **Keluhan**, **Odometer (km)**, **Perkiraan selesai**, atau **Mekanik**, lalu klik **Simpan perubahan**. Dari sini juga kamu menugaskan mekanik untuk SPK yang dibuat tanpa mekanik, atau memindahkannya ke mekanik lain. Data SPK hanya bisa diubah sebelum **Selesai**.'),
        ...gambar('20-ubah-spk.png', 'Dialog Ubah SPK: memilih mekanik'),
        h2('4.8 Mengubah status'),
        p('Tombol di kartu **Status** mengikuti status SPK saat itu:'),
        ...tabel(['Status sekarang', 'Tombol'], [
            ['Antre', '**Mulai kerjakan**'],
            ['Dikerjakan', '**Menunggu part** atau **Tandai selesai**'],
            ['Menunggu part', '**Lanjut dikerjakan**'],
            ['Selesai', '**Serahkan kendaraan** (aktif setelah lunas)'],
        ], [3, 6]),
        p('Isi **Catatan perubahan status** bila perlu, misalnya "menunggu kampas rem dari pemasok". Catatan hanya masuk ke **Linimasa** staf dan tidak tampil ke pelanggan. Linimasa mencatat setiap perubahan: status, waktu, dan siapa yang mengubahnya.'),
        p('Saat **Tandai selesai** diklik, pelanggan otomatis dikirimi WhatsApp "siap diambil" beserta total dan tautan nota. Biasanya mekanik yang menandai selesai dari akunnya (bab 5), tetapi kasir dan pemilik juga bisa.'),
        h3('Membatalkan SPK'),
        p('Klik **Batalkan SPK** di kartu Status, isi **Alasan batal**, lalu klik **Batalkan SPK** di dialog. Hanya bisa dari Antre, Dikerjakan, atau Menunggu part, dan **hanya bila belum ada pembayaran**. Semua sparepart kembali ke stok, dan alasannya tampil di halaman lacak pelanggan.'),
        h2('4.9 Pembayaran dan nota'),
        p('Kartu **Pembayaran** menunjukkan pembayaran yang sudah dicatat, **Terbayar**, dan **Sisa**. Pembayaran boleh dicatat kapan saja sejak SPK dibuat, termasuk uang muka, dan boleh beberapa kali.'),
        ...gambar('21-pembayaran.png', 'Mencatat pelunasan tunai dengan kembalian', 340),
        ...langkah([
            '**Jumlah bayar** terisi sisa tagihan. Ganti bila pelanggan membayar sebagian.',
            'Pilih **Metode**: **Tunai**, **Transfer**, atau **QRIS**.',
            'Untuk tunai, isi **Uang diterima** (opsional) supaya kembaliannya terhitung di layar.',
            'Klik **Catat pembayaran**. Status bayar berubah menjadi **Bayar sebagian** atau **Lunas**.',
        ]),
        p('Setelah lunas dan SPK **Selesai**, klik **Serahkan kendaraan** saat pelanggan mengambil kendaraannya. SPK menjadi **Diambil** dan pindah ke Riwayat.'),
        p('Klik **Cetak nota** di kanan atas rincian SPK untuk mencetak nota ke printer thermal 58 mm lewat dialog cetak browser. Nota memuat profil bengkel, item, total, pembayaran, sisa, tautan nota online, dan kaki nota.'),
        ...gambar('23-nota.png', 'Nota 58 mm', 220),
        h2('4.10 WhatsApp dan tautan lacak'),
        p('Kartu **WhatsApp dan tautan lacak** menunjukkan tiga pesan SPK beserta hasil kirimnya (**Terkirim**, **Gagal**, atau **Belum dikirim**):'),
        ...gambar('22-whatsapp.png', 'Kartu WhatsApp dan tautan lacak', 360),
        ...tabel(['Pesan', 'Dikirim'], [
            ['**SPK dibuat (tautan lacak)**', 'Otomatis saat SPK dibuat. Bisa dikirim ulang selama SPK tidak dibatalkan.'],
            ['**Siap diambil**', 'Otomatis saat SPK menjadi Selesai. Bisa dikirim ulang setelah Selesai.'],
            ['**Nota**', 'Tidak pernah otomatis. Klik **Kirim** untuk mengirim rincian nota kapan saja, misalnya setelah lunas.'],
        ], [3, 6]),
        p('Isi **Kirim ke nomor lain** bila pesan perlu dikirim ke nomor yang berbeda, misalnya nota diminta dikirim ke nomor kantor. Nomor itu hanya dipakai untuk pengiriman ini; nomor pelanggan tidak berubah. Pesan yang gagal tidak membatalkan SPK; perbaiki penyebabnya lalu klik **Kirim ulang**.'),
        p('Di bawahnya ada **Tautan lacak pelanggan**: **Salin** untuk menempelkannya di chat, **Buka** untuk melihat halaman yang dilihat pelanggan, dan **Buat ulang** untuk membuat tautan baru bila tautan lama tersebar ke orang lain. Tautan lama langsung tidak berlaku; kirim lagi pesan "SPK dibuat" supaya pelanggan menerima tautan barunya.'),
        h2('4.11 Pelanggan dan riwayat servis'),
        p('Buka **Pelanggan** untuk mencari pelanggan dari nama, nomor HP, atau plat. Klik **Tambah pelanggan** untuk mendaftarkan pelanggan tanpa langsung membuat SPK.'),
        ...gambar('24-pelanggan.png', 'Daftar pelanggan'),
        p('Klik nama pelanggan untuk membuka rinciannya. Di sana kamu bisa **Ubah data** (nama, nomor HP, alamat, dan catatan internal yang tidak pernah tampil ke pelanggan), **Tambah** kendaraan, **Ubah** data kendaraan, dan membuat **SPK baru** langsung untuk kendaraan itu. Klik sebuah kendaraan untuk melihat **Riwayat servis**-nya: semua SPK kendaraan itu, termasuk keluhan, status, dan totalnya.'),
        ...gambar('25-pelanggan-rincian.png', 'Rincian pelanggan, kendaraannya, dan riwayat servis'),
        p('Nomor HP diterima dalam bentuk `08…`, `+628…`, atau `628…`, boleh dengan spasi atau tanda hubung. Satu nomor HP hanya untuk satu pelanggan, dan satu plat hanya untuk satu kendaraan.'),
    ],
    // ------------------------------------------------------------------------------------------
    [
        h1('5. Mekanik: Mengerjakan SPK'),
        p('Mekanik masuk dengan akun yang dibuat pemilik dan hanya melihat satu menu: **Papan servis**. Isinya **hanya SPK yang ditugaskan kepadanya**. SPK mekanik lain tidak tampil dan tidak bisa dibuka, walau alamatnya diketik langsung.'),
        h2('5.1 Papan servis mekanik'),
        ...gambar('26-mekanik-papan.png', 'Papan servis di akun mekanik: hanya SPK miliknya'),
        p('Papan memperbarui diri setiap 20 detik, jadi SPK yang baru ditugaskan kasir muncul sendiri. Tab **Riwayat** berisi SPK miliknya yang sudah diambil atau dibatalkan. Total dan status bayar tidak ditampilkan di kartu mekanik.'),
        h2('5.2 Mengubah status'),
        p('Klik kartu SPK untuk membuka rinciannya. Mekanik melihat kendaraan, pelanggan, keluhan, item yang sudah dimasukkan kasir, dan linimasa.'),
        ...gambar('27-mekanik-spk.png', 'Rincian SPK di akun mekanik, dengan diagnosis yang sedang diisi'),
        ...langkah([
            'Saat mulai mengerjakan, klik **Mulai kerjakan**. Status menjadi **Dikerjakan**.',
            'Bila pekerjaan berhenti karena sparepart belum ada, tulis catatannya (misalnya "menunggu filter udara dari pemasok") lalu klik **Menunggu part**. Klik **Lanjut dikerjakan** setelah part datang.',
            'Setelah selesai, klik **Tandai selesai**. Pelanggan otomatis dikabari lewat WhatsApp bahwa kendaraannya siap diambil.',
        ]),
        p('Mekanik tidak bisa menyerahkan kendaraan, membatalkan SPK, mengubah keluhan atau mekanik, maupun melihat pembayaran: semua itu tugas kasir. **Tandai selesai** juga butuh minimal satu item di SPK.'),
        h2('5.3 Diagnosis dan sparepart yang dibutuhkan'),
        p('Tulis hasil pemeriksaan di kotak **Diagnosis**, lalu klik **Simpan diagnosis**. Diagnosis terlihat oleh kasir dan pemilik, tetapi **tidak tampil ke pelanggan**. Diagnosis bisa diisi selama SPK belum Selesai.'),
        ...kotak('Sparepart ditambahkan kasir', ['Mekanik tidak bisa menambah item. Bila butuh sparepart atau ada pekerjaan tambahan, beri tahu kasir (atau tulis di diagnosis); kasir yang menambahkannya ke SPK, karena sparepart langsung mengurangi stok dan mengubah tagihan pelanggan.']),
    ],
    // ------------------------------------------------------------------------------------------
    [
        h1('6. Pelanggan: Booking dan Melacak Servis'),
        p('Pelanggan memakai website bengkel tanpa akun dan tanpa kode OTP, cukup dari browser di HP. Bab ini menjelaskan yang dilihat pelanggan, supaya staf bisa membantu bila ada yang bertanya.'),
        h2('6.1 Halaman depan'),
        p('Halaman depan (alamat web bengkel) menampilkan nama dan tagline bengkel, tombol **Booking servis** dan **Tanya lewat WhatsApp**, **Jasa dan harga** (hanya jasa aktif yang bertanda tampil di website), **Cara booking servis**, tanya jawab, serta alamat, jam buka, dan tombol **Buka di peta**. Harga jasa belum termasuk sparepart. Di bagian bawah ada tautan **Masuk ke panel** untuk staf.'),
        h2('6.2 Booking dari website'),
        ...langkah([
            'Klik **Booking servis**.',
            'Isi **Nama**, **Nomor WhatsApp**, **Jenis kendaraan** (Motor atau Mobil), **Plat nomor**, **Merek**, dan bila mau **Tipe** dan **Jasa**. Belum yakin jasanya? Kosongkan dan tulis keluhannya.',
            'Pilih **Tanggal datang** (hari ini sampai 30 hari ke depan) dan tulis **Keluhan**.',
            'Klik **Kirim booking**. Pelanggan dibawa ke halaman status booking dengan nomor `B-…` dan status **Menunggu**.',
        ]),
        ...gambarSejajar([
            ['28-hp-depan.png', 'Halaman depan di HP'],
            ['29-hp-booking.png', 'Form booking'],
            ['30-hp-status-booking.png', 'Status booking menunggu'],
        ]),
        p('Booking belum pasti sampai dikonfirmasi staf. Pelanggan dikabari lewat WhatsApp saat booking dikonfirmasi atau ditolak (beserta alasannya). Satu nomor paling banyak punya tiga booking yang menunggu.'),
        h2('6.3 Melihat dan membatalkan booking'),
        p('Alamat halaman status booking memuat kode rahasia dan hanya diberikan sekali, saat booking dikirim. Pelanggan sebaiknya menyimpannya. Browser yang dipakai booking juga mengingatnya: daftar **Booking kamu** di halaman depan menautkan ke booking yang dibuat dari HP itu.'),
        p('Selama booking masih **Menunggu**, pelanggan bisa membatalkannya sendiri lewat tombol **Batalkan booking**. Setelah dikonfirmasi, pelanggan yang batal datang menghubungi bengkel lewat WhatsApp. Halaman status menunjukkan juga bila booking dikonfirmasi, ditolak (dengan alasannya), atau sudah jadi SPK (dengan nomor SPK-nya).'),
        h2('6.4 Melacak servis dan nota online'),
        p('Saat SPK dibuat, pelanggan menerima WhatsApp berisi tautan lacak `/servis/…`. Halaman itu menunjukkan status servis (diperbarui otomatis setiap 30 detik), perkiraan selesai, **Rincian biaya** (setiap jasa dan sparepart, total, terbayar, dan sisa), **Perjalanan servis**, data kendaraan, dan kaki nota. Halaman yang sama berfungsi sebagai **nota online**, jadi tautan dari pesan "siap diambil" dan nota sama.'),
        ...gambarSejajar([['31-hp-lacak.png', 'Halaman lacak servis di HP']]),
        p('Nomor HP di halaman publik selalu disamarkan (misalnya `6285****2233`), dan diagnosis, catatan linimasa, nama mekanik, serta harga beli tidak pernah tampil. Bila tautan sudah diganti bengkel (**Buat ulang**), tautan lama menampilkan pesan bahwa tautan tidak berlaku.'),
    ],
    // ------------------------------------------------------------------------------------------
    [
        h1('7. Pertanyaan yang Sering Muncul'),
        ...tanyaJawab([
            ['Pelanggan datang tanpa booking. Apa yang dibuat?', 'Langsung buat **SPK baru** (bagian 4.5). Booking hanya untuk pelanggan yang memesan lewat website.'],
            ['Booking masuk tetapi tidak ada WhatsApp ke pelanggan. Normal?', 'Ya. Form publik tidak pernah mengirim WhatsApp. Pesan pertama dikirim saat kamu mengonfirmasi atau menolak booking.'],
            ['Sparepart yang dibutuhkan habis. Apa yang dilakukan?', 'Mekanik atau kasir mengubah status menjadi **Menunggu part** dengan catatan. Setelah barang datang, pemilik mencatat **Stok masuk**, kasir menambahkan sparepart ke SPK, lalu status dikembalikan ke **Dikerjakan**.'],
            ['Salah memasukkan sparepart ke SPK. Bagaimana memperbaikinya?', 'Selama SPK belum Selesai, hapus itemnya dengan ikon **Hapus**. Stoknya kembali sendiri dan tercatat di kartu stok sebagai "Kembali dari SPK".'],
            ['SPK sudah Selesai tetapi ternyata ada pekerjaan tambahan.', 'Item terkunci setelah Selesai supaya nilai dan rekapnya tidak berubah. Buat SPK baru untuk pekerjaan tambahan itu.'],
            ['Pelanggan sudah membayar uang muka, lalu batal servis.', 'SPK yang sudah punya pembayaran tidak bisa dibatalkan, dan belum ada fitur refund. Kembalikan uangnya di luar aplikasi atas persetujuan pemilik; SPK itu tetap tercatat beserta pembayarannya.'],
            ['Mekanik tidak melihat SPK yang baru dibuat.', 'SPK itu belum ditugaskan kepadanya. Kasir memilih mekanik lewat **Ubah** di kartu Data SPK. Papan mekanik memperbarui diri setiap 20 detik.'],
            ['Kendaraan tidak bisa diserahkan.', 'Tombol **Serahkan kendaraan** baru aktif setelah SPK **Selesai** dan **lunas**. Catat pelunasannya dulu.'],
            ['Pesan WhatsApp berstatus Gagal.', 'Transaksi tetap tersimpan. Periksa nomor pelanggan, lalu klik **Kirim ulang**. Bila semua pesan gagal, minta orang yang memasang aplikasi memeriksa pengaturan WhatsApp di server.'],
            ['Laba di Rekap terlihat terlalu besar.', 'Ada sparepart terjual yang harga belinya masih 0. Lengkapi di halaman **Sparepart** (bagian 3.5).'],
            ['Bagaimana mengganti langkah booking atau tanya jawab di halaman depan?', 'Teks itu ada di berkas konten web, bukan di menu Outlet. Minta orang yang memegang kode untuk mengubahnya (lihat Panduan Arsitektur dan Teknologi).'],
        ]),
    ],
]

module.exports = (keluar) =>
    simpan({
        keluar,
        judulDokumen: 'Panduan Pemakai Aplikasi Bengkel',
        sampul: sampul({
            label: 'PANDUAN PEMAKAI',
            judul: 'Aplikasi Bengkel',
            subjudul: 'Untuk pemilik, kasir, mekanik, dan pelanggan',
            ringkasan: [
                'Panduan ini menjelaskan cara memakai aplikasi bengkel sehari-hari: menyiapkan bengkel, menerima booking dari website, membuat dan mengerjakan SPK, mencatat sparepart dan pembayaran, mengirim WhatsApp, dan melihat rekap. Bab terakhir menjelaskan halaman yang dilihat pelanggan.',
                'Cara memasang aplikasinya ada di Panduan Menjalankan di Laptop dan Panduan Upload ke VPS.',
            ],
        }),
        bab,
    })
