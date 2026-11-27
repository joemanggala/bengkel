-- Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
-- Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

-- Skema awal aplikasi bengkel (MySQL 8.4, InnoDB, utf8mb4). Semua backend (Laravel lebih dulu,
-- Go dan NestJS menyusul) membaca skema yang sama persis dari berkas ini, jadi aturan penting
-- juga dijaga di sini lewat CHECK, UNIQUE, dan FOREIGN KEY: bila satu backend lupa
-- memvalidasi, database tetap menolak data yang tidak konsisten.
--
-- Aturan bersama (sama dengan laundry dan kafe-resto):
-- * ID berupa CHAR(36) berisi UUID huruf kecil yang dibuat aplikasi. MySQL tidak punya
--   RETURNING, jadi aplikasi membuat ID lebih dulu lalu memakainya lagi tanpa membaca ulang.
-- * Kolom ID, hash, token, email, nomor HP, plat, nomor SPK/booking, SKU, dan kolom bernilai
--   tetap (peran, status, jenis, metode) memakai ascii_bin: perbandingannya biner, sehingga
--   "abc" tidak pernah dianggap sama dengan "ABC". Teks bebas (nama, alamat, catatan) tetap
--   utf8mb4_0900_ai_ci supaya pencarian tidak peka huruf besar/kecil dan aksen.
-- * Waktu berupa DATETIME(3) dan selalu UTC. Backend menulis dan membandingkan waktu memakai
--   jam aplikasi dalam UTC, dengan milidetik. UTC_TIMESTAMP(3) hanya nilai bawaan kolom.
--   Tanggal datang booking berupa DATE WIB apa adanya.
-- * Uang berupa BIGINT rupiah bulat. Stok berupa BIGINT bulat dalam satuan jual sparepart.
-- * CHECK yang memakai kolom NULL dibungkus "IS NULL"/"IS NOT NULL": CHECK MySQL lolos bila
--   hasilnya NULL, jadi perbandingan biasa dengan kolom NULL tidak menolak apa pun.

CREATE TABLE staff (
    staff_id      CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name          VARCHAR(100) NOT NULL,
    -- Hanya ASCII: aturan huruf kecil (A-Z saja) dan perbandingan biner jadi sama persis di
    -- ketiga bahasa.
    email         VARCHAR(254) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- owner = pemilik, cashier = kasir, mechanic = mekanik.
    role          VARCHAR(10)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Staf tidak pernah dihapus, karena SPK, pembayaran, kartu stok, dan linimasa menunjuk ke
    -- sini. Staf yang berhenti cukup dinonaktifkan; mekanik nonaktif tetap tertera di SPK lama.
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at    DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (staff_id),
    UNIQUE KEY staff_email_key (email),
    -- Dipakai daftar mekanik aktif untuk penugasan.
    KEY staff_role_idx (role, is_active),
    CONSTRAINT staff_email_huruf_kecil CHECK (email = LOWER(email)),
    CONSTRAINT staff_role_check CHECK (role IN ('owner', 'cashier', 'mechanic')),
    -- Hash bcrypt dari Go ($2a$), Node ($2b$), dan PHP ($2y$) harus bisa dibaca bergantian.
    CONSTRAINT staff_password_hash_bcrypt CHECK (LEFT(password_hash, 4) IN ('$2a$', '$2b$', '$2y$'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE staff_sessions (
    staff_session_id CHAR(36)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    staff_id         CHAR(36)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Yang disimpan hanya hex SHA-256 dari token. Bila isi tabel bocor, token aslinya tetap
    -- tidak bisa dipakai untuk masuk.
    token_hash       CHAR(64)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at       DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    expires_at       DATETIME(3) NOT NULL,
    last_used_at     DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (staff_session_id),
    UNIQUE KEY staff_sessions_token_hash_key (token_hash),
    KEY staff_sessions_staff_idx (staff_id),
    CONSTRAINT staff_sessions_staff_fk FOREIGN KEY (staff_id) REFERENCES staff (staff_id) ON DELETE CASCADE,
    CONSTRAINT staff_sessions_token_hash_hex CHECK (REGEXP_LIKE(token_hash, '^[0-9a-f]{64}$', 'c'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Pembatas percobaan masuk: satu email boleh dicoba 10 kali berturut-turut, yang ke-11
-- dijawab 429 dan emailnya dikunci 15 menit. Hanya dipakai backend yang berjalan sebagai banyak
-- proses yang tidak berbagi memori (PHP-FPM, jadi backend Laravel); backend satu proses boleh
-- menyimpan hitungannya di memori. Tabelnya tetap dibuat supaya skema database sama.
CREATE TABLE login_attempts (
    -- SHA-256 (hex) dari email yang dicoba: panjangnya tetap dan email penebak tidak tersimpan.
    key_hash     CHAR(64)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    attempts     INT         NOT NULL,
    -- Percobaan pertama dalam hitungan ini. Hitungan baru dimulai bila sudah lewat 15 menit.
    window_start DATETIME(3) NOT NULL,
    -- Terisi sejak percobaan ke-10 sampai kunci berakhir.
    locked_until DATETIME(3) NULL,
    PRIMARY KEY (key_hash),
    KEY login_attempts_window_start_idx (window_start),
    CONSTRAINT login_attempts_key_hex CHECK (REGEXP_LIKE(key_hash, '^[0-9a-f]{64}$', 'c')),
    CONSTRAINT login_attempts_positif CHECK (attempts >= 1)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Profil outlet: tepat satu baris (aplikasi ini untuk satu bengkel). Nama dan kontak diambil
-- dari sini, bukan ditulis di kode, supaya pembeli langsung memakai identitasnya sendiri. Baris
-- ini juga dipakai sebagai mutex (SELECT ... FOR UPDATE) untuk pemasangan awal dan perubahan
-- staf.
CREATE TABLE outlet (
    outlet_id      TINYINT UNSIGNED NOT NULL DEFAULT 1,
    name           VARCHAR(100) NOT NULL,
    tagline        VARCHAR(200) NOT NULL DEFAULT '',
    address        VARCHAR(500) NOT NULL DEFAULT '',
    -- Nomor WhatsApp outlet (628…), atau NULL bila belum diisi.
    phone          VARCHAR(15)  CHARACTER SET ascii COLLATE ascii_bin NULL,
    opening_hours  VARCHAR(200) NOT NULL DEFAULT '',
    -- Tautan peta (Google Maps dan sejenisnya), atau string kosong.
    maps_url       VARCHAR(500) NOT NULL DEFAULT '',
    receipt_footer VARCHAR(500) NOT NULL DEFAULT '',
    updated_at     DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (outlet_id),
    CONSTRAINT outlet_satu_baris CHECK (outlet_id = 1),
    CONSTRAINT outlet_nama_tidak_kosong CHECK (CHAR_LENGTH(name) >= 2),
    CONSTRAINT outlet_phone_format CHECK (phone IS NULL OR REGEXP_LIKE(phone, '^628[0-9]{7,12}$', 'c')),
    -- Hanya http/https, supaya tautan "javascript:" tidak pernah sampai ke website.
    CONSTRAINT outlet_maps_url_format CHECK (maps_url = '' OR REGEXP_LIKE(maps_url, '^https?://[^[:space:]]+$', 'c'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

INSERT INTO outlet (outlet_id, name) VALUES (1, 'Nama Bengkel');

-- Pelanggan. Tanpa akun dan tanpa sandi: hanya data yang dicatat kasir, atau dibuat otomatis
-- saat booking dijadikan SPK. Nomor HP (bentuk seragam 628…) unik.
CREATE TABLE customers (
    customer_id CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(15)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    address     VARCHAR(500) NOT NULL DEFAULT '',
    -- Catatan internal kasir; tidak pernah tampil di halaman publik.
    notes       VARCHAR(500) NOT NULL DEFAULT '',
    created_at  DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at  DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (customer_id),
    UNIQUE KEY customers_phone_key (phone),
    KEY customers_name_idx (name),
    CONSTRAINT customers_nama_tidak_kosong CHECK (CHAR_LENGTH(name) >= 2),
    CONSTRAINT customers_phone_format CHECK (REGEXP_LIKE(phone, '^628[0-9]{7,12}$', 'c'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Kendaraan milik satu pelanggan. plate_key = huruf besar tanpa spasi dan tanda baca, dipakai
-- untuk keunikan dan pencarian ("b 1234-xyz" dan "B1234XYZ" sama). plate_display = tampilan
-- yang dirapikan ("B 1234 XYZ"), selalu sama dengan plate_key bila spasinya dibuang.
CREATE TABLE vehicles (
    vehicle_id    CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_id   CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- MOTOR = motor, CAR = mobil.
    type          VARCHAR(5)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    plate_display VARCHAR(14)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    plate_key     VARCHAR(12)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    brand         VARCHAR(50)  NOT NULL,
    model         VARCHAR(50)  NOT NULL DEFAULT '',
    year          SMALLINT     NULL,
    color         VARCHAR(30)  NOT NULL DEFAULT '',
    created_at    DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at    DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (vehicle_id),
    -- Satu plat hanya milik satu kendaraan (dan karena itu satu pelanggan).
    UNIQUE KEY vehicles_plate_key_key (plate_key),
    -- Pasangan (kendaraan, pelanggan) unik, dirujuk work_orders supaya SPK tidak pernah
    -- mencatat kendaraan atas nama pelanggan yang bukan pemiliknya.
    UNIQUE KEY vehicles_vehicle_customer_key (vehicle_id, customer_id),
    KEY vehicles_customer_idx (customer_id, created_at),
    CONSTRAINT vehicles_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (customer_id) ON DELETE RESTRICT,
    CONSTRAINT vehicles_type_check CHECK (type IN ('MOTOR', 'CAR')),
    CONSTRAINT vehicles_plate_key_format CHECK (REGEXP_LIKE(plate_key, '^[A-Z][A-Z0-9]{1,11}$', 'c')),
    CONSTRAINT vehicles_plate_display_format CHECK (REGEXP_LIKE(plate_display, '^[A-Z][A-Z0-9]*( [A-Z0-9]+){0,2}$', 'c')),
    CONSTRAINT vehicles_plate_sesuai_kunci CHECK (REPLACE(plate_display, ' ', '') = plate_key),
    CONSTRAINT vehicles_brand_tidak_kosong CHECK (CHAR_LENGTH(brand) >= 1),
    CONSTRAINT vehicles_year_rentang CHECK (year IS NULL OR year BETWEEN 1900 AND 2100)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Jasa servis. Tidak pernah dihapus karena item SPK dan booking menunjuk ke sini; yang tidak
-- dipakai lagi dinonaktifkan. is_public = tampil di website dan bisa dipilih saat booking.
CREATE TABLE services (
    service_id       CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Unik tanpa membedakan huruf besar/kecil dan aksen ("Ganti Oli" = "ganti oli").
    name             VARCHAR(100)  NOT NULL,
    description      VARCHAR(1000) NOT NULL DEFAULT '',
    price            BIGINT        NOT NULL,
    -- Perkiraan lama pengerjaan dalam menit, atau NULL bila tidak ditampilkan.
    duration_minutes INT           NULL,
    is_public        BOOLEAN       NOT NULL DEFAULT TRUE,
    is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order       INT           NOT NULL DEFAULT 0,
    created_at       DATETIME(3)   NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at       DATETIME(3)   NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (service_id),
    UNIQUE KEY services_name_key (name),
    KEY services_sort_idx (sort_order, name),
    CONSTRAINT services_nama_tidak_kosong CHECK (CHAR_LENGTH(name) >= 2),
    CONSTRAINT services_price_rentang CHECK (price BETWEEN 0 AND 100000000),
    CONSTRAINT services_durasi_rentang CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440),
    CONSTRAINT services_sort_rentang CHECK (sort_order BETWEEN 0 AND 100000)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Sparepart. Tidak pernah dihapus karena item SPK dan kartu stok menunjuk ke sini.
-- cost_price (harga beli) hanya boleh terlihat pemilik: itu aturan API di spec/, bukan aturan
-- database. stock hanya berubah lewat kartu stok (stok masuk, keluar, hitung ulang, item SPK).
CREATE TABLE parts (
    part_id    CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Kode barang huruf besar, unik persis.
    sku        VARCHAR(40)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name       VARCHAR(100) NOT NULL,
    -- Satuan jual yang ditampilkan ("pcs", "botol", "set"). Hanya label.
    unit       VARCHAR(20)  NOT NULL,
    price      BIGINT       NOT NULL,
    -- Harga beli per satuan, rupiah bulat. 0 = belum diisi.
    cost_price BIGINT       NOT NULL DEFAULT 0,
    -- Stok sekarang. Tidak pernah negatif: item SPK atau pengeluaran yang membuatnya negatif
    -- ditolak aplikasi (409 insufficient_stock), dan CHECK di bawah menjaganya bila satu
    -- backend lupa.
    stock      BIGINT       NOT NULL DEFAULT 0,
    min_stock  BIGINT       NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (part_id),
    UNIQUE KEY parts_sku_key (sku),
    KEY parts_name_idx (name),
    CONSTRAINT parts_sku_format CHECK (REGEXP_LIKE(sku, '^[A-Z0-9][A-Z0-9._/-]{0,39}$', 'c')),
    CONSTRAINT parts_nama_tidak_kosong CHECK (CHAR_LENGTH(name) >= 2),
    CONSTRAINT parts_unit_tidak_kosong CHECK (CHAR_LENGTH(unit) >= 1),
    CONSTRAINT parts_price_rentang CHECK (price BETWEEN 0 AND 100000000),
    CONSTRAINT parts_cost_rentang CHECK (cost_price BETWEEN 0 AND 100000000),
    CONSTRAINT parts_stock_tidak_negatif CHECK (stock >= 0),
    CONSTRAINT parts_min_rentang CHECK (min_stock BETWEEN 0 AND 100000000)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Penghitung nomor SPK dan booking. Backend menaikkan nilainya di dalam transaksi dengan
-- mengunci barisnya (SELECT … FOR UPDATE lalu UPDATE), sehingga dua SPK yang disimpan
-- bersamaan tidak pernah mendapat nomor yang sama dan tidak ada nomor yang terlewat. Nomor
-- tidak direset per hari.
CREATE TABLE counters (
    name  VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    value BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (name),
    CONSTRAINT counters_value_positif CHECK (value >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

INSERT INTO counters (name, value) VALUES ('work_order_number', 0), ('booking_number', 0);

-- SPK (surat perintah kerja). Data pelanggan dan kendaraan dibaca dari tabelnya (bukan
-- salinan), karena dicatat kasir sendiri; yang disalin hanya item (nama dan harga) supaya
-- perubahan katalog tidak mengubah SPK lama.
CREATE TABLE work_orders (
    work_order_id       CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- "S-" + nilai penghitung, minimal 4 digit: S-0001, …, S-9999, S-10000.
    number              VARCHAR(20)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_id         CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    vehicle_id          CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Mekanik yang ditugaskan, atau NULL bila belum. Mekanik nonaktif tetap tertera.
    mechanic_staff_id   CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NULL,
    -- QUEUED, IN_PROGRESS, WAITING_PARTS, DONE, PICKED_UP, CANCELLED.
    status              VARCHAR(13)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    complaint           VARCHAR(1000) NOT NULL,
    diagnosis           VARCHAR(2000) NOT NULL DEFAULT '',
    odometer            INT           NULL,
    estimated_done_at   DATETIME(3)   NULL,
    -- Jumlah subtotal item jasa dan item part. Disimpan supaya daftar SPK dan rekap tidak
    -- perlu menjumlahkan item, dan diperbarui di transaksi yang sama dengan perubahan item.
    service_subtotal    BIGINT        NOT NULL DEFAULT 0,
    part_subtotal       BIGINT        NOT NULL DEFAULT 0,
    total               BIGINT        NOT NULL DEFAULT 0,
    -- Jumlah semua baris payments untuk SPK ini, diperbarui di transaksi yang sama.
    paid_amount         BIGINT        NOT NULL DEFAULT 0,
    cancel_reason       VARCHAR(500)  NULL,
    -- Token halaman lacak /servis/<token>: 32 byte acak dalam base64url tanpa padding.
    -- Disimpan apa adanya (bukan hash) supaya pesan "siap diambil" dan nota yang dikirim
    -- belakangan tetap bisa memuat tautannya; kasir bisa membuatnya ulang bila tersebar.
    tracking_token      CHAR(43)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_by_staff_id CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at          DATETIME(3)   NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at          DATETIME(3)   NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (work_order_id),
    UNIQUE KEY work_orders_number_key (number),
    UNIQUE KEY work_orders_tracking_token_key (tracking_token),
    KEY work_orders_status_created_idx (status, created_at),
    KEY work_orders_created_at_idx (created_at),
    KEY work_orders_mechanic_idx (mechanic_staff_id, status),
    KEY work_orders_vehicle_idx (vehicle_id, created_at),
    KEY work_orders_customer_idx (customer_id),
    CONSTRAINT work_orders_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (customer_id) ON DELETE RESTRICT,
    -- Kendaraan harus milik pelanggan SPK ini (pasangan unik di vehicles).
    CONSTRAINT work_orders_vehicle_fk FOREIGN KEY (vehicle_id, customer_id) REFERENCES vehicles (vehicle_id, customer_id) ON DELETE RESTRICT,
    CONSTRAINT work_orders_mechanic_fk FOREIGN KEY (mechanic_staff_id) REFERENCES staff (staff_id) ON DELETE RESTRICT,
    CONSTRAINT work_orders_created_by_fk FOREIGN KEY (created_by_staff_id) REFERENCES staff (staff_id) ON DELETE RESTRICT,
    CONSTRAINT work_orders_number_format CHECK (REGEXP_LIKE(number, '^S-[0-9]{4,}$', 'c')),
    CONSTRAINT work_orders_status_check CHECK (status IN ('QUEUED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE', 'PICKED_UP', 'CANCELLED')),
    CONSTRAINT work_orders_token_format CHECK (REGEXP_LIKE(tracking_token, '^[A-Za-z0-9_-]{43}$', 'c')),
    CONSTRAINT work_orders_complaint_tidak_kosong CHECK (CHAR_LENGTH(complaint) >= 1),
    CONSTRAINT work_orders_odometer_rentang CHECK (odometer IS NULL OR odometer BETWEEN 0 AND 9999999),
    -- Uang. Total selalu sama dengan jumlah bagian-bagiannya dan pembayaran tidak pernah
    -- melebihi total.
    CONSTRAINT work_orders_subtotal_tidak_negatif CHECK (service_subtotal >= 0 AND part_subtotal >= 0),
    CONSTRAINT work_orders_total_sesuai CHECK (total = service_subtotal + part_subtotal),
    CONSTRAINT work_orders_paid_rentang CHECK (paid_amount BETWEEN 0 AND total),
    -- Pengaman terakhir untuk aturan bisnis: kendaraan hanya diserahkan bila lunas, SPK yang
    -- sudah dibayar tidak bisa dibatalkan, dan alasan batal ada tepat saat batal.
    CONSTRAINT work_orders_diambil_lunas CHECK (status <> 'PICKED_UP' OR paid_amount = total),
    CONSTRAINT work_orders_batal_tanpa_bayar CHECK (status <> 'CANCELLED' OR paid_amount = 0),
    CONSTRAINT work_orders_alasan_batal CHECK ((status = 'CANCELLED') = (cancel_reason IS NOT NULL))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Item SPK: salinan jasa atau sparepart saat ditambahkan. Item dihapus sungguhan (DELETE)
-- selama SPK masih terbuka; kartu stok mencatat pengembalian part-nya. line_no naik terus per
-- SPK dan tidak dipakai ulang, supaya urutan item stabil walau ada yang dihapus.
CREATE TABLE work_order_items (
    work_order_item_id CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    work_order_id      CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    line_no            INT          NOT NULL,
    -- SERVICE = jasa, PART = sparepart.
    type               VARCHAR(7)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    service_id         CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NULL,
    part_id            CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NULL,
    item_name          VARCHAR(100) NOT NULL,
    price              BIGINT       NOT NULL,
    -- Harga beli saat ditambahkan (part), untuk laba di rekap. Jasa selalu 0. Tidak pernah
    -- dikirim di respons SPK.
    cost_price         BIGINT       NOT NULL DEFAULT 0,
    quantity           INT          NOT NULL,
    subtotal           BIGINT       NOT NULL,
    created_by_staff_id CHAR(36)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at         DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (work_order_item_id),
    UNIQUE KEY work_order_items_line_key (work_order_id, line_no),
    KEY work_order_items_service_idx (service_id),
    KEY work_order_items_part_idx (part_id),
    CONSTRAINT work_order_items_work_order_fk FOREIGN KEY (work_order_id) REFERENCES work_orders (work_order_id) ON DELETE RESTRICT,
    CONSTRAINT work_order_items_service_fk FOREIGN KEY (service_id) REFERENCES services (service_id) ON DELETE RESTRICT,
    CONSTRAINT work_order_items_part_fk FOREIGN KEY (part_id) REFERENCES parts (part_id) ON DELETE RESTRICT,
    CONSTRAINT work_order_items_created_by_fk FOREIGN KEY (created_by_staff_id) REFERENCES staff (staff_id) ON DELETE RESTRICT,
    CONSTRAINT work_order_items_type_check CHECK (type IN ('SERVICE', 'PART')),
    -- Item jasa menunjuk jasa saja, item part menunjuk sparepart saja.
    CONSTRAINT work_order_items_rujukan_jasa CHECK ((type = 'SERVICE') = (service_id IS NOT NULL)),
    CONSTRAINT work_order_items_rujukan_part CHECK ((type = 'PART') = (part_id IS NOT NULL)),
    CONSTRAINT work_order_items_jasa_tanpa_modal CHECK (type <> 'SERVICE' OR cost_price = 0),
    CONSTRAINT work_order_items_line_positif CHECK (line_no >= 1),
    CONSTRAINT work_order_items_price_rentang CHECK (price BETWEEN 0 AND 100000000),
    CONSTRAINT work_order_items_cost_rentang CHECK (cost_price BETWEEN 0 AND 100000000),
    CONSTRAINT work_order_items_quantity_rentang CHECK (quantity BETWEEN 1 AND 99),
    CONSTRAINT work_order_items_subtotal_sesuai CHECK (subtotal = price * quantity)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Linimasa status SPK: satu baris saat SPK dibuat (NULL → QUEUED) dan satu baris untuk setiap
-- perubahan sesudahnya. Semua perubahan dilakukan staf.
CREATE TABLE work_order_status_logs (
    work_order_status_log_id CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    work_order_id            CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    from_status              VARCHAR(13)  CHARACTER SET ascii COLLATE ascii_bin NULL,
    to_status                VARCHAR(13)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    staff_id                 CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Catatan staf (alasan batal untuk CANCELLED). Tidak tampil di halaman publik.
    note                     VARCHAR(500) NOT NULL DEFAULT '',
    created_at               DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (work_order_status_log_id),
    KEY work_order_status_logs_work_order_idx (work_order_id, created_at),
    -- Rekap harian menghitung SPK selesai, diambil, dan batal dari baris ini.
    KEY work_order_status_logs_to_status_idx (to_status, created_at),
    CONSTRAINT work_order_status_logs_work_order_fk FOREIGN KEY (work_order_id) REFERENCES work_orders (work_order_id) ON DELETE RESTRICT,
    CONSTRAINT work_order_status_logs_staff_fk FOREIGN KEY (staff_id) REFERENCES staff (staff_id) ON DELETE RESTRICT,
    -- Hanya perpindahan yang sah yang bisa tercatat; cermin tabel "Status SPK" di spec.
    -- Perbandingan dengan from_status dibungkus "from_status IS NOT NULL" (lihat catatan di
    -- awal berkas).
    CONSTRAINT work_order_status_logs_transisi_sah CHECK (
        (from_status IS NULL AND to_status = 'QUEUED')
        OR (from_status IS NOT NULL AND (
            (from_status = 'QUEUED' AND to_status IN ('IN_PROGRESS', 'CANCELLED'))
            OR (from_status = 'IN_PROGRESS' AND to_status IN ('WAITING_PARTS', 'DONE', 'CANCELLED'))
            OR (from_status = 'WAITING_PARTS' AND to_status IN ('IN_PROGRESS', 'CANCELLED'))
            OR (from_status = 'DONE' AND to_status = 'PICKED_UP')
        ))
    )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE payments (
    payment_id    CHAR(36)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    work_order_id CHAR(36)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount        BIGINT      NOT NULL,
    method        VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Kasir atau pemilik yang mencatat.
    staff_id      CHAR(36)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at    DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (payment_id),
    KEY payments_work_order_idx (work_order_id, created_at),
    KEY payments_created_at_idx (created_at),
    -- RESTRICT: SPK yang sudah dibayar tidak boleh hilang dari catatan uang.
    CONSTRAINT payments_work_order_fk FOREIGN KEY (work_order_id) REFERENCES work_orders (work_order_id) ON DELETE RESTRICT,
    CONSTRAINT payments_staff_fk FOREIGN KEY (staff_id) REFERENCES staff (staff_id) ON DELETE RESTRICT,
    CONSTRAINT payments_amount_positif CHECK (amount > 0),
    CONSTRAINT payments_method_check CHECK (method IN ('cash', 'transfer', 'qris'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Kartu stok: setiap perubahan stok satu sparepart, tidak pernah diubah atau dihapus. Jumlah
-- quantity per sparepart selalu sama dengan parts.stock.
--   IN        stok masuk (belanja, stok awal)                       quantity > 0
--   OUT       keluar manual (rusak, hilang), wajib catatan          quantity < 0
--   COUNT     hitung ulang (opname), wajib catatan                  quantity bebas (boleh 0)
--   USED      terpakai karena item part ditambahkan ke SPK          quantity < 0
--   RETURNED  kembali karena item part dihapus atau SPK dibatalkan  quantity > 0
CREATE TABLE stock_movements (
    stock_movement_id CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    part_id           CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    type              VARCHAR(8)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    quantity          BIGINT       NOT NULL,
    stock_after       BIGINT       NOT NULL,
    note              VARCHAR(200) NOT NULL DEFAULT '',
    -- SPK penyebabnya; hanya untuk USED dan RETURNED. Tidak menunjuk item, karena item boleh
    -- dihapus; jumlah yang masih tertahan di SPK = −jumlah quantity baris SPK itu.
    work_order_id     CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NULL,
    staff_id          CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at        DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (stock_movement_id),
    KEY stock_movements_part_idx (part_id, created_at, stock_movement_id),
    KEY stock_movements_work_order_idx (work_order_id, part_id),
    CONSTRAINT stock_movements_part_fk FOREIGN KEY (part_id) REFERENCES parts (part_id) ON DELETE RESTRICT,
    CONSTRAINT stock_movements_work_order_fk FOREIGN KEY (work_order_id) REFERENCES work_orders (work_order_id) ON DELETE RESTRICT,
    CONSTRAINT stock_movements_staff_fk FOREIGN KEY (staff_id) REFERENCES staff (staff_id) ON DELETE RESTRICT,
    CONSTRAINT stock_movements_type_check CHECK (type IN ('IN', 'OUT', 'COUNT', 'USED', 'RETURNED')),
    CONSTRAINT stock_movements_after_tidak_negatif CHECK (stock_after >= 0),
    -- Tanda jumlah mengikuti jenisnya, jadi kartu stok tidak bisa berisi "stok masuk" yang
    -- sebenarnya mengurangi.
    CONSTRAINT stock_movements_tanda_sesuai CHECK (
        (type IN ('IN', 'RETURNED') AND quantity > 0)
        OR (type IN ('OUT', 'USED') AND quantity < 0)
        OR type = 'COUNT'
    ),
    -- SPK hanya ada pada baris yang disebabkan SPK.
    CONSTRAINT stock_movements_spk_sesuai CHECK ((type IN ('USED', 'RETURNED')) = (work_order_id IS NOT NULL)),
    -- Keluar manual dan hitung ulang wajib punya alasan.
    CONSTRAINT stock_movements_catatan_wajib CHECK (type NOT IN ('OUT', 'COUNT') OR CHAR_LENGTH(note) >= 1)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Booking dari website. Data pemesan dan kendaraan adalah salinan isian form; pelanggan dan
-- kendaraan baru dicari atau dibuat saat booking dijadikan SPK.
CREATE TABLE bookings (
    booking_id          CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- "B-" + nilai penghitung, minimal 4 digit.
    number              VARCHAR(20)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_name       VARCHAR(100)  NOT NULL,
    customer_phone      VARCHAR(15)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    vehicle_type        VARCHAR(5)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    plate_display       VARCHAR(14)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Tidak unik: plat yang sama boleh dibooking berkali-kali.
    plate_key           VARCHAR(12)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    vehicle_brand       VARCHAR(50)   NOT NULL,
    vehicle_model       VARCHAR(50)   NOT NULL DEFAULT '',
    -- Jasa yang dipilih (opsional) beserta salinan namanya saat booking dibuat.
    service_id          CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NULL,
    service_name        VARCHAR(100)  NULL,
    -- Tanggal datang, tanggal WIB.
    visit_date          DATE          NOT NULL,
    complaint           VARCHAR(1000) NOT NULL,
    -- PENDING, CONFIRMED, CONVERTED, REJECTED, CANCELLED.
    status              VARCHAR(10)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reject_reason       VARCHAR(500)  NULL,
    -- Hex SHA-256 dari token booking yang diberikan sekali ke pemesan. Hanya hash yang
    -- disimpan, seperti token sesi.
    booking_token_hash  CHAR(64)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- SPK hasil konversi; terisi tepat saat CONVERTED.
    work_order_id       CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NULL,
    -- Staf yang terakhir mengonfirmasi, menolak, atau menjadikan SPK.
    handled_by_staff_id CHAR(36)      CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at          DATETIME(3)   NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    updated_at          DATETIME(3)   NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (booking_id),
    UNIQUE KEY bookings_number_key (number),
    UNIQUE KEY bookings_token_hash_key (booking_token_hash),
    -- Satu SPK hanya berasal dari satu booking.
    UNIQUE KEY bookings_work_order_key (work_order_id),
    -- Dipakai membatasi 3 booking menunggu per nomor HP.
    KEY bookings_phone_status_idx (customer_phone, status),
    KEY bookings_status_created_idx (status, created_at),
    KEY bookings_created_at_idx (created_at),
    KEY bookings_visit_date_idx (visit_date),
    CONSTRAINT bookings_service_fk FOREIGN KEY (service_id) REFERENCES services (service_id) ON DELETE RESTRICT,
    CONSTRAINT bookings_work_order_fk FOREIGN KEY (work_order_id) REFERENCES work_orders (work_order_id) ON DELETE RESTRICT,
    CONSTRAINT bookings_handled_by_fk FOREIGN KEY (handled_by_staff_id) REFERENCES staff (staff_id) ON DELETE RESTRICT,
    CONSTRAINT bookings_number_format CHECK (REGEXP_LIKE(number, '^B-[0-9]{4,}$', 'c')),
    CONSTRAINT bookings_nama_tidak_kosong CHECK (CHAR_LENGTH(customer_name) >= 2),
    CONSTRAINT bookings_phone_format CHECK (REGEXP_LIKE(customer_phone, '^628[0-9]{7,12}$', 'c')),
    CONSTRAINT bookings_vehicle_type_check CHECK (vehicle_type IN ('MOTOR', 'CAR')),
    CONSTRAINT bookings_plate_key_format CHECK (REGEXP_LIKE(plate_key, '^[A-Z][A-Z0-9]{1,11}$', 'c')),
    CONSTRAINT bookings_plate_sesuai_kunci CHECK (REPLACE(plate_display, ' ', '') = plate_key),
    CONSTRAINT bookings_brand_tidak_kosong CHECK (CHAR_LENGTH(vehicle_brand) >= 1),
    CONSTRAINT bookings_complaint_tidak_kosong CHECK (CHAR_LENGTH(complaint) >= 1),
    CONSTRAINT bookings_status_check CHECK (status IN ('PENDING', 'CONFIRMED', 'CONVERTED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT bookings_token_hash_hex CHECK (REGEXP_LIKE(booking_token_hash, '^[0-9a-f]{64}$', 'c')),
    -- Hubungan antar kolom: nama jasa ada tepat saat jasa dipilih; alasan tolak tepat saat
    -- REJECTED; SPK tepat saat CONVERTED; staf penangan ada tepat saat staf sudah bertindak
    -- (PENDING belum disentuh staf, CANCELLED hanya bisa oleh pelanggan dari PENDING).
    CONSTRAINT bookings_nama_jasa_sesuai CHECK ((service_id IS NULL) = (service_name IS NULL)),
    CONSTRAINT bookings_alasan_tolak CHECK ((status = 'REJECTED') = (reject_reason IS NOT NULL)),
    CONSTRAINT bookings_spk_sesuai CHECK ((status = 'CONVERTED') = (work_order_id IS NOT NULL)),
    CONSTRAINT bookings_penangan_sesuai CHECK ((status IN ('PENDING', 'CANCELLED')) = (handled_by_staff_id IS NULL))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Setiap pesan WhatsApp yang dicoba dikirim backend, beserta hasilnya. Pesan booking menunjuk
-- booking, pesan SPK menunjuk SPK.
CREATE TABLE wa_messages (
    wa_message_id  CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    type           VARCHAR(20)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Nomor tujuan (628…) saat pesan dikirim. Bisa berbeda dari nomor pelanggan bila kasir
    -- mengisi nomor lain saat mengirim ulang.
    phone          VARCHAR(15)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Isi pesan persis seperti dikirim.
    body           TEXT         NOT NULL,
    status         VARCHAR(10)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- Alasan gagal untuk dibaca manusia; NULL bila terkirim.
    failure_reason VARCHAR(255) NULL,
    booking_id     CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NULL,
    work_order_id  CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at     DATETIME(3)  NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    PRIMARY KEY (wa_message_id),
    KEY wa_messages_booking_idx (booking_id, type, created_at),
    KEY wa_messages_work_order_idx (work_order_id, type, created_at),
    KEY wa_messages_created_at_idx (created_at),
    CONSTRAINT wa_messages_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings (booking_id) ON DELETE RESTRICT,
    CONSTRAINT wa_messages_work_order_fk FOREIGN KEY (work_order_id) REFERENCES work_orders (work_order_id) ON DELETE RESTRICT,
    CONSTRAINT wa_messages_type_check CHECK (type IN ('booking_confirmed', 'booking_rejected', 'work_order_created', 'work_order_done', 'receipt')),
    CONSTRAINT wa_messages_status_check CHECK (status IN ('sent', 'failed')),
    CONSTRAINT wa_messages_phone_format CHECK (REGEXP_LIKE(phone, '^628[0-9]{7,12}$', 'c')),
    CONSTRAINT wa_messages_alasan_gagal CHECK ((status = 'failed') = (failure_reason IS NOT NULL)),
    -- Pesan booking menunjuk booking saja, pesan SPK menunjuk SPK saja.
    CONSTRAINT wa_messages_rujukan_booking CHECK ((type IN ('booking_confirmed', 'booking_rejected')) = (booking_id IS NOT NULL)),
    CONSTRAINT wa_messages_rujukan_spk CHECK ((type IN ('work_order_created', 'work_order_done', 'receipt')) = (work_order_id IS NOT NULL))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
