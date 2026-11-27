// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Aturan paket jualan Aplikasi Bengkel. Satu paket = satu backend + web Next.js + kontrak API +
// migration, ditambah WhatsApp palsu supaya pembeli bisa mencoba di laptop. Semua aturan ditulis
// sebagai data di sini, supaya pengemas (kemas.mjs) dan pemeriksa (periksa.mjs) memakai definisi
// yang sama persis.
//
// Saat ini hanya ada satu paket: bengkel-laravel-web-<versi>.zip. Rancangannya sudah memuat
// varian dan jenis paket, jadi menambah varian Go atau NestJS cukup dengan melengkapi barisnya di
// VARIAN (tersedia: true beserta prasyarat dan perintahnya), dan menambah paket -web-mobile cukup
// dengan menambah baris JENIS dengan mobile: true (lihat README alat ini).

export const VARIAN = {
    go: {
        kode: 'go',
        nama: 'Go',
        folder: 'backend-go',
        port: 8801,
        // Belum ada di repo. Baris ini sudah dibutuhkan sekarang: pemeriksa menolak paket yang
        // menyebut backend lain (nama, folder, dan port), dan menambah varian nanti tidak perlu
        // mengubah aturan pemeriksa.
        tersedia: false,
    },
    laravel: {
        kode: 'laravel',
        nama: 'Laravel',
        folder: 'backend-laravel',
        port: 8802,
        tersedia: true,
        // Berkas yang pasti ada di backend itu; ikut menjadi syarat paket.
        manifes: 'composer.json',
        prasyarat: 'PHP 8.4 (ekstensi pdo_mysql, mbstring, openssl, curl), Composer 2',
        // Menyiapkan folder backend (dependensi dan .env), lalu menyalakannya. Di antara keduanya
        // pembeli mengisi .env dan, bila memakai MySQL tanpa Docker, menjalankan `migrasi`.
        siapkan: ['cd backend-laravel', 'composer install', 'cp .env.example .env'],
        mulai: ['php artisan bengkel:serve'],
        // Perintah migration tanpa Docker; membaca db/migrations yang sama dengan golang-migrate.
        migrasi: 'php artisan bengkel:migrate',
        uji: 'composer test',
    },
    nestjs: {
        kode: 'nestjs',
        nama: 'NestJS',
        folder: 'backend-nestjs',
        port: 8803,
        tersedia: false,
    },
}

export const VARIAN_TERSEDIA = Object.values(VARIAN).filter((v) => v.tersedia)

// Jenis paket. `akhiran` masuk ke nama berkas dan folder akar ZIP dan menyebut isinya, supaya
// pembeli tahu tanpa membuka ZIP: bengkel-laravel-web-1.0.0. Paket lengkap dengan aplikasi staf
// kelak cukup ditambah sebagai { kode: 'lengkap', mobile: true, akhiran: '-web-mobile' }; selama
// belum ada, apa pun di mobile/ ditolak.
export const JENIS = {
    web: { kode: 'web', nama: 'web (backend + web)', mobile: false, akhiran: '-web' },
}

// Port backend yang menjadi alamat bawaan web dan spec di repo (web/.env.example,
// spec/openapi.yaml). Di paket varian lain diganti ke port varian (lib/ubah.mjs).
export const PORT_BAWAAN = VARIAN.laravel.port

// Port dan alamat dev yang harus saling cocok di seluruh paket (lihat periksaKonsistensi).
export const PORT_MYSQL = 3350
export const PORT_WEB = 3800
export const PORT_WA_PALSU = 8890
export const WA_API_URL_DEV = `http://localhost:${PORT_WA_PALSU}/send`
export const DATABASE_URL_DEV = `mysql://bengkel:bengkel@127.0.0.1:${PORT_MYSQL}/bengkel`
export const PUBLIC_WEB_URL_DEV = `http://localhost:${PORT_WEB}`
export const NAMA_DATABASE = 'bengkel'

// Berkas yang SELALU dibuat dari templat/ dan tidak pernah disalin dari repo, karena versi repo
// ditulis untuk pengembang: compose dan skrip pembuat database memuat database tes kontrak,
// README dan panduan menjalankan merujuk ke folder yang tidak dijual, dan .gitignore memuat
// folder backend lain.
export const BERKAS_TEMPLAT = {
    'README.md': 'README.md',
    'docs/menjalankan.md': 'menjalankan.md',
    'docker-compose.yml': 'docker-compose.yml',
    'db/init/01-buat-database.sql': 'buat-database.sql',
    '.gitignore': 'gitignore',
}

// Berkas versi di akar paket. Dibuat pengemas dari versi paket (bukan disalin), supaya isinya
// selalu sama dengan nama ZIP walau versi diberikan lewat --versi.
export const BERKAS_VERSI_PAKET = 'VERSION'

// Akar yang ikut di setiap paket, selain folder backend varian itu sendiri dan berkas templat.
// Dari docs/ hanya docs/panduan (empat panduan Word); rancangan dan catatan eksekusi adalah catatan
// kerja internal. Dari db/ ikut migration, tanpa-docker.sql, dan folder init (berkas pembuat
// databasenya diganti templat).
export const AKAR_MOBILE = 'mobile/'
export const AKAR_BERSAMA = ['web/', 'spec/', 'db/', 'docs/panduan/', 'tests/wa-palsu/', 'LICENSE']

// Folder dan berkas yang tidak boleh ada di paket mana pun. Backend lain dicek terpisah per
// varian. spec/redocly.yaml adalah konfigurasi lint yang hanya jalan dari tests/kontrak, jadi
// tidak berguna tanpa folder itu. .impeccable, .claude, dan .playwright-mcp adalah sisa alat
// bantu pengembang.
export const TERLARANG = [
    'tests/kontrak/',
    'tests/e2e/',
    'alat/',
    'dist/',
    'docs/eksekusi/',
    'docs/rancangan.md',
    'spec/redocly.yaml',
    '.git/',
    '.claude/',
    '.impeccable/',
    '.playwright-mcp/',
]

// Skrip yang hanya berguna bersama tests/kontrak (menyalakan backend lalu menjalankan suite
// kontrak, termasuk versi Nginx + php-cgi untuk tes serentak). Tanpa folder itu skrip ini gagal,
// jadi tidak dikemas dan, bila terbawa, ditolak.
export const POLA_BERKAS_INTERNAL = [{ nama: 'skrip tes kontrak', pola: /^backend-[a-z]+\/scripts\/uji-(?:kontrak|serentak)[^/]*$/ }]

// Segmen path hasil build, cache, atau dependensi di kedalaman mana pun. .gitignore sudah
// menyaringnya; daftar ini pengaman kedua bila suatu saat ada yang terlanjur dilacak git.
export const SEGMEN_TERLARANG = new Set([
    'node_modules',
    'vendor',
    '.next',
    '.next-dev',
    '.bangun',
    'dist',
    'build',
    'coverage',
    'test-results',
    'playwright-report',
    'blob-report',
    '.playwright-mcp',
    '.spec-bundel',
    '.turbo',
    '.cache',
    '.pnpm-store',
    '.phpunit.cache',
    '.git',
    '.claude',
    '.idea',
    '.vscode',
])

// Folder runtime di bawah akar backend: biner hasil build (bin) dan berkas yang diunggah saat
// berjalan (uploads, uploads-uji, ...). Isinya data mesin pengembang, bukan kode. Hanya di bawah
// akar backend, karena "bin" atau "uploads" bisa saja nama paket kode yang sah di tempat lain.
export const POLA_FOLDER_RUNTIME = /^backend-[a-z]+\/(?:bin|uploads[^/]*)\//

// Berkas sisa build atau sistem operasi yang tidak pernah ikut.
export const POLA_BERKAS_SISA = /(?:^|\/)(?:\.DS_Store|Thumbs\.db|\.phpunit\.result\.cache)$|\.(?:log|exe|tsbuildinfo|swp|out|test)$|(?:^|\/)~\$/

// Rujukan yang tidak boleh muncul di berkas teks mana pun di paket, karena menyuruh pembeli
// memakai sesuatu yang sengaja tidak dikemas (tes kontrak, E2E, alat penyusun paket, catatan
// internal). "docs/panduan" dan "tests/wa-palsu" sah dan tidak termasuk. Bila `dokumen` true,
// aturan hanya dicari di berkas dokumentasi dan konfigurasi (lihat berkasDokumen), karena di kode
// sumber string sejenis dapat berupa data contoh biasa.
export const RUJUKAN_TERLARANG = [
    { id: 'tests-kontrak', nama: 'folder tests/kontrak', pola: /tests\/kontrak/ },
    { id: 'tests-e2e', nama: 'folder tests/e2e', pola: /tests\/e2e/ },
    { id: 'rancangan', nama: 'berkas rancangan.md', pola: /rancangan\.md/ },
    { id: 'docs-eksekusi', nama: 'folder docs/eksekusi', pola: /eksekusi\// },
    { id: 'alat', nama: 'folder alat/', pola: /(?:^|[^A-Za-z0-9_./-])alat\// },
    { id: 'perintah-kontrak', nama: 'perintah tes kontrak', pola: /\b(?:cek-harness|lint-spec|bundel-spec)\b|\bBASE_URL=/ },
    { id: 'migrate-uji', nama: 'runner migrate-uji', pola: /migrate-uji/ },
    { id: 'spec-bundel', nama: 'folder .spec-bundel', pola: /\.spec-bundel/ },
    { id: 'skrip-uji', nama: 'skrip uji-kontrak atau uji-serentak', pola: /uji-(?:kontrak|serentak)/ },
    { id: 'db-uji', nama: 'database tes kontrak, E2E, atau review (bengkel_uji, bengkel_e2e, bengkel_review)', pola: /bengkel_(?:uji|e2e|review)/, dokumen: true },
    // Penanda blok internal seharusnya sudah dibuang pengemas; yang tersisa berarti ZIP dibuat tanpa
    // kemas.mjs, atau ditaruh di jenis berkas yang tidak dikenal pengemas.
    { id: 'penanda-kemas', nama: 'penanda blok internal kemas:abaikan yang tidak terbuang', pola: /kemas:abaikan/ },
    // Produk lain milik penjual (acuan pola saat membangun) tidak ada hubungannya dengan pembeli.
    {
        id: 'produk-lain',
        nama: 'rujukan ke produk lain penjual (laundry, toko online, kafe-resto, SIAKAD)',
        pola: /\blaundry\b|toko ?online|tokoonline|kafe-resto|kafe dan resto|\bSIAKAD\b|sistemakademik/i,
    },
    // Sisa catatan kerja ("Status: tahap A", "dibuat di Bagian 0b"): pembeli tidak punya rencana
    // eksekusi itu, dan "tahap A (kerangka)" di README membuat produk tampak belum selesai.
    { id: 'tahap-kerja', nama: 'penanda tahap pengerjaan internal (tahap A/B, Bagian N)', pola: /\btahap [AB]\b|\bBagian [0-9]+[ab]?\b/ },
]

// Berkas dokumentasi dan konfigurasi yang dibaca pembeli. Selain rujukan di atas, di sinilah nama
// backend lain, frasa "ketiga backend", dan kata "tes kontrak" juga dilarang. Komentar di dalam
// kode sumber (.php, .ts, .sql, ...) tidak diperiksa sejauh itu, karena tidak menyuruh pembeli
// melakukan apa pun.
export const berkasDokumen = (path) =>
    /\.(md|ya?ml)$/i.test(path) || ['.env.example', '.gitignore'].includes(path.split('/').pop())

export const POLA_DOKUMEN_TERLARANG = [
    { id: 'frasa-backend', nama: 'frasa tentang beberapa backend', pola: /\b(?:ketiga|tiga|kedua) backend\b/i },
    { id: 'tes-kontrak', nama: 'rujukan ke tes kontrak', pola: /\btes kontrak\b/i },
    { id: 'harness', nama: 'rujukan ke harness tes', pola: /(?<![\w-])harness\b/i },
]

// Nama backend yang bukan milik varian ini, sebagai kata di dokumen. "Go" terlalu umum sebagai
// kata biasa, jadi hanya bentuk yang menyebut backend: "backend Go", "(Go", ", Go", "Go 8801".
export const POLA_NAMA_BACKEND = {
    go: /\b[Bb]ackend Go\b|\bGo (?:8801|dan|atau)\b|[(,] ?Go\b/,
    laravel: /\bLaravel\b/,
    nestjs: /\bNestJS\b/,
}

// Perintah dan jalur khas aplikasi staf. Paket web tidak boleh memuatnya di berkas teks mana pun,
// karena aplikasinya tidak ada di tangan pembeli. Kata "mobile" sebagai bagian kata lain atau
// konsep ("mobile first") sah dan tidak dicari; panduan Word di docs/panduan/ juga tidak diperiksa
// untuk ini (panduan boleh membahas aplikasi HP yang dijual sebagai paket lain).
export const RUJUKAN_MOBILE = [
    { id: 'mobile-cd', nama: 'perintah cd mobile', pola: /\bcd mobile\b/ },
    { id: 'mobile-folder', nama: 'folder mobile/', pola: /(?:^|[^A-Za-z0-9_])mobile\// },
    { id: 'mobile-flutter', nama: 'Flutter', pola: /\bflutter\b/i },
    { id: 'mobile-dart-define', nama: 'dart-define', pola: /dart-define/ },
    { id: 'mobile-emulator-alamat', nama: 'alamat emulator 10.0.2.2', pola: /10\.0\.2\.2/ },
    { id: 'mobile-apk', nama: 'APK', pola: /\bAPK\b/i },
    { id: 'mobile-toko-aplikasi', nama: 'toko aplikasi', pola: /Play Store|App Store/ },
    { id: 'mobile-emulator', nama: 'emulator', pola: /\bemulator\b/i },
]

// README di akar paket boleh menyebut varian lain dengan namanya ("tersedia juga varian Go dan
// NestJS"), karena di sanalah pembeli diberi tahu bahwa ada pilihan lain. Folder, port, dan
// perintahnya tetap dilarang. Hanya id aturan di bawah yang dilonggarkan.
export const README_AKAR = 'README.md'
export const ATURAN_BOLEH_DI_README_AKAR = new Set(['nama-backend-lain', 'frasa-backend'])

// Berkas kunci dependensi berisi ribuan nama paket; tidak dibaca sebagai dokumen.
export const BERKAS_KUNCI = new Set(['package-lock.json', 'composer.lock', 'pnpm-lock.yaml', 'yarn.lock', 'go.sum'])

// Berkas rahasia: env selain contohnya, kunci, dan keystore.
export function berkasRahasia(path) {
    const nama = path.split('/').pop()
    if (nama === '.env.example') return false
    if (nama === '.env' || nama.startsWith('.env.')) return true
    return /\.(pem|key|p12|pfx|jks|keystore)$/i.test(nama)
}

// Pola kunci sungguhan yang punya bentuk khas. Token Fonnte tidak punya awalan khas, jadi nilai
// env di berkas contoh diperiksa terpisah (nilaiRahasiaSah).
export const POLA_RAHASIA = [
    { nama: 'kunci privat', pola: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/ },
    { nama: 'kunci API Google', pola: /AIza[0-9A-Za-z_-]{35}/ },
    { nama: 'token GitHub', pola: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
    { nama: 'kunci AWS', pola: /\bAKIA[0-9A-Z]{16}\b/ },
    { nama: 'token Slack', pola: /\bxox[abprs]-[0-9A-Za-z-]{10,}/ },
    { nama: 'kunci Stripe', pola: /\b[sr]k_live_[0-9A-Za-z]{16,}/ },
]

// URL dengan kredensial ke host sungguhan (domain atau IP publik) hampir pasti kredensial server
// yang terlanjur tertulis. localhost, 127.0.0.1, nama layanan compose, dan host contoh sah.
export const POLA_URL_KREDENSIAL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/'"`<>]+:[^\s@/'"`<>]+@([A-Za-z0-9.-]+)/g
export function hostKredensialSah(host) {
    if (/^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|host|mysql|db)$/i.test(host)) return true
    if (/example|contoh|invalid/i.test(host)) return true
    // TLD cadangan (RFC 2606 dan 6761) dan nama jaringan lokal tidak menunjuk ke server sungguhan.
    if (/\.(?:local|localhost|test|internal|lan)$/i.test(host)) return true
    return !/\.[A-Za-z]{2,}$|^\d+\.\d+\.\d+\.\d+$/.test(host)
}

// Nama env yang berisi rahasia. Di berkas contoh, nilainya harus kosong, ber-placeholder, atau
// jelas-jelas nilai contoh, supaya token Fonnte atau kunci sungguhan tidak ikut terjual karena
// lupa diganti. SETUP_TOKEN lebih ketat lagi: wajib kosong (lihat periksa.mjs).
export const POLA_NAMA_RAHASIA = /^(?:[A-Z][A-Z0-9]*_)*(?:TOKEN|SECRET|KEY|PASSWORD|PASSWD|SANDI)$/
const PENANDA_CONTOH = /(bukan|contoh|uji|palsu|laptop|example|placeholder|dummy)/i
export function nilaiRahasiaSah(nilai) {
    const v = nilai.trim().replace(/^(['"])(.*)\1$/, '$2')
    return v === '' || /^<[^>]+>$/.test(v) || /^\$\{?[A-Za-z_]+\}?$/.test(v) || PENANDA_CONTOH.test(v)
}

// Nama brand toko tempat produk ini dijual. Aplikasinya sendiri netral (nama bengkel diambil dari
// profil outlet). Nama itu hanya boleh muncul di LICENSE, README paket, panduan Word (lihat
// MEREK_BOLEH_DI_PANDUAN), dan sebagai bagian alamat email pemegang hak cipta di header berkas.
export const POLA_MEREK = /kode\s*coding/i
// Panduan Word boleh memuat nama dan logo toko di sampul dan kaki halaman, sama seperti panduan
// laundry dan kafe-resto (keputusan koordinator 2026-11-27). Ubah menjadi false bila suatu saat
// panduan harus netral; tesnya ada di tes/periksa.test.mjs.
export const MEREK_BOLEH_DI_PANDUAN = true
export const EMAIL_HAK_CIPTA = 'idekodecoding@gmail.com'
export const BERKAS_BOLEH_MEREK = new Set(['LICENSE', 'README.md'])

// Situs klien pengguna (AHWS Racing Team) adalah proyek terpisah: teks, nama berkas, dan gambar
// yang berasal dari sana tidak boleh terbawa sama sekali, di berkas mana pun termasuk LICENSE,
// README, dan panduan Word. Pola dicari juga di isi berkas biner (metadata gambar, teks di SVG).
// Di isi berkas, AHWS harus berdiri sebagai kata: tanpa batas itu, hash base64 di package-lock.json
// atau byte acak di gambar sesekali kebetulan memuat empat huruf itu. Nama berkas dicocokkan tanpa
// syarat kata (logoahws.png pun ditolak).
export const POLA_AHWS = /(?<![A-Za-z0-9])ahws(?![A-Za-z0-9])/i
export const POLA_AHWS_NAMA = /ahws/i

// Header hak cipta dua baris di tiap berkas kode (docs/eksekusi/aturan-bersama.md). Penanda
// komentarnya mengikuti bahasa berkas; yang dibandingkan hanya teksnya.
export const TEKS_HEADER = [
    /^Copyright \(c\) \d{4} ariefmanggalaputra <idekodecoding@gmail\.com>\. Hak cipta dilindungi\.$/,
    /^Lisensi: lihat berkas LICENSE\. Dilarang menjual ulang atau membagikan source code ini\.$/,
]

// Berkas yang wajib berheader: kode dan skrip. JSON, lockfile, gambar, SVG, Markdown, dan berkas
// konfigurasi titik (.npmrc, .prettierrc, .gitignore) dikecualikan karena formatnya tidak
// mengenal komentar atau memang bukan kode. artisan tidak berekstensi tetapi berisi kode PHP.
export const EKSTENSI_KODE = new Set(['go', 'php', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'css', 'sql', 'sh', 'yml', 'yaml', 'xml'])
export const NAMA_KODE = new Set(['artisan', '.env.example'])
export const wajibHeader = (path) => {
    const nama = path.split('/').pop()
    if (BERKAS_KUNCI.has(nama)) return false
    return NAMA_KODE.has(nama) || (nama.includes('.') && EKSTENSI_KODE.has(nama.split('.').pop()))
}

// Jalur absolut mesin pengembang tidak ada artinya di laptop pembeli dan membocorkan struktur
// folder penjual.
export const POLA_JALUR_MESIN =
    /\b[A-Za-z]:[\\/]{1,2}(?:KODE_PRODUK|KODE_BELAJAR|POS_IDEORA|Users)\b|(?:^|[^A-Za-z0-9_.-])\/(?:[a-z]\/(?:KODE_PRODUK|KODE_BELAJAR|POS_IDEORA|Users)|Users\/[^/\s]+)\b/i

// Empat panduan Word (dibuat alat/panduan-word); wajib ada di setiap ZIP kecuali dengan
// --tanpa-panduan. Nama berkasnya mengikuti judul panduan, seperti produk laundry.
export const FOLDER_PANDUAN = 'docs/panduan/'
export const PANDUAN_WAJIB = [
    'Panduan-Pemakai-Aplikasi-Bengkel.docx',
    'Panduan-Menjalankan-di-Laptop.docx',
    'Panduan-Upload-ke-VPS.docx',
    'Panduan-Arsitektur-dan-Teknologi.docx',
]

// Berkas sebesar ini di paket hampir pasti salah ikut (biner build, dump database, video). Bila
// suatu saat ada berkas besar yang sah, daftarkan path-nya di BERKAS_BESAR_SAH.
export const MAKS_UKURAN_BERKAS = 5 * 1024 * 1024
export const BERKAS_BESAR_SAH = new Set()

// Batas struktur ZIP yang diterima toko saat admin mengunggah versi produk. Versi mengikuti
// x.y.z, dengan akhiran pra-rilis bila perlu (1.0.0-rc.1). Versi selalu diawali angka, jadi tidak
// pernah diawali "web-" atau "mobile-": itu syarat supaya bengkel-laravel-web-mobile-1.0.0 (kelak)
// selalu terbaca sebagai paket lengkap versi 1.0.0 dan bukan paket web versi "mobile-1.0.0".
export const MAKS_ENTRI = 65_534
export const POLA_VERSI = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/
export const POLA_AWALAN_JENIS = /^(?:web|mobile)-/
export const versiSah = (versi) =>
    typeof versi === 'string' && versi.length <= 30 && POLA_VERSI.test(versi) && !POLA_AWALAN_JENIS.test(versi)

// Berkas versi di akar repo, dibaca bila --versi tidak diberikan. Berisi satu baris x.y.z.
export const BERKAS_VERSI = ['VERSION', 'VERSI']
export const VERSI_BAWAAN = '0.1.0'

export const folderBackendLain = (varian) =>
    Object.values(VARIAN)
        .filter((v) => v.kode !== varian.kode)
        .map((v) => `${v.folder}/`)

export const akarVarian = (varian, jenis = JENIS.web) => [
    `${varian.folder}/`,
    ...AKAR_BERSAMA,
    ...(jenis.mobile ? [AKAR_MOBILE] : []),
]

export const AWALAN_PAKET = 'bengkel'
export const namaPaket = (varian, versi, jenis = JENIS.web) => `${AWALAN_PAKET}-${varian.kode}${jenis.akhiran}-${versi}`

// Kebalikan namaPaket: varian, jenis, dan versi dari nama folder akar ZIP, atau null bila bentuknya
// bukan paket. Akhiran jenis dicocokkan dari yang terpanjang, dan versi selalu diawali angka
// (versiSah), jadi "-web-mobile-" dan "-web-" tidak pernah ambigu.
export function bacaNamaPaket(nama) {
    const awalan = `${AWALAN_PAKET}-`
    if (!nama.startsWith(awalan)) return null
    const sisa = nama.slice(awalan.length)
    const jenisUrut = Object.values(JENIS).sort((a, b) => b.akhiran.length - a.akhiran.length)
    for (const varian of VARIAN_TERSEDIA) {
        for (const jenis of jenisUrut) {
            const depan = `${varian.kode}${jenis.akhiran}-`
            if (!sisa.startsWith(depan)) continue
            const versi = sisa.slice(depan.length)
            if (versiSah(versi)) return { varian, jenis, versi }
        }
    }
    return null
}
