// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Membuat tangkapan layar Panduan Pemakai (gambar/) dari aplikasi yang benar-benar berjalan:
// mengisi bengkel contoh lewat API (profil, staf, jasa, sparepart dan stok, pelanggan dan
// kendaraan, booking dari website, dan SPK di berbagai status), lalu memotret layar pemilik,
// kasir, mekanik, dan pelanggan (ukuran HP).
//
// Tumpukan (backend, WhatsApp palsu, web build produksi) dinyalakan sendiri lebih dulu, dengan
// database yang BARU dimigrasi dan masih kosong; caranya di README. Alamatnya lewat env:
//
//   API_URL=http://localhost:8865 WEB_URL=http://localhost:3865 SETUP_TOKEN=<token> node tangkap-layar.js
//
// Berkas lama di gambar/ ditimpa. Gambar disimpan apa adanya (PNG penuh warna); kecilkan sesudahnya
// (lihat README) supaya panduan pemakai tetap kecil.

const fs = require('fs')
const path = require('path')
const { chromium } = require('@playwright/test')

const API = (process.env.API_URL || 'http://localhost:8865').replace(/\/+$/, '')
const WEB = (process.env.WEB_URL || 'http://localhost:3865').replace(/\/+$/, '')
const SETUP_TOKEN = process.env.SETUP_TOKEN || ''
const KELUAR = path.join(__dirname, 'gambar')

const PEMILIK = { name: 'Hendra Wijaya', email: 'hendra@bengkelsentosa.example', password: 'SandiPemilik123' }
const KASIR = { name: 'Dewi Lestari', email: 'dewi@bengkelsentosa.example', password: 'SandiKasir123', role: 'cashier' }
const MEKANIK = [
    { name: 'Agus Setiawan', email: 'agus@bengkelsentosa.example', password: 'SandiMekanik123', role: 'mechanic' },
    { name: 'Bayu Pratama', email: 'bayu@bengkelsentosa.example', password: 'SandiMekanik123', role: 'mechanic' },
]

// ---- API ------------------------------------------------------------------------------------

async function api(metode, jalur, { token, json } = {}) {
    const res = await fetch(`${API}${jalur}`, {
        method: metode,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
    })
    const badan = await res.json().catch(() => null)
    if (!res.ok) throw new Error(`${metode} ${jalur} -> ${res.status} ${JSON.stringify(badan && badan.error)}`)
    return badan && badan.data
}

// Tanggal WIB (UTC+7) sebagai YYYY-MM-DD, `hari` hari dari sekarang.
function tanggalWib(hari = 0) {
    const t = new Date(Date.now() + 7 * 3600 * 1000 + hari * 86400 * 1000)
    return t.toISOString().slice(0, 10)
}

// ---- Data contoh ----------------------------------------------------------------------------

const OUTLET = {
    name: 'Bengkel Sentosa Motor',
    tagline: 'Servis motor dan mobil, cepat dan jujur',
    address: 'Jl. Merdeka No. 45\nKota Contoh 40111',
    phone: '0812-3456-7000',
    openingHours: 'Senin–Sabtu 08.00–17.00\nMinggu tutup',
    mapsUrl: 'https://maps.google.com/?q=Jl.+Merdeka+No.+45',
    receiptFooter: 'Garansi servis 7 hari. Terima kasih sudah mempercayakan kendaraanmu kepada kami.',
}

const JASA = [
    { name: 'Servis Rutin Motor', description: 'Cek dan setel mesin, rem, rantai, dan kelistrikan.', price: 75000, durationMinutes: 60, sortOrder: 1 },
    { name: 'Ganti Oli', description: 'Ganti oli mesin; oli dihitung terpisah.', price: 25000, durationMinutes: 15, sortOrder: 2 },
    { name: 'Servis Rem', description: 'Bersihkan dan setel rem depan dan belakang.', price: 50000, durationMinutes: 45, sortOrder: 3 },
    { name: 'Tune Up Mobil', description: 'Busi, filter udara, throttle body, dan pemindaian mesin.', price: 350000, durationMinutes: 120, sortOrder: 4 },
    { name: 'Spooring dan Balancing', description: 'Penyetelan roda supaya mobil tidak menarik ke satu sisi.', price: 200000, durationMinutes: 60, sortOrder: 5 },
    { name: 'Cek Kelistrikan', description: 'Pemeriksaan aki, kabel, dan lampu.', price: 40000, durationMinutes: 30, sortOrder: 6, isPublic: false },
    { name: 'Turun Mesin', description: 'Overhaul mesin; harga menyesuaikan kerusakan.', price: 1500000, durationMinutes: 480, sortOrder: 7, isActive: false },
]

const PART = [
    { sku: 'OLI-1040-08', name: 'Oli Mesin 10W-40 0,8 L', unit: 'botol', price: 55000, costPrice: 42000, minStock: 6, initialStock: 24 },
    { sku: 'KRD-VARIO', name: 'Kampas Rem Depan Vario', unit: 'set', price: 75000, costPrice: 52000, minStock: 4, initialStock: 6 },
    { sku: 'BSI-CPR9', name: 'Busi NGK CPR9EA-9', unit: 'pcs', price: 25000, costPrice: 16000, minStock: 10, initialStock: 30 },
    { sku: 'VBL-VARIO', name: 'V-Belt Vario 125', unit: 'pcs', price: 145000, costPrice: 105000, minStock: 2, initialStock: 5 },
    { sku: 'FUD-AVZ', name: 'Filter Udara Avanza', unit: 'pcs', price: 85000, costPrice: 60000, minStock: 2, initialStock: 0 },
    { sku: 'AKI-GTZ5S', name: 'Aki Kering GTZ5S', unit: 'pcs', price: 280000, costPrice: 0, minStock: 2, initialStock: 4 },
]

const PELANGGAN = [
    { name: 'Budi Santoso', phone: '0812-3456-7890', address: 'Jl. Kenanga No. 12', kendaraan: { type: 'MOTOR', plate: 'B 1234 XYZ', brand: 'Honda', model: 'Vario 125', year: 2021, color: 'Hitam' } },
    { name: 'Siti Rahmawati', phone: '0813-2200-4411', kendaraan: { type: 'CAR', plate: 'B 2071 KJA', brand: 'Toyota', model: 'Avanza', year: 2019, color: 'Silver' } },
    { name: 'Andi Pratama', phone: '0857-1100-2233', notes: 'Minta dikabari sebelum ganti part.', kendaraan: { type: 'CAR', plate: 'D 1888 AP', brand: 'Honda', model: 'Jazz', year: 2017, color: 'Merah' } },
    { name: 'Dimas Saputra', phone: '0878-5500-6677', kendaraan: { type: 'MOTOR', plate: 'F 3456 DS', brand: 'Yamaha', model: 'Mio M3', year: 2020, color: 'Putih' } },
    { name: 'Eko Wibowo', phone: '0819-7788-9900', kendaraan: { type: 'MOTOR', plate: 'B 6611 EW', brand: 'Suzuki', model: 'Nex II', year: 2022, color: 'Biru' } },
]

// ---- Mengisi bengkel contoh -----------------------------------------------------------------

async function isiData() {
    const setup = await api('GET', '/api/setup')
    if (!setup.needsSetup) throw new Error('database sudah punya staf; pakai database yang baru dimigrasi dan masih kosong')
    if (!SETUP_TOKEN) throw new Error('isi env SETUP_TOKEN, sama dengan milik backend')

    const pasang = await api('POST', '/api/setup', { json: { token: SETUP_TOKEN, ...PEMILIK } })
    const pemilik = pasang.token
    await api('PUT', '/api/outlet', { token: pemilik, json: OUTLET })
    await api('POST', '/api/staff', { token: pemilik, json: KASIR })
    const mekanik = []
    for (const m of MEKANIK) mekanik.push(await api('POST', '/api/staff', { token: pemilik, json: m }))
    const kasir = (await api('POST', '/api/staff/login', { json: { email: KASIR.email, password: KASIR.password } })).token

    const jasa = {}
    for (const j of JASA) jasa[j.name] = await api('POST', '/api/services', { token: pemilik, json: j })
    const part = {}
    for (const x of PART) part[x.sku] = await api('POST', '/api/parts', { token: pemilik, json: x })
    // Kartu stok yang tidak hanya "Stok awal": pembelian baru dan satu barang rusak.
    await api('POST', `/api/parts/${part['OLI-1040-08'].partId}/stock-in`, { token: pemilik, json: { quantity: 12, costPrice: 43000, note: 'Pembelian dari pemasok' } })
    await api('POST', `/api/parts/${part['OLI-1040-08'].partId}/stock-out`, { token: pemilik, json: { quantity: 1, note: 'Botol bocor' } })

    const kendaraan = {}
    for (const c of PELANGGAN) {
        const { kendaraan: k, ...data } = c
        const pel = await api('POST', '/api/customers', { token: kasir, json: data })
        kendaraan[c.name] = await api('POST', `/api/customers/${pel.customerId}/vehicles`, { token: kasir, json: k })
    }

    // Booking dari website. Token hanya dikirim sekali, jadi disimpan untuk dipotret nanti.
    const booking = async (b) => api('POST', '/api/public/bookings', { json: b })
    const b1 = await booking({ customerName: 'Rudi Hartono', phone: '0821-4455-6677', vehicleType: 'MOTOR', plate: 'D 4521 ABC', vehicleBrand: 'Yamaha', vehicleModel: 'NMAX', serviceId: jasa['Servis Rutin Motor'].serviceId, visitDate: tanggalWib(0), complaint: 'Servis rutin, tarikan terasa berat.' })
    const b2 = await booking({ customerName: 'Lina Marlina', phone: '0822-3344-5566', vehicleType: 'CAR', plate: 'B 1910 LMN', vehicleBrand: 'Honda', vehicleModel: 'Brio', serviceId: jasa['Tune Up Mobil'].serviceId, visitDate: tanggalWib(2), complaint: 'Mesin agak brebet saat pagi, minta tune up sekalian cek AC.' })
    const b3 = await booking({ customerName: 'Fajar Nugroho', phone: '0838-9900-1122', vehicleType: 'MOTOR', plate: 'B 3322 FN', vehicleBrand: 'Honda', vehicleModel: 'Beat', serviceId: jasa['Ganti Oli'].serviceId, visitDate: tanggalWib(1), complaint: 'Ganti oli dan cek rem belakang.' })
    const b4 = await booking({ customerName: 'Toni Gunawan', phone: '0812-9988-7766', vehicleType: 'CAR', plate: 'B 7788 TG', vehicleBrand: 'Daihatsu', vehicleModel: 'Xenia', serviceId: jasa['Spooring dan Balancing'].serviceId, visitDate: tanggalWib(3), complaint: 'Setir menarik ke kiri.' })
    const b5 = await booking({ customerName: 'Maya Sari', phone: '0813-6677-8899', vehicleType: 'MOTOR', plate: 'B 5544 MS', vehicleBrand: 'Honda', vehicleModel: 'Scoopy', visitDate: tanggalWib(1), complaint: 'Lampu depan mati.' })
    const b6 = await booking({ customerName: 'Yusuf Maulana', phone: '0856-1234-0099', vehicleType: 'MOTOR', plate: 'B 9012 YM', vehicleBrand: 'Yamaha', vehicleModel: 'Aerox', serviceId: jasa['Servis Rem'].serviceId, visitDate: tanggalWib(4), complaint: 'Rem depan bunyi.' })
    // Balasan publik tanpa ID internal; ID untuk rute staf dicari dari nomornya.
    const daftar = await api('GET', '/api/bookings?limit=50', { token: kasir })
    const idBooking = (b) => daftar.find((x) => x.number === b.booking.number).bookingId
    await api('POST', `/api/bookings/${idBooking(b3)}/confirm`, { token: kasir })
    await api('POST', `/api/bookings/${idBooking(b4)}/reject`, { token: kasir, json: { reason: 'Mesin spooring sedang diperbaiki sampai minggu depan. Silakan booking lagi mulai tanggal 7.' } })
    await api('POST', `/api/public/bookings/${b5.bookingToken}/cancel`)

    const item = (no, json) => api('POST', `/api/work-orders/${no}/items`, { token: kasir, json })
    const status = (no, s, tok = kasir, note) => api('POST', `/api/work-orders/${no}/status`, { token: tok, json: note ? { status: s, note } : { status: s } })
    const bayar = (no, amount, method) => api('POST', `/api/work-orders/${no}/payments`, { token: kasir, json: { amount, method } })
    const [agus, bayu] = mekanik
    const tokenAgus = (await api('POST', '/api/staff/login', { json: { email: MEKANIK[0].email, password: MEKANIK[0].password } })).token
    const tokenBayu = (await api('POST', '/api/staff/login', { json: { email: MEKANIK[1].email, password: MEKANIK[1].password } })).token

    // S-0001: sudah selesai, lunas, dan diambil.
    const s1 = await api('POST', '/api/work-orders', { token: kasir, json: { vehicleId: kendaraan['Budi Santoso'].vehicleId, complaint: 'Servis rutin, rem depan bunyi saat dipakai.', odometer: 18250, mechanicId: agus.staffId } })
    await item(s1.number, { type: 'SERVICE', serviceId: jasa['Servis Rutin Motor'].serviceId, quantity: 1 })
    await item(s1.number, { type: 'PART', partId: part['OLI-1040-08'].partId, quantity: 1 })
    await item(s1.number, { type: 'PART', partId: part['KRD-VARIO'].partId, quantity: 1 })
    await status(s1.number, 'IN_PROGRESS', tokenAgus)
    await api('PATCH', `/api/work-orders/${s1.number}`, { token: tokenAgus, json: { diagnosis: 'Kampas rem depan tinggal 1 mm, diganti. Oli sudah hitam.' } })
    await status(s1.number, 'DONE', tokenAgus)
    await bayar(s1.number, 205000, 'cash')
    await status(s1.number, 'PICKED_UP')

    // S-0002: mobil menunggu filter udara dari pemasok.
    const s2 = await api('POST', '/api/work-orders', { token: kasir, json: { vehicleId: kendaraan['Siti Rahmawati'].vehicleId, complaint: 'Tune up, mesin tersendat saat menanjak.', odometer: 64120, mechanicId: bayu.staffId, estimatedDoneAt: `${tanggalWib(1)}T15:00:00+07:00` } })
    await item(s2.number, { type: 'SERVICE', serviceId: jasa['Tune Up Mobil'].serviceId, quantity: 1 })
    await item(s2.number, { type: 'PART', partId: part['BSI-CPR9'].partId, quantity: 4 })
    await status(s2.number, 'IN_PROGRESS', tokenBayu)
    await status(s2.number, 'WAITING_PARTS', tokenBayu, 'Filter udara habis, menunggu kiriman pemasok besok pagi')
    await bayar(s2.number, 200000, 'transfer')

    // S-0003: dari booking B-0001, sedang dikerjakan.
    await api('POST', `/api/bookings/${idBooking(b1)}/confirm`, { token: kasir })
    const konversi = await api('POST', `/api/bookings/${idBooking(b1)}/convert`, { token: kasir, json: { mechanicId: agus.staffId, odometer: 9870 } })
    const s3 = konversi.workOrder
    await item(s3.number, { type: 'PART', partId: part['VBL-VARIO'].partId, quantity: 1 })
    await status(s3.number, 'IN_PROGRESS', tokenAgus)

    // S-0004: selesai hari ini, baru dibayar sebagian (siap diambil).
    const s4 = await api('POST', '/api/work-orders', { token: kasir, json: { vehicleId: kendaraan['Andi Pratama'].vehicleId, complaint: 'Spooring dan balancing, ganti aki.', odometer: 102300, mechanicId: bayu.staffId } })
    await item(s4.number, { type: 'SERVICE', serviceId: jasa['Spooring dan Balancing'].serviceId, quantity: 1 })
    await item(s4.number, { type: 'SERVICE', serviceId: jasa['Cek Kelistrikan'].serviceId, quantity: 1 })
    await item(s4.number, { type: 'PART', partId: part['AKI-GTZ5S'].partId, quantity: 1 })
    await bayar(s4.number, 300000, 'qris')
    await status(s4.number, 'IN_PROGRESS', tokenBayu)
    await api('PATCH', `/api/work-orders/${s4.number}`, { token: tokenBayu, json: { diagnosis: 'Aki lemah (11,6 V), diganti. Roda depan kiri toe-in, sudah disetel.' } })
    await status(s4.number, 'DONE', tokenBayu)

    // S-0005: baru masuk antrean, sudah ditugaskan ke mekanik.
    const s5 = await api('POST', '/api/work-orders', { token: kasir, json: { vehicleId: kendaraan['Dimas Saputra'].vehicleId, complaint: 'Ganti oli, lampu sein kanan mati.', mechanicId: agus.staffId } })
    await item(s5.number, { type: 'SERVICE', serviceId: jasa['Ganti Oli'].serviceId, quantity: 1 })
    await item(s5.number, { type: 'PART', partId: part['OLI-1040-08'].partId, quantity: 1 })

    // S-0006: dibatalkan; part kembali ke stok.
    const s6 = await api('POST', '/api/work-orders', { token: kasir, json: { vehicleId: kendaraan['Eko Wibowo'].vehicleId, complaint: 'Servis rutin.' } })
    await item(s6.number, { type: 'SERVICE', serviceId: jasa['Servis Rutin Motor'].serviceId, quantity: 1 })
    await api('POST', `/api/work-orders/${s6.number}/cancel`, { token: kasir, json: { reason: 'Pelanggan memutuskan servis minggu depan.' } })

    return {
        spk: { s1: s1.number, s2: s2.number, s3: s3.number, s4: s4.number, s5: s5.number, s6: s6.number },
        lacak: { s4: (await api('GET', `/api/work-orders/${s4.number}`, { token: kasir })).trackingToken, s3: s3.trackingToken },
        booking: {
            menunggu: { id: idBooking(b2), token: b2.bookingToken },
            dikonfirmasi: { id: idBooking(b3), token: b3.bookingToken },
            ditolak: { id: idBooking(b4), token: b4.bookingToken },
            lain: { id: idBooking(b6), token: b6.bookingToken },
        },
        part,
        jasa,
        pelanggan: kendaraan,
    }
}

// ---- Memotret --------------------------------------------------------------------------------

const LAYAR = { width: 1366, height: 860 }
const HP = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const jeda = (page, ms = 1200) => page.waitForTimeout(ms)

// Satu layar penuh (bukan seluruh halaman), kecuali `penuh` true.
async function foto(page, berkas, { penuh = false, elemen } = {}) {
    await jeda(page, 500)
    const tujuan = path.join(KELUAR, berkas)
    if (elemen) await elemen.screenshot({ path: tujuan })
    else await page.screenshot({ path: tujuan, fullPage: penuh })
    console.log(`  ${berkas}`)
}

async function masuk(browser, { email, password }) {
    const ctx = await browser.newContext({ viewport: LAYAR })
    const page = await ctx.newPage()
    await page.goto(`${WEB}/admin/masuk`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Kata sandi').fill(password)
    await page.getByRole('button', { name: 'Masuk' }).click()
    await page.waitForURL(/\/admin\/papan/)
    return page
}

// Membuka dialog lewat tombol, memotret layar beserta dialognya, lalu menutupnya tanpa menyimpan.
async function fotoDialog(page, tombol, berkas, isi) {
    await page.getByRole('button', { name: tombol, exact: true }).first().click()
    await page.getByRole('dialog').waitFor()
    if (isi) await isi(page.getByRole('dialog'))
    await foto(page, berkas)
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
}

async function potret(browser, d) {
    // Pemilik
    const p = await masuk(browser, PEMILIK)
    await p.goto(`${WEB}/admin/outlet`)
    await foto(p, '03-outlet.png')
    await p.goto(`${WEB}/admin/jasa`)
    await foto(p, '04-jasa.png')
    await fotoDialog(p, 'Tambah jasa', '05-dialog-jasa.png', async (dlg) => {
        await dlg.getByLabel('Nama jasa').fill('Ganti Ban Dalam')
        await dlg.getByLabel('Harga', { exact: true }).fill('35000')
        await dlg.getByLabel('Durasi (menit)').fill('20')
        await dlg.getByLabel('Deskripsi').fill('Bongkar pasang ban dalam motor; ban dihitung terpisah.')
    })
    await p.goto(`${WEB}/admin/sparepart`)
    await foto(p, '06-sparepart.png')
    await fotoDialog(p, 'Stok masuk Oli Mesin 10W-40 0,8 L', '07-stok-masuk.png', async (dlg) => {
        await dlg.getByLabel('Jumlah (botol)').fill('24')
        await dlg.getByLabel('Catatan').fill('Belanja mingguan')
    })
    await fotoDialog(p, 'Kartu stok Oli Mesin 10W-40 0,8 L', '08-kartu-stok.png')
    await p.goto(`${WEB}/admin/staf`)
    await foto(p, '09-staf.png')
    await p.goto(`${WEB}/admin/rekap`)
    await foto(p, '10-rekap.png', { penuh: true })

    // Kasir
    const k = await masuk(browser, KASIR)
    await jeda(k)
    await foto(k, '11-papan.png')
    await k.goto(`${WEB}/admin/booking`)
    await foto(k, '12-booking.png')
    await k.goto(`${WEB}/admin/booking/${d.booking.menunggu.id}`)
    await foto(k, '13-booking-rincian.png')
    await fotoDialog(k, 'Tolak', '14-tolak-booking.png', async (dlg) => {
        await dlg.getByLabel('Alasan tolak').fill('Tanggal itu sudah penuh. Silakan booking lagi untuk hari Senin.')
    })
    await k.goto(`${WEB}/admin/booking/${d.booking.dikonfirmasi.id}`)
    await fotoDialog(k, 'Jadikan SPK', '15-jadikan-spk.png', async (dlg) => {
        await dlg.getByLabel('Odometer (km)').fill('12400')
        await dlg.getByLabel('Mekanik').selectOption({ label: 'Agus Setiawan' })
    })
    await k.goto(`${WEB}/admin/spk/baru`)
    await k.getByRole('searchbox', { name: 'Cari pelanggan' }).fill('B 1234')
    await k.getByRole('button', { name: 'B 1234 XYZ (Honda Vario 125)' }).waitFor()
    await foto(k, '16-spk-baru-cari.png')
    await k.getByRole('button', { name: 'B 1234 XYZ (Honda Vario 125)' }).click()
    await k.getByLabel('Keluhan').fill('Ganti oli, lampu rem belakang mati.')
    await k.getByLabel('Odometer (km)').fill('21030')
    await k.getByLabel('Mekanik').selectOption({ label: 'Agus Setiawan' })
    await foto(k, '17-spk-baru-form.png')
    await k.goto(`${WEB}/admin/spk/${d.spk.s3}`)
    await foto(k, '18-rincian-spk.png', { penuh: true })
    await fotoDialog(k, 'Tambah item', '19-tambah-item.png', async (dlg) => {
        await dlg.getByRole('button', { name: 'Sparepart', exact: true }).click()
        await dlg.getByRole('button', { name: /Kampas Rem Depan Vario/ }).click()
    })
    await fotoDialog(k, 'Ubah', '20-ubah-spk.png')
    await k.goto(`${WEB}/admin/spk/${d.spk.s4}`)
    const kartuBayar = k.locator('section').filter({ has: k.getByRole('heading', { name: 'Pembayaran', exact: true }) }).last()
    await k.getByLabel('Uang diterima').fill('250000')
    await foto(k, '21-pembayaran.png', { elemen: kartuBayar })
    const kartuWa = k.locator('section').filter({ has: k.getByRole('heading', { name: 'WhatsApp dan tautan lacak' }) }).last()
    await foto(k, '22-whatsapp.png', { elemen: kartuWa })
    await k.goto(`${WEB}/admin/spk/${d.spk.s1}`)
    await k.setViewportSize({ width: 420, height: 860 })
    await k.emulateMedia({ media: 'print' })
    await foto(k, '23-nota.png', { elemen: k.locator('#area-cetak') })
    await k.emulateMedia({ media: 'screen' })
    await k.setViewportSize(LAYAR)
    await k.goto(`${WEB}/admin/pelanggan`)
    await foto(k, '24-pelanggan.png')
    await k.goto(`${WEB}/admin/pelanggan/${d.pelanggan['Budi Santoso'].customerId}`)
    await foto(k, '25-pelanggan-rincian.png')

    // Mekanik
    const m = await masuk(browser, MEKANIK[0])
    await jeda(m)
    await foto(m, '26-mekanik-papan.png')
    await m.goto(`${WEB}/admin/spk/${d.spk.s3}`)
    await m.getByLabel('Diagnosis').fill('V-belt retak dan roller aus; v-belt diganti, roller masih layak.')
    await foto(m, '27-mekanik-spk.png')

    // Pelanggan, ukuran HP
    const hp = await (await browser.newContext(HP)).newPage()
    await hp.goto(`${WEB}/`)
    await foto(hp, '28-hp-depan.png')
    await hp.goto(`${WEB}/booking`)
    await hp.getByLabel('Nama').fill('Rina Kusuma')
    await hp.getByLabel('Nomor WhatsApp').fill('0812-7000-1234')
    await hp.getByRole('radio', { name: 'Motor' }).check({ force: true })
    await hp.getByLabel('Plat nomor').fill('B 4455 RK')
    await hp.getByLabel('Merek').fill('Honda')
    await hp.getByLabel('Tipe').fill('PCX 160')
    await foto(hp, '29-hp-booking.png')
    await hp.goto(`${WEB}/booking/${d.booking.menunggu.token}`)
    await foto(hp, '30-hp-status-booking.png')
    await hp.goto(`${WEB}/servis/${d.lacak.s4}`)
    await foto(hp, '31-hp-lacak.png')
}

async function main() {
    fs.mkdirSync(KELUAR, { recursive: true })
    const browser = await chromium.launch()
    try {
        // Pemasangan awal dipotret selagi database masih kosong, sebelum diisi.
        const awal = await (await browser.newContext({ viewport: LAYAR })).newPage()
        await awal.goto(`${WEB}/admin/setup`)
        await foto(awal, '01-pemasangan.png')
        console.log('mengisi bengkel contoh...')
        const data = await isiData()
        await awal.goto(`${WEB}/admin/masuk`)
        await foto(awal, '02-masuk.png')
        await potret(browser, data)
    } finally {
        await browser.close()
    }
}

module.exports = { isiData, PEMILIK, KASIR, MEKANIK }

if (require.main === module) {
    main().catch((e) => {
        console.error(e)
        process.exit(1)
    })
}
