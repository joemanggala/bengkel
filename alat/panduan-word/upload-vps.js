// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Panduan memasang aplikasi di VPS Ubuntu. Isinya disusun dari README backend (bagian "Produksi:
// Nginx + PHP-FPM", "WhatsApp: Fonnte sungguhan", dan "Konfigurasi"), .env.example backend dan
// web, next.config.ts (header keamanan dan HSTS), dan src/server/bff.ts (rute publik yang
// diteruskan ke /api/public/*).
//
// Jalur kode di server memakai tautan tetap: /opt/bengkel/app (isi paket) dan /opt/bengkel/backend
// (folder backend), supaya konfigurasi tidak berubah saat paket diperbarui atau varian lain
// menyusul.
//
// Langkah-langkah ini disusun dari dokumentasi dan konfigurasi yang teruji di laptop. Sebelum
// produk dijual, jalankan sekali ujung ke ujung di VPS baru dan perbaiki bila ada yang meleset.

const { p, h1, h2, h3, titik, langkah, kotak, info, kode, tabel, sampul, simpan } = require('./umum')

// Nama ZIP pada contoh mengikuti berkas VERSION di akar repo, supaya tidak tertinggal saat versi naik.
const VERSI = require('fs').readFileSync(require('path').resolve(__dirname, '..', '..', 'VERSION'), 'utf8').trim()

const NGINX_BATAS = `# Pembatasan laju per alamat IP untuk rute yang bisa dipanggil siapa saja. Pelanggan yang
# memakai Wi-Fi yang sama tampak dari SATU alamat IP, jadi angkanya dibuat longgar.
limit_req_zone $binary_remote_addr zone=bengkel_booking:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=bengkel_publik:10m rate=120r/m;
limit_req_zone $binary_remote_addr zone=bengkel_masuk:10m rate=20r/m;
limit_req_status 429;`

const NGINX_SITUS = `server {
    listen 80;
    listen [::]:80;
    server_name bengkel-kamu.example;

    # Batas badan permintaan yang sama dengan web dan backend (1 MiB).
    client_max_body_size 1m;

    # Header ini wajib: web memeriksa asal permintaan (Host / X-Forwarded-Host) dan menentukan
    # cookie aman dari X-Forwarded-Proto.
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 60s;

    # Membuat dan membatalkan booking dari website (diteruskan web ke /api/public/bookings...):
    # pagar utama terhadap booking iseng.
    location ~ ^/bff/public/bookings(/[A-Za-z0-9_-]+/cancel)?$ {
        limit_req zone=bengkel_booking burst=10 nodelay;
        access_log off;     # alamat pembatalan memuat token booking
        proxy_pass http://127.0.0.1:3800;
    }

    # Semua rute /api/public/* lewat /bff/public/*, ditambah halaman booking dan lacak servis.
    location ~ ^/(bff/public/|booking(/|$)|servis/) {
        limit_req zone=bengkel_publik burst=60 nodelay;
        access_log off;     # alamatnya memuat token booking atau token lacak
        proxy_pass http://127.0.0.1:3800;
    }

    # Masuk dan pemasangan awal (percobaan sandi dibatasi).
    location ~ ^/admin/(masuk|setup)$ {
        limit_req zone=bengkel_masuk burst=10 nodelay;
        proxy_pass http://127.0.0.1:3800;
    }

    location / {
        proxy_pass http://127.0.0.1:3800;
    }
}`

const NGINX_BACKEND = `# Backend Laravel hanya didengarkan di 127.0.0.1 (tidak terbuka ke internet).
server {
    listen 127.0.0.1:8802;
    root /opt/bengkel/backend/public;
    index index.php;
    client_max_body_size 1m;

    # Folder public hanya berisi index.php, jadi semua path diteruskan ke sana.
    location / {
        try_files $uri /index.php?$query_string;
    }
    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
    }
    location ~ /\\.(?!well-known) {
        deny all;
    }
}`

const FPM_POOL = `; Tambahan untuk aplikasi bengkel (lihat README backend, "Produksi: Nginx + PHP-FPM").
php_admin_value[enable_post_data_reading] = 0
php_admin_flag[display_errors] = off
php_admin_flag[log_errors] = on
php_admin_value[error_log] = /var/log/php-fpm/bengkel-error.log
; Log aplikasi ditulis ke stderr; ini meneruskannya ke log PHP-FPM.
catch_workers_output = yes
decorate_workers_output = no`

const bab = [
    [
        h1('1. Gambaran'),
        p('Panduan ini memasang aplikasi bengkel di **VPS Ubuntu** supaya pelanggan bisa membuka website bengkel, booking, dan melacak servis dari HP mereka, dan staf bekerja lewat browser dari mana pun, dengan HTTPS. Panduan menganggap kamu bisa masuk ke server lewat SSH dan menyalin perintah ke terminal; tidak perlu keahlian server.'),
        h2('1.1 Susunan akhir'),
        ...tabel(['Bagian', 'Dijalankan sebagai', 'Dapat dijangkau dari'], [
            ['**Nginx** (HTTPS, pembatasan laju)', 'layanan sistem', 'internet (port 80 dan 443)'],
            ['**Web Next.js**', 'layanan systemd `bengkel-web`, port 3800', 'hanya Nginx di server yang sama'],
            ['**Backend Laravel**', 'PHP-FPM di belakang Nginx, port 8802', 'hanya web di server yang sama'],
            ['**MySQL 8.4**', 'kontainer Docker, port 3306 di 127.0.0.1', 'hanya backend di server yang sama'],
            ['**WhatsApp**', 'penyedia luar (Fonnte)', 'backend memanggil keluar'],
        ], [4, 4, 4]),
        p('Browser hanya berbicara ke Nginx dan web. Backend dan database tidak pernah dibuka ke internet, dan itu sengaja: semua permintaan pelanggan masuk lewat web, yang meneruskannya ke backend dari dalam server.'),
        h2('1.2 Yang perlu disiapkan'),
        ...tabel(['Kebutuhan', 'Keterangan'], [
            ['**VPS Ubuntu 24.04 LTS**', 'Minimal 1 vCPU dan **2 GB RAM** (membangun web butuh ±1,5 GB; bila VPS hanya 1 GB, tambah swap, lihat bagian 3.2). Disk 20 GB cukup.'],
            ['**Nama domain**', 'Misalnya `bengkel-kamu.example`. Buat **A record** yang mengarah ke alamat IP VPS dan tunggu sampai aktif (biasanya beberapa menit).'],
            ['**Paket ZIP**', 'Misalnya `bengkel-laravel-web-' + VERSI + '.zip`. Disalin ke server di bab 4.'],
            ['**Akun penyedia WhatsApp**', 'Fonnte (https://fonnte.com) dengan nomor WhatsApp bengkel. Bisa menyusul setelah aplikasi berjalan.'],
            ['**Laptop dengan terminal**', 'Git Bash di Windows, atau terminal macOS atau Linux, untuk SSH dan menyalin berkas.'],
        ], [4, 8]),
        ...info('Cara membaca perintah', ['Baris yang diawali `#` adalah komentar. Tulisan seperti `bengkel-kamu.example`, `IP-SERVER`, dan `<sandi>` adalah contoh yang harus kamu ganti. Perintah berawalan `sudo` meminta sandi akun server-mu. Salin satu blok, tempel, tekan Enter, dan baca hasilnya sebelum lanjut.']),
        h2('1.3 Urutan pekerjaan'),
        langkah([
            'Mengamankan server dan memasang paket dasar (bab 2 dan 3).',
            'Menyalin paket ke server (bab 4).',
            'Menyalakan MySQL (bab 5).',
            'Memasang backend dengan PHP-FPM dan membuat tabel (bab 6).',
            'Menyalakan web (bab 7).',
            'Memasang Nginx, HTTPS, dan pembatasan laju (bab 8).',
            'Membuat akun pemilik dan menyiapkan bengkel (bab 9).',
            'Menyambungkan WhatsApp sungguhan (bab 10).',
            'Memasang cadangan dan pemeliharaan rutin (bab 11 dan 12).',
        ]),
    ],
    [
        h1('2. Mengamankan Server'),
        p('Masuk ke server sebagai `root` memakai alamat dan sandi atau kunci dari penyedia VPS-mu:'),
        kode('ssh root@IP-SERVER', 'Dari laptop'),
        h2('2.1 Akun kerja dan pembaruan'),
        kode(`apt update && apt upgrade -y
adduser deploy                      # ikuti pertanyaannya, beri sandi yang kuat
usermod -aG sudo deploy
# Salin kunci SSH-mu ke akun baru (bila kamu masuk memakai kunci):
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy`, 'Di server, sebagai root'),
        p('Buka terminal **baru** di laptop dan pastikan akun `deploy` bisa masuk (`ssh deploy@IP-SERVER`) sebelum menutup sesi `root`. Mulai sekarang semua perintah dijalankan sebagai `deploy`, memakai `sudo` bila perlu.'),
        h2('2.2 Firewall'),
        kode(`sudo ufw allow OpenSSH
sudo ufw allow 80/tcp                # HTTP (dipakai juga untuk membuat sertifikat HTTPS)
sudo ufw allow 443/tcp               # HTTPS
sudo ufw enable
sudo ufw status`),
        ...kotak('Docker dan firewall', ['Port yang dibuka oleh Docker **tidak** dihalangi UFW. Karena itu MySQL di panduan ini sengaja dipasang pada `127.0.0.1` saja (bab 5). Jangan mengubahnya menjadi `0.0.0.0` atau menghapus awalan `127.0.0.1:`.']),
        h2('2.3 Pembaruan keamanan otomatis'),
        kode('sudo apt install -y unattended-upgrades\nsudo dpkg-reconfigure -plow unattended-upgrades     # pilih Yes'),
    ],
    [
        h1('3. Memasang Paket Dasar'),
        kode(`sudo apt install -y nginx unzip curl rsync ca-certificates docker.io docker-compose-v2
sudo systemctl enable --now docker nginx
sudo usermod -aG docker deploy      # keluar lalu masuk SSH lagi supaya berlaku`),
        h2('3.1 Node.js'),
        p('Web butuh **Node.js 20.17 ke atas**. Versi dari repositori Ubuntu terlalu lama, jadi pakai NodeSource:'),
        kode(`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version                      # harus v22.x atau lebih baru dari 20.17`),
        h2('3.2 Swap (bila RAM server 1 GB)'),
        p('Lewati langkah ini bila RAM server 2 GB atau lebih.'),
        kode(`sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab`),
        h2('3.3 Akun dan folder aplikasi'),
        p('Web dijalankan dengan akun khusus `bengkel` yang tidak bisa dipakai masuk; backend dijalankan PHP-FPM dengan akun `www-data`. Rahasia (sandi dan token) disimpan di `/etc/bengkel`, terpisah dari kode.'),
        kode(`sudo useradd --system --no-create-home --shell /usr/sbin/nologin bengkel
sudo mkdir -p /opt/bengkel /etc/bengkel /var/backups/bengkel
sudo chown deploy:deploy /opt/bengkel
sudo chown root:root /etc/bengkel && sudo chmod 755 /etc/bengkel`),
        p('Lalu siapkan **tiga nilai acak** yang akan dipakai di langkah berikutnya, dan simpan di pengelola sandi:'),
        kode('openssl rand -hex 16       # jalankan tiga kali: sandi root MySQL, sandi user aplikasi, dan SETUP_TOKEN'),
        ...kotak('Pakai sandi tanpa karakter khusus', ['`openssl rand -hex 16` menghasilkan huruf dan angka saja. Itu disengaja: sandi berisi simbol seperti `@` atau `/` harus ditulis dengan escape URL (misalnya `@` menjadi `%40`) di `DATABASE_URL` dan mudah membuat backend gagal terhubung.']),
    ],
    [
        h1('4. Menyalin Paket ke Server'),
        p('Dari laptop (bukan dari server), salin ZIP-nya. Ganti `NAMA-PAKET.zip` dengan nama berkas yang kamu terima, misalnya `bengkel-laravel-web-' + VERSI + '.zip`:'),
        kode('scp NAMA-PAKET.zip deploy@IP-SERVER:/tmp/', 'Dari laptop'),
        p('Lalu di server:'),
        kode(`cd /tmp
PAKET=$(basename bengkel-*.zip .zip)
unzip -q $PAKET.zip -d /opt/bengkel
ln -sfn /opt/bengkel/$PAKET /opt/bengkel/app                 # tautan tetap ke isi paket
ln -sfn /opt/bengkel/app/backend-* /opt/bengkel/backend      # tautan tetap ke folder backend
ls /opt/bengkel/app /opt/bengkel/backend`, 'Di server'),
        p('Daftar di `/opt/bengkel/app` harus memuat folder `web`, `db`, `spec`, dan `backend-laravel`; `/opt/bengkel/backend` menunjuk ke folder backend itu. Dua tautan ini membuat konfigurasi di bab-bab berikutnya tidak berubah saat paket diperbarui.'),
    ],
    [
        h1('5. MySQL'),
        p('MySQL dijalankan sebagai kontainer Docker, dengan versi (8.4) yang sama dengan yang dipakai saat pengembangan dan pengujian. Datanya disimpan di volume Docker dan **hanya dapat dijangkau dari server itu sendiri**. MySQL 8 yang dipasang langsung dari apt juga bisa, asalkan bukan MariaDB.'),
        p('Buat berkas `/opt/bengkel/docker-compose.yml` (di luar folder paket supaya aman saat paket diperbarui):'),
        kode(`services:
  mysql:
    image: mysql:8.4.10
    restart: unless-stopped
    command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_0900_ai_ci"]
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: bengkel
      MYSQL_USER: bengkel
      MYSQL_PASSWORD: \${MYSQL_PASSWORD}
    ports:
      - "127.0.0.1:3306:3306"          # hanya dari server ini; JANGAN dibuka ke 0.0.0.0
    volumes:
      - mysqldata:/var/lib/mysql
volumes:
  mysqldata:`, '/opt/bengkel/docker-compose.yml'),
        p('Buat berkas `/opt/bengkel/.env` berisi dua sandi dari bab 3, lalu nyalakan:'),
        kode(`cd /opt/bengkel
printf 'MYSQL_ROOT_PASSWORD=<sandi-root>\\nMYSQL_PASSWORD=<sandi-aplikasi>\\n' > .env
chmod 600 .env
docker compose up -d mysql
docker compose ps                    # tunggu sampai mysql "running" (beberapa detik)`),
        p('Tabelnya dibuat di bab 6, oleh perintah migration backend, setelah PHP terpasang.'),
    ],
    [
        h1('6. Backend Laravel dengan PHP-FPM'),
        p('Laravel dijalankan lewat **PHP-FPM** di belakang Nginx, bukan server bawaan PHP yang hanya melayani satu permintaan sekaligus. PHP-FPM melayani banyak permintaan bersamaan, sehingga penguncian nomor SPK, stok terakhir, dan batas booking bekerja seperti seharusnya.'),
        h2('6.1 PHP 8.4'),
        p('Backend butuh **PHP 8.4**, yang belum ada di repositori Ubuntu 24.04, jadi pakai repositori PHP komunitas yang dipakai luas:'),
        kode(`sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:ondrej/php
sudo apt update
sudo apt install -y php8.4-fpm php8.4-cli php8.4-mysql php8.4-mbstring php8.4-curl php8.4-xml php8.4-zip php8.4-opcache composer
php --version                       # harus PHP 8.4.x`),
        h2('6.2 Env backend'),
        p('Buat berkas env backend. Berkas ini berisi rahasia, jadi hanya bisa dibaca root dan akun PHP-FPM:'),
        kode(`sudo tee /etc/bengkel/backend.env > /dev/null <<'EOF'
PORT=8802
DATABASE_URL=mysql://bengkel:<sandi-aplikasi>@127.0.0.1:3306/bengkel
WA_API_URL=https://api.fonnte.com/send
WA_TOKEN=isi-nanti-di-bab-10
PUBLIC_WEB_URL=https://bengkel-kamu.example
SETUP_TOKEN=<hasil openssl rand -hex 16>
EOF
sudo chown root:www-data /etc/bengkel/backend.env && sudo chmod 640 /etc/bengkel/backend.env`),
        ...tabel(['Env', 'Isi'], [
            ['`PORT`', 'Port backend. Di balik PHP-FPM tidak dipakai untuk mendengarkan, tetapi wajib diisi dan disamakan dengan port blok Nginx backend (8802).'],
            ['`DATABASE_URL`', 'Alamat MySQL dari bab 5, dengan sandi aplikasi. Tulis `127.0.0.1`, bukan `localhost`.'],
            ['`WA_API_URL`, `WA_TOKEN`', 'Penyedia WhatsApp. `WA_API_URL` adalah alamat kirim **lengkap dengan path**. `WA_TOKEN` diisi di bab 10; sementara biarkan, pesan WhatsApp baru tercatat gagal.'],
            ['`PUBLIC_WEB_URL`', '**Alamat website yang dibuka pelanggan**, dengan `https://`. Dipakai merangkai tautan di pesan WhatsApp (`/servis/…` untuk lacak servis dan nota, `/booking`). Bila salah, tautan di WhatsApp tidak terbuka.'],
            ['`SETUP_TOKEN`', 'Token sekali pakai untuk membuat pemilik pertama (bab 9), minimal 16 byte. **Dikosongkan lagi sesudah itu.**'],
        ], [3, 9]),
        h2('6.3 Pustaka, izin folder, dan tabel'),
        kode(`cd /opt/bengkel/backend
composer install --no-dev --optimize-autoloader
sudo chown -R www-data:www-data storage bootstrap/cache
sudo ln -sf /etc/bengkel/backend.env /opt/bengkel/backend/.env     # backend membaca env dari .env
sudo -u www-data php artisan bengkel:migrate
# harapannya: "Selesai: 1 migrasi dijalankan, database kini di versi 1."`),
        p('`bengkel:migrate` membaca `db/migrations` di paket dan mencatat versinya di tabel `schema_migrations`, sama seperti runner migration Docker. Hasilnya 16 tabel. Perintah ini aman diulang; bila tidak ada yang baru, ia menjawab bahwa database sudah terbaru.'),
        h2('6.4 Pool PHP-FPM'),
        p('Di pool FPM ada beberapa pengaturan yang **wajib**. Pertama, matikan pembacaan badan permintaan otomatis: backend membaca badan mentah sendiri supaya JSON rusak dinilai persis sesuai kontrak (pengaturan ini tidak bisa dipasang dari kode). Kedua, matikan tampilan galat PHP ke layar: tanpa itu peringatan PHP tercampur di depan badan JSON dan merusak balasan; galatnya tetap dicatat di log. Tambahkan baris ini di akhir `/etc/php/8.4/fpm/pool.d/www.conf`:'),
        kode(FPM_POOL, '/etc/php/8.4/fpm/pool.d/www.conf (tambahkan di akhir)'),
        kode('sudo mkdir -p /var/log/php-fpm && sudo chown www-data:www-data /var/log/php-fpm\nsudo systemctl restart php8.4-fpm'),
        h2('6.5 Nginx untuk backend'),
        p('Buat blok Nginx yang hanya mendengarkan di `127.0.0.1` (backend tidak dibuka ke internet), simpan sebagai `/etc/nginx/sites-available/bengkel-backend`:'),
        kode(NGINX_BACKEND, '/etc/nginx/sites-available/bengkel-backend'),
        kode(`sudo ln -s /etc/nginx/sites-available/bengkel-backend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
cd /opt/bengkel/backend && sudo -u www-data php artisan bengkel:periksa
curl http://127.0.0.1:8802/api/health
# {"status":"ok"}`),
        ...info('Tentang `bengkel:periksa`', ['Perintah ini memeriksa env dan koneksi database, termasuk apakah 16 tabelnya sudah ada, dengan pesan yang menyebut nama env yang bermasalah (tanpa mencetak isinya). Jalankan setiap kali memasang atau mengubah env.']),
        ...kotak('Jangan men-cache konfigurasi Laravel', ['**Jangan** menjalankan `php artisan config:cache` atau `php artisan optimize`. Sesudah konfigurasi di-cache, Laravel berhenti membaca `.env`, sehingga `DATABASE_URL` dan env lain mendadak kosong dan semua permintaan gagal (500). Bila terlanjur, jalankan `php artisan config:clear`.']),
    ],
    [
        h1('7. Menyalakan Web'),
        p('Web (Next.js) dibangun di server lalu dijalankan sebagai layanan systemd. Buat berkas env web dulu:'),
        kode(`sudo tee /etc/bengkel/web.env > /dev/null <<'EOF'
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
API_URL=http://127.0.0.1:8802
COOKIE_SECURE=true
EOF
sudo chown root:bengkel /etc/bengkel/web.env && sudo chmod 640 /etc/bengkel/web.env`),
        ...tabel(['Env', 'Isi'], [
            ['`API_URL`', 'Alamat backend **di server yang sama** (blok Nginx backend di bab 6). Wajib diisi di produksi; hanya dibaca server web.'],
            ['`COOKIE_SECURE`', '`true`: cookie sesi staf hanya dikirim lewat HTTPS.'],
        ], [3, 9]),
        kode(`cd /opt/bengkel/app/web
npm ci
npm run build`, 'Di server (memakan beberapa menit)'),
        p('Buat layanan systemd `/etc/systemd/system/bengkel-web.service`:'),
        kode(`[Unit]
Description=Web aplikasi bengkel (Next.js)
After=network.target php8.4-fpm.service nginx.service

[Service]
User=bengkel
Group=bengkel
WorkingDirectory=/opt/bengkel/app/web
EnvironmentFile=/etc/bengkel/web.env
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start --port 3800 --hostname 127.0.0.1
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target`, '/etc/systemd/system/bengkel-web.service'),
        kode('sudo systemctl daemon-reload\nsudo systemctl enable --now bengkel-web\nsudo systemctl status bengkel-web --no-pager\ncurl -I http://127.0.0.1:3800/admin/masuk        # harapannya HTTP 200'),
    ],
    [
        h1('8. Nginx, HTTPS, dan Pembatasan Laju'),
        p('Nginx menjadi satu-satunya pintu masuk dari internet. Selain meneruskan ke web, Nginx **memasang pembatasan laju per alamat IP** untuk rute yang bisa dipanggil siapa saja. Ini wajib sebelum dibuka ke publik: form booking bisa diisi siapa pun, dan aplikasi sendiri tidak menyimpan catatan per alamat IP (backend hanya melihat satu alamat, yaitu server web). Pagar lainnya adalah batas tiga booking menunggu per nomor HP dan penerimaan oleh staf.'),
        h2('8.1 Rute publik yang dibatasi'),
        p('Semua rute API publik backend (`/api/public/*`: daftar jasa, membuat booking, status dan pembatalan booking, dan lacak servis) dipanggil browser lewat web di alamat `/bff/public/*`; web meneruskannya ke `/api/public/*` di backend. Backend sendiri tidak terjangkau dari internet. Karena itu pembatasan laju untuk `/api/public/*` dipasang di Nginx depan, pada `/bff/public/*`, ditambah halaman yang memakainya:'),
        ...tabel(['Alamat di web', 'Diteruskan ke backend', 'Zona'], [
            ['`POST /bff/public/bookings`', '`POST /api/public/bookings` (membuat booking)', '`bengkel_booking`'],
            ['`POST /bff/public/bookings/{token}/cancel`', '`POST /api/public/bookings/{token}/cancel`', '`bengkel_booking`'],
            ['`/bff/public/services`, `/bff/public/bookings/{token}`, `/bff/public/work-orders/{token}`', '`GET /api/public/…` (jasa, status booking, lacak servis)', '`bengkel_publik`'],
            ['`/booking`, `/booking/{token}`, `/servis/{token}`', 'halaman booking, status booking, dan lacak servis', '`bengkel_publik`'],
            ['`/admin/masuk`, `/admin/setup`', 'masuk staf dan pemasangan awal', '`bengkel_masuk`'],
        ], [5, 5, 2]),
        h2('8.2 Konfigurasi'),
        p('Pertama, zona pembatasan (berlaku untuk seluruh Nginx), simpan sebagai `/etc/nginx/conf.d/bengkel-batas.conf`:'),
        kode(NGINX_BATAS, '/etc/nginx/conf.d/bengkel-batas.conf'),
        p('Lalu situsnya, simpan sebagai `/etc/nginx/sites-available/bengkel`. Ganti `bengkel-kamu.example` dengan domainmu:'),
        kode(NGINX_SITUS, '/etc/nginx/sites-available/bengkel'),
        kode(`sudo ln -s /etc/nginx/sites-available/bengkel /etc/nginx/sites-enabled/bengkel
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
curl -I http://bengkel-kamu.example/admin/masuk          # harapannya HTTP 200`),
        ...tabel(['Bagian konfigurasi', 'Gunanya'], [
            ['`Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`', 'Web memeriksa bahwa permintaan berasal dari alamatnya sendiri (perlindungan CSRF) dan menentukan cookie aman dari protokol. Tanpa header ini login gagal di balik HTTPS.'],
            ['`bengkel_booking` (10 per menit per IP, lonjakan 10)', 'Membuat dan membatalkan booking. Di atas batas, Nginx membalas 429.'],
            ['`bengkel_publik` (120 per menit, lonjakan 60)', 'Halaman booking dan lacak servis beserta API publiknya. Halaman lacak memuat ulang sendiri setiap 30 detik, jadi angkanya longgar.'],
            ['`bengkel_masuk` (20 per menit, lonjakan 10)', 'Halaman masuk dan pemasangan awal; membatasi tebakan sandi. Backend juga mengunci satu email 15 menit sesudah 10 kali gagal masuk, tetapi batas per alamat IP ini tetap perlu supaya penebak tidak bisa mencoba banyak email sekaligus.'],
            ['`access_log off` pada rute publik', 'Alamat status booking, pembatalan, dan lacak servis memuat token rahasia, jadi tidak boleh tercatat di log akses Nginx. Backend sendiri hanya mencatat pola rute, bukan tokennya. Permintaan yang ditolak 429 tetap dicatat di log galat Nginx beserta alamatnya; batasi siapa yang bisa membaca `/var/log/nginx`.'],
            ['`client_max_body_size 1m`', 'Batas badan permintaan yang sama dengan backend dan web.'],
        ], [5, 7]),
        h2('8.3 Sertifikat HTTPS gratis (certbot)'),
        kode(`sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bengkel-kamu.example   # pilih: alihkan HTTP ke HTTPS
sudo certbot renew --dry-run                   # pastikan pembaruan otomatis berjalan`),
        p('Certbot menambahkan HTTPS ke konfigurasi situs (blok `location` dan pembatasan lajunya ikut terpakai) dan memperbarui sertifikat otomatis sebelum habis. Buka `https://bengkel-kamu.example/admin/masuk` di browser; gembok harus tampil.'),
        ...kotak('Tanpa HTTPS, login tidak bisa', ['`COOKIE_SECURE=true` membuat browser hanya menyimpan cookie sesi lewat HTTPS. Bila kamu membuka aplikasi lewat `http://` setelah mengaktifkannya, halaman masuk memberi peringatan bahwa browser tidak menyimpan sesi. Selalu buka lewat `https://`.']),
        ...info('Setelah HTTPS stabil', ['Web sudah mengirim header keamanan (larangan dibingkai situs lain, `nosniff`, dan referrer hanya ke situs sendiri), kecuali HSTS. Opsional, tambahkan HSTS agar browser selalu memakai HTTPS: di blok `server` HTTPS yang dibuat certbot, tambahkan `add_header Strict-Transport-Security "max-age=31536000" always;`. Lakukan hanya setelah yakin HTTPS berjalan baik, karena sulit dibatalkan.']),
        ...info('Bila suatu saat API dibuka langsung', ['Panduan ini tidak membuka backend ke internet. Bila kelak kamu membuat situs Nginx terpisah untuk backend (misalnya untuk aplikasi lain), pasang juga `limit_req zone=bengkel_publik` pada `location /api/public/` dan `limit_req zone=bengkel_masuk` pada `location = /api/staff/login` di situs itu.']),
    ],
    [
        h1('9. Akun Pemilik dan Penyiapan Bengkel'),
        h2('9.1 Membuat pemilik pertama'),
        langkah([
            'Pastikan `SETUP_TOKEN` di `/etc/bengkel/backend.env` sudah terisi (bab 6).',
            'Buka `https://bengkel-kamu.example/admin`. Kamu dibawa ke halaman **Pemasangan awal**.',
            'Isi token pemasangan (sama persis dengan `SETUP_TOKEN`), nama, email, dan kata sandi pemilik yang kuat. Klik **Buat akun pemilik**.',
        ]),
        h2('9.2 Mematikan pemasangan awal'),
        p('Segera setelah akun pemilik dibuat, **kosongkan** `SETUP_TOKEN` supaya tidak ada yang bisa membuat akun lain lewat jalur itu, lalu muat ulang PHP-FPM:'),
        kode('sudo sed -i "s/^SETUP_TOKEN=.*/SETUP_TOKEN=/" /etc/bengkel/backend.env\nsudo systemctl reload php8.4-fpm\ncd /opt/bengkel/backend && sudo -u www-data php artisan bengkel:periksa'),
        h2('9.3 Menyiapkan bengkel'),
        p('Dari sini semuanya dikerjakan lewat web, tanpa menyentuh server lagi. Ikuti **Panduan Pemakai**: isi **Outlet** (nama bengkel, alamat, nomor WhatsApp, jam buka, tautan peta, kaki nota), buat **Jasa** (tandai yang tampil di website), **Sparepart** beserta harga beli dan stok awal, lalu akun **Kasir** dan **Mekanik** di menu **Staf**. Buka halaman depan `https://bengkel-kamu.example` dari HP untuk memastikan profil dan daftar jasanya benar.'),
    ],
    [
        h1('10. WhatsApp Sungguhan (Fonnte)'),
        p('Backend mengirim pesan booking dikonfirmasi dan ditolak, SPK dibuat (dengan tautan lacak), siap diambil, dan nota lewat API berbentuk Fonnte. Tanpa pengaturan ini aplikasi tetap berjalan normal; hanya pesan WhatsApp yang tercatat gagal (dan kasir bisa mengirim ulang pesan SPK setelah pengaturannya benar).'),
        langkah([
            'Daftar di https://fonnte.com dan tambahkan perangkat: sambungkan nomor WhatsApp bengkel dengan memindai kode QR di dashboard Fonnte.',
            'Salin **token perangkat** dari dashboard.',
            'Edit `/etc/bengkel/backend.env`: isi `WA_TOKEN` dengan token itu (tanpa awalan `Bearer`) dan pastikan `WA_API_URL=https://api.fonnte.com/send`. Pastikan juga `PUBLIC_WEB_URL` adalah alamat `https://` websitemu.',
            'Muat ulang PHP-FPM dan periksa: `sudo systemctl reload php8.4-fpm`, lalu `cd /opt/bengkel/backend && sudo -u www-data php artisan bengkel:periksa`.',
            'Uji: sebagai kasir, buat SPK untuk pelanggan dengan **nomor HP-mu sendiri**. Pesan "SPK dibuat" harus masuk ke WhatsApp-mu, dan kartu **WhatsApp dan tautan lacak** di rincian SPK menunjukkan **Terkirim**. Buka tautan di pesan itu dari HP (pakai data seluler): halaman lacak servis harus terbuka.',
        ]),
        ...kotak('Rahasia', ['Token Fonnte hanya ditulis di `/etc/bengkel/backend.env`. Jangan menaruhnya di berkas paket, repo Git, atau tangkapan layar yang kamu bagikan. Backend menyamarkan token bila sempat muncul di alasan gagal.']),
        p('Backend menganggap pesan terkirim hanya bila Fonnte membalas sukses (Fonnte membalas kegagalan dengan HTTP 200 dan `"status": false`). Bila pesan tidak masuk, lihat riwayat pengiriman:'),
        kode(`cd /opt/bengkel
docker compose exec mysql sh -c 'mysql -ubengkel -p"$MYSQL_PASSWORD" bengkel -e "SELECT type, status, failure_reason, created_at FROM wa_messages ORDER BY created_at DESC LIMIT 5"'`),
        p('Kolom `failure_reason` menjelaskan penyebabnya (token tidak valid, nomor tujuan salah, kuota habis, dan sebagainya). Log pengiriman juga ada di dashboard Fonnte. Pesan booking yang gagal tidak punya tombol kirim ulang; staf menghubungi pelanggan sendiri.'),
    ],
    [
        h1('11. Cadangan'),
        p('Yang harus dicadangkan hanya **database**: aplikasi ini tidak menyimpan berkas unggahan. Kode tidak perlu karena selalu bisa dipasang ulang dari paket, dan env cukup disalin sekali ke pengelola sandi.'),
        h2('11.1 Cadangan harian otomatis'),
        p('Buat skrip `/usr/local/bin/bengkel-cadangan`:'),
        kode(`#!/bin/sh
# Cadangan harian database bengkel. Simpan 14 hari terakhir.
set -eu
TUJUAN=/var/backups/bengkel
TANGGAL=$(date +%F)
cd /opt/bengkel
docker compose exec -T mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --no-tablespaces bengkel' | gzip > "$TUJUAN/bengkel-$TANGGAL.sql.gz"
find "$TUJUAN" -type f -mtime +14 -delete`, '/usr/local/bin/bengkel-cadangan'),
        kode(`sudo chmod +x /usr/local/bin/bengkel-cadangan
sudo /usr/local/bin/bengkel-cadangan && ls -lh /var/backups/bengkel
echo '30 2 * * * root /usr/local/bin/bengkel-cadangan' | sudo tee /etc/cron.d/bengkel-cadangan`),
        p('`--single-transaction` membuat salinan yang utuh tanpa menghentikan aplikasi, jadi kasir tetap bisa bekerja saat cadangan berjalan.'),
        h2('11.2 Salinan di luar server'),
        ...kotak('Cadangan yang hanya ada di server bukan cadangan', ['Bila server rusak atau dihapus, cadangan di dalamnya ikut hilang. Salin `/var/backups/bengkel` secara berkala ke tempat lain: laptopmu (`scp` atau `rsync`), penyimpanan cloud, atau fitur snapshot dari penyedia VPS. Lakukan setidaknya seminggu sekali.']),
        h2('11.3 Mengembalikan dari cadangan'),
        p('Latih sekali sebelum benar-benar butuh. Misalnya di server baru, setelah langkah bab 3 sampai 6 (tanpa menjalankan `bengkel:migrate`, karena skema ikut dalam cadangan):'),
        kode(`cd /opt/bengkel
gunzip -c /var/backups/bengkel/bengkel-TANGGAL.sql.gz | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" bengkel'
cd /opt/bengkel/backend && sudo -u www-data php artisan bengkel:migrate versi    # versi database sesudah dipulihkan`),
    ],
    [
        h1('12. Pemeliharaan'),
        h2('12.1 Memeriksa kesehatan'),
        ...tabel(['Yang diperiksa', 'Perintah'], [
            ['Layanan berjalan', '`systemctl status php8.4-fpm bengkel-web nginx`'],
            ['Log backend', '`sudo tail -n 100 /var/log/php8.4-fpm.log` dan `sudo tail -n 100 /var/log/php-fpm/bengkel-error.log`'],
            ['Log web', '`journalctl -u bengkel-web -n 100 --no-pager`'],
            ['MySQL', '`cd /opt/bengkel && docker compose ps` dan `docker compose logs --tail 50 mysql`'],
            ['Backend sehat', '`curl http://127.0.0.1:8802/api/health` membalas `{"status":"ok"}`'],
            ['Env backend', '`cd /opt/bengkel/backend && sudo -u www-data php artisan bengkel:periksa`'],
            ['Sertifikat', '`sudo certbot certificates`'],
            ['Ruang disk', '`df -h` dan `du -sh /var/backups/bengkel`'],
        ], [4, 8]),
        p('Pasang pemantau luar yang gratis (misalnya UptimeRobot) yang memeriksa `https://bengkel-kamu.example/admin/masuk` tiap beberapa menit dan mengirim email bila tidak membalas.'),
        h2('12.2 Pembersihan berkala'),
        p('Beberapa tabel membesar pelan-pelan dan boleh dibersihkan, misalnya sebulan sekali: sesi login yang sudah kedaluwarsa, catatan percobaan masuk yang lama, dan riwayat pesan WhatsApp lama.'),
        kode(`cd /opt/bengkel
docker compose exec mysql sh -c 'mysql -ubengkel -p"$MYSQL_PASSWORD" bengkel -e "
  DELETE FROM staff_sessions WHERE expires_at < UTC_TIMESTAMP(3);
  DELETE FROM login_attempts WHERE window_start < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)
    AND (locked_until IS NULL OR locked_until < UTC_TIMESTAMP(3));
  DELETE FROM wa_messages WHERE created_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 365 DAY);"'`),
        p('Pesan WhatsApp yang dihapus membuat SPK lama menampilkan "Belum dikirim" di kartu WhatsApp; karena itu batasnya dibuat setahun.'),
        ...info('Kartu stok, SPK, dan pembayaran jangan dibersihkan', ['Tabel `stock_movements` (kartu stok), SPK, linimasa, dan pembayaran adalah catatan usaha. Jumlah semua baris kartu stok sebuah sparepart adalah bukti stoknya, dan riwayat servis kendaraan dibaca dari SPK lama. Ukurannya kecil untuk satu bengkel; cukup ikut dalam cadangan.']),
        h2('12.3 Memperbarui aplikasi'),
        langkah([
            'Salin ZIP versi baru ke server dan ekstrak ke `/opt/bengkel` (bab 4). Jangan menimpa folder versi lama; folder baru punya nama berbeda.',
            'Cadangkan dulu: `sudo /usr/local/bin/bengkel-cadangan`.',
            'Arahkan tautan ke versi baru: `ln -sfn /opt/bengkel/NAMA-PAKET-BARU /opt/bengkel/app` dan `ln -sfn /opt/bengkel/app/backend-* /opt/bengkel/backend`.',
            'Pasang backend versi baru (bab 6.3): `composer install --no-dev --optimize-autoloader`, izin `storage` dan `bootstrap/cache`, tautan `.env`, lalu `sudo -u www-data php artisan bengkel:migrate` untuk migration baru bila ada.',
            'Bangun web versi baru: `npm ci && npm run build` di `/opt/bengkel/app/web`.',
            'Nyalakan ulang: `sudo systemctl reload php8.4-fpm && sudo systemctl restart bengkel-web`.',
        ]),
        p('Berkas env di `/etc/bengkel` dan data di MySQL tidak ikut berubah, jadi pengaturanmu tetap aman. Bila versi baru bermasalah, arahkan tautan kembali ke folder versi lama dan nyalakan ulang (database tidak perlu dikembalikan bila versi baru tidak membawa migration).'),
        h2('12.4 Booking yang terlupa'),
        p('Booking yang tidak dikonfirmasi atau ditolak tidak kedaluwarsa sendiri. Biasakan kasir membuka tab **Menunggu** di menu **Booking** beberapa kali sehari. Satu nomor HP paling banyak punya tiga booking yang menunggu, jadi booking yang dibiarkan juga menghalangi pelanggan itu booking lagi.'),
    ],
    [
        h1('13. Daftar Periksa Sebelum Dibuka ke Publik'),
        ...tabel(['Sudah?', 'Hal yang harus dipastikan'], [
            ['☐', 'Domain mengarah ke server dan `https://` terbuka dengan gembok (bab 8).'],
            ['☐', 'Port 3306, 3800, dan 8802 **tidak** terjangkau dari luar: hanya 22, 80, dan 443. Cek dengan `sudo ss -tlnp` (ketiganya harus di `127.0.0.1`) dan `sudo ufw status`.'],
            ['☐', '`SETUP_TOKEN` sudah dikosongkan dan PHP-FPM dimuat ulang (bab 9.2).'],
            ['☐', 'Pembatasan laju Nginx aktif: dari laptop, kirim `curl -X POST https://bengkel-kamu.example/bff/public/bookings` lebih dari 20 kali berturut-turut; balasan akhirnya 429.'],
            ['☐', 'Log akses Nginx tidak memuat alamat `/booking/…`, `/servis/…`, atau `/bff/public/…` (`sudo tail /var/log/nginx/access.log`).'],
            ['☐', '`PUBLIC_WEB_URL` adalah alamat `https://` website, dan tautan di pesan WhatsApp terbuka dari HP lewat data seluler (bab 10).'],
            ['☐', 'WhatsApp sungguhan diuji: pesan SPK dibuat, siap diambil, dan nota masuk; konfirmasi booking juga.'],
            ['☐', 'Satu booking dari HP pelanggan berhasil dibuat, dikonfirmasi, dan dijadikan SPK.'],
            ['☐', 'Sandi pemilik kuat dan tersimpan di pengelola sandi.'],
            ['☐', 'Cadangan harian berjalan, dan **pemulihannya sudah dicoba** (bab 11).'],
            ['☐', 'Pemantau luar sudah dipasang dan mengirim email uji.'],
            ['☐', 'Nama bengkel, alamat, nomor WhatsApp, jam buka, dan kaki nota sudah diisi di menu **Outlet**; jasa dan harga di halaman depan sudah benar.'],
        ], [1, 10]),
    ],
    [
        h1('14. Memecahkan Masalah'),
        ...tabel(['Gejala', 'Penyebab dan cara memperbaiki'], [
            ['Browser: 502 Bad Gateway', 'Web belum menyala atau mati: `systemctl status bengkel-web` dan `journalctl -u bengkel-web -n 50`. Pastikan `curl -I http://127.0.0.1:3800/admin/masuk` membalas 200.'],
            ['Web terbuka, tetapi "Server belum bisa dihubungi"', 'Backend tidak menjawab di `API_URL`. Cek `curl http://127.0.0.1:8802/api/health`; bila gagal, periksa blok Nginx backend (`sudo nginx -t`) dan `systemctl status php8.4-fpm`. Setelah memperbaiki `/etc/bengkel/web.env`, `sudo systemctl restart bengkel-web`.'],
            ['Backend membalas 500 di semua rute', 'Jalankan `cd /opt/bengkel/backend && sudo -u www-data php artisan bengkel:periksa`: pesannya menyebut env yang kosong atau salah, atau database yang tidak bisa dihubungi. Penyebab lain: konfigurasi ter-cache (`php artisan config:clear`), atau `.env` tidak terbaca `www-data` (cek pemilik `/etc/bengkel/backend.env`).'],
            ['`bengkel:periksa`: "database tidak bisa dihubungi atau ditolak (galat 1045)"', '1045 sandi salah, 2002 MySQL mati (`docker compose ps`), 1044 atau 1049 database atau hak akses salah. Pakai sandi hex tanpa simbol.'],
            ['Backend: "baru punya N dari 16 tabel"', 'Migration belum dijalankan: `sudo -u www-data php artisan bengkel:migrate`.'],
            ['Balasan JSON kadang diawali teks peringatan PHP, atau JSON rusak dinilai aneh', 'Baris pool FPM di bab 6.4 belum ada, atau PHP-FPM belum dinyalakan ulang.'],
            ['Masuk ditolak: "Terlalu banyak percobaan masuk"', 'Email itu sudah 10 kali berturut-turut gagal masuk dan dikunci 15 menit oleh backend. Tunggu, lalu masuk dengan sandi yang benar. Bila terjadi tanpa sebab yang jelas, mungkin ada yang mencoba menebak sandi; periksa log Nginx.'],
            ['Login berhasil tetapi langsung kembali ke halaman masuk', 'Cookie tidak tersimpan: aplikasi dibuka lewat `http://`, atau Nginx tidak meneruskan `X-Forwarded-Proto` dan `X-Forwarded-Host`. Periksa blok situs di bab 8.'],
            ['Pelanggan melihat "Terlalu banyak permintaan" (429)', 'Pembatasan laju Nginx terpicu. Bila terjadi pada pelanggan wajar (misalnya banyak orang di satu Wi-Fi), naikkan `rate` atau `burst` di `bengkel-batas.conf` dan situs, lalu `sudo nginx -t && sudo systemctl reload nginx`.'],
            ['Tautan di pesan WhatsApp mengarah ke alamat yang salah', '`PUBLIC_WEB_URL` di `/etc/bengkel/backend.env` salah. Perbaiki, muat ulang PHP-FPM, lalu kirim ulang pesan dari kartu WhatsApp di rincian SPK.'],
            ['Pesan WhatsApp tidak terkirim', 'Lihat tabel `wa_messages` (bab 10): `failure_reason` menyebut penyebabnya. Periksa `WA_TOKEN`, status perangkat di dashboard Fonnte, dan kuota.'],
            ['Sertifikat HTTPS gagal dibuat', 'Domain belum mengarah ke server (cek A record), atau port 80 tertutup. Jalankan ulang `sudo certbot --nginx -d bengkel-kamu.example` setelah diperbaiki.'],
            ['Build web gagal kehabisan memori', 'Tambah swap (bab 3.2) atau naikkan RAM server, lalu ulangi `npm run build`.'],
        ], [5, 7]),
    ],
]

module.exports = (keluar) =>
    simpan({
        keluar,
        judulDokumen: 'Panduan Upload ke VPS',
        sampul: sampul({
            label: 'PANDUAN UPLOAD KE VPS',
            judul: 'Memasang di Server',
            subjudul: 'Ubuntu, MySQL, PHP-FPM, Nginx + HTTPS, WhatsApp, dan cadangan',
            ringkasan: [
                'Panduan ini memasang aplikasi bengkel di VPS Ubuntu langkah demi langkah: mengamankan server, menyalakan MySQL, backend Laravel dengan PHP-FPM, dan web Next.js, memasang Nginx dengan HTTPS dan pembatasan laju untuk rute publik, menyambungkan WhatsApp sungguhan, serta cadangan dan pemeliharaan.',
                'Cara mencoba aplikasi di laptop dijelaskan di Panduan Menjalankan di Laptop; cara memakainya sehari-hari ada di Panduan Pemakai.',
            ],
        }),
        bab,
    })
// Diekspor supaya sintaks konfigurasi Nginx di panduan bisa diuji dengan `nginx -t` (lihat README).
module.exports.nginx = { NGINX_BATAS, NGINX_SITUS, NGINX_BACKEND }
