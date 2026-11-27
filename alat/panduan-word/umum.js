// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Bahan bersama keempat panduan Word: gaya, logo toko, dan potongan isi (paragraf, langkah
// bernomor, tabel, kotak catatan, blok perintah, tangkapan layar).

const fs = require('fs')
const path = require('path')
const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
    WidthType, ShadingType, BorderStyle, LevelFormat, TableOfContents, Footer, Header, PageNumber,
    TabStopType, ImageRun,
} = require('docx')

const LEBAR = 9638 // A4 dengan margin 2 cm
// Warna brand kit toko: Biru Tua untuk judul dan kepala tabel, Langit untuk latar lembut.
const WARNA = '1F5FD1'
const WARNA_MUDA = 'EEF2FF'
const KUNING = 'FFC83D'
const WARNA_CATATAN = 'FFF4D6'
const GARIS = 'B4C6E7'
const LATAR_KODE = 'F3F4F6'

// Brand kit sama dengan yang dibaca alat kemas-varian (env KEMAS_BRAND_KIT).
function bacaLogo() {
    const akar = process.env.KEMAS_BRAND_KIT || 'D:/KODE_BELAJAR/kodecoding-brand-kit'
    for (const calon of [
        path.join(akar, 'kodecoding-brand-kit', '01-logo', 'png', 'kodecoding-logo-horizontal.png'),
        path.join(akar, '01-logo', 'png', 'kodecoding-logo-horizontal.png'),
    ]) {
        if (fs.existsSync(calon)) return fs.readFileSync(calon)
    }
    throw new Error(`logo tidak ditemukan di brand kit ${akar}; isi env KEMAS_BRAND_KIT`)
}
const LOGO = bacaLogo()
// Logo horizontal 1773 × 256 px; lebar dalam piksel dokumen (96 dpi).
const logo = (lebar) =>
    new ImageRun({
        type: 'png',
        data: LOGO,
        transformation: { width: lebar, height: Math.round((lebar * 256) / 1773) },
        altText: { title: 'Logo KodeCoding', description: 'Logo KodeCoding', name: 'logo-kodecoding' },
    })

// Teks dengan **tebal** dan `kode` sederhana.
function runs(teks, opsi = {}) {
    return teks
        .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
        .filter(Boolean)
        .map((b) => {
            if (b.startsWith('**')) return new TextRun({ text: b.slice(2, -2), bold: true, ...opsi })
            if (b.startsWith('`')) {
                return new TextRun({
                    text: b.slice(1, -1),
                    font: 'Consolas',
                    size: 20,
                    shading: { type: ShadingType.CLEAR, fill: LATAR_KODE, color: 'auto' },
                    ...opsi,
                })
            }
            return new TextRun({ text: b, ...opsi })
        })
}

const jarak = () => new Paragraph({ children: [], spacing: { after: 60 } })

// Kalimat pengantar yang diakhiri titik dua selalu satu halaman dengan isi sesudahnya.
const p = (teks, opsi = {}) =>
    new Paragraph({ children: runs(teks), spacing: { after: 120 }, keepNext: teks.trim().endsWith(':'), ...opsi })
const h1 = (teks) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(teks)] })
const h2 = (teks) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(teks)] })
const h3 = (teks) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(teks)] })
const titik = (teks, level = 0) =>
    new Paragraph({ numbering: { reference: 'titik', level }, children: runs(teks), spacing: { after: 60 } })

// Langkah bernomor; larik di dalamnya menjadi butir anak langkah sebelumnya. Setiap panggilan
// mulai lagi dari 1.
let nomorDaftar = 0
function langkah(daftar) {
    const instance = ++nomorDaftar
    const hasil = []
    for (const item of daftar) {
        if (Array.isArray(item)) {
            for (const sub of item) hasil.push(titik(sub, 1))
        } else {
            hasil.push(
                new Paragraph({
                    numbering: { reference: 'angka', level: 0, instance },
                    children: runs(item),
                    spacing: { after: 60 },
                }),
            )
        }
    }
    return hasil
}

const tanpaGaris = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

function kotak(judul, isi, warna = WARNA_CATATAN) {
    const sel = new TableCell({
        width: { size: LEBAR, type: WidthType.DXA },
        shading: { fill: warna, type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 120, bottom: 120, left: 180, right: 180 },
        borders: {
            top: tanpaGaris,
            bottom: tanpaGaris,
            right: tanpaGaris,
            left: { style: BorderStyle.SINGLE, size: 24, color: KUNING },
        },
        children: [
            new Paragraph({ keepNext: true, children: [new TextRun({ text: judul, bold: true })], spacing: { after: 60 } }),
            ...isi.map((t) => new Paragraph({ children: runs(t), spacing: { after: 40 } })),
        ],
    })
    return [
        new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [LEBAR], rows: [new TableRow({ cantSplit: true, children: [sel] })] }),
        jarak(),
    ]
}
const info = (judul, isi) => kotak(judul, isi, WARNA_MUDA)

// Blok perintah atau isi berkas: satu baris teks = satu paragraf, huruf Consolas. Baris yang
// diawali # tampil abu-abu sebagai komentar.
function kode(teks, judul) {
    const baris = teks.replace(/\n$/, '').split('\n')
    // Kira-kira 85 karakter muat di 9 pt; blok yang lebih lebar memakai 8 pt supaya tidak terlipat.
    const ukuran = Math.max(...baris.map((b) => b.length)) > 85 ? 16 : 18
    const isi = baris.map(
        (b, i) =>
            new Paragraph({
                keepNext: i < baris.length - 1,
                spacing: { after: 0, line: 240 },
                children: [
                    new TextRun({
                        text: b === '' ? ' ' : b,
                        font: 'Consolas',
                        size: ukuran,
                        color: /^\s*[#;]/.test(b) ? '6B7280' : '111827',
                    }),
                ],
            }),
    )
    const sel = new TableCell({
        width: { size: LEBAR, type: WidthType.DXA },
        shading: { fill: LATAR_KODE, type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        borders: { top: tanpaGaris, bottom: tanpaGaris, right: tanpaGaris, left: { style: BorderStyle.SINGLE, size: 18, color: WARNA } },
        children: isi,
    })
    const hasil = []
    if (judul) {
        hasil.push(
            new Paragraph({
                keepNext: true,
                spacing: { before: 60, after: 40 },
                children: [new TextRun({ text: judul, italics: true, size: 18, color: '6B7280' })],
            }),
        )
    }
    // Blok pendek tidak dipotong di tengah; blok panjang boleh berlanjut ke halaman berikutnya.
    hasil.push(
        new Table({
            width: { size: LEBAR, type: WidthType.DXA },
            columnWidths: [LEBAR],
            rows: [new TableRow({ cantSplit: baris.length <= 25, children: [sel] })],
        }),
        jarak(),
    )
    return hasil
}

function tabel(judul, baris, lebarKolom) {
    const total = lebarKolom.reduce((a, b) => a + b, 0)
    const kolom = lebarKolom.map((l) => Math.round((l / total) * LEBAR))
    kolom[kolom.length - 1] += LEBAR - kolom.reduce((a, b) => a + b, 0)
    const garis = { style: BorderStyle.SINGLE, size: 4, color: GARIS }
    const batas = { top: garis, bottom: garis, left: garis, right: garis }
    const sel = (teks, i, kepala, tempel = true) =>
        new TableCell({
            width: { size: kolom[i], type: WidthType.DXA },
            borders: batas,
            shading: kepala ? { fill: WARNA, type: ShadingType.CLEAR, color: 'auto' } : undefined,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
                new Paragraph({
                    keepNext: tempel,
                    children: kepala ? [new TextRun({ text: teks, bold: true, color: 'FFFFFF' })] : runs(teks),
                }),
            ],
        })
    // Tabel pendek tidak terpotong: setiap baris kecuali terakhir menempel ke baris berikutnya.
    const tempelSemua = baris.length <= 12
    return [
        new Table({
            width: { size: LEBAR, type: WidthType.DXA },
            columnWidths: kolom,
            rows: [
                new TableRow({ tableHeader: true, children: judul.map((t, i) => sel(t, i, true)) }),
                ...baris.map(
                    (b, r) =>
                        new TableRow({
                            cantSplit: true,
                            children: b.map((t, i) => sel(t, i, false, tempelSemua && r < baris.length - 1)),
                        }),
                ),
            ],
        }),
        jarak(),
    ]
}


// Tangkapan layar (PNG) dari gambar/. Lebar dalam piksel dokumen (maks. sekitar 600 untuk A4);
// tingginya dihitung dari ukuran asli di kepala PNG. Keterangan ditulis di bawah gambar.
const GAMBAR = path.join(__dirname, 'gambar')
function gambar(berkas, keterangan, lebar = 560) {
    const jalur = path.join(GAMBAR, berkas)
    if (!fs.existsSync(jalur)) throw new Error('tangkapan layar tidak ada: ' + jalur + ' (jalankan "npm run tangkap", lihat README)')
    const data = fs.readFileSync(jalur)
    const asliLebar = data.readUInt32BE(16)
    const asliTinggi = data.readUInt32BE(20)
    return [
        new Paragraph({
            keepNext: true,
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 60 },
            children: [
                new ImageRun({
                    type: 'png',
                    data,
                    transformation: { width: lebar, height: Math.round((lebar * asliTinggi) / asliLebar) },
                    altText: { title: keterangan, description: keterangan, name: berkas },
                }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: keterangan, italics: true, size: 18, color: '6B7280' })],
        }),
    ]
}

// Beberapa tangkapan layar HP berdampingan dalam satu baris tanpa garis. daftar: [[berkas, keterangan], ...].
function gambarSejajar(daftar, lebar = 190) {
    const kolom = Math.floor(LEBAR / daftar.length)
    const tanpa = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    const batas = { top: tanpa, bottom: tanpa, left: tanpa, right: tanpa }
    const sel = daftar.map(([berkas, keterangan]) => {
        const jalur = path.join(GAMBAR, berkas)
        if (!fs.existsSync(jalur)) throw new Error('tangkapan layar tidak ada: ' + jalur)
        const data = fs.readFileSync(jalur)
        const tinggi = Math.round((lebar * data.readUInt32BE(20)) / data.readUInt32BE(16))
        return new TableCell({
            width: { size: kolom, type: WidthType.DXA },
            borders: batas,
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    keepNext: true,
                    children: [new ImageRun({ type: 'png', data, transformation: { width: lebar, height: tinggi }, altText: { title: keterangan, description: keterangan, name: berkas } })],
                }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: keterangan, italics: true, size: 18, color: '6B7280' })] }),
            ],
        })
    })
    return [
        new Table({ width: { size: kolom * daftar.length, type: WidthType.DXA }, columnWidths: daftar.map(() => kolom), rows: [new TableRow({ cantSplit: true, children: sel })] }),
        jarak(),
    ]
}

function tanyaJawab(daftar) {
    return daftar.flatMap(([t, j]) => [
        new Paragraph({
            children: [new TextRun({ text: t, bold: true, color: WARNA })],
            spacing: { before: 160, after: 60 },
            keepNext: true,
        }),
        p(j),
    ])
}

function sampul({ label, judul, subjudul, ringkasan }) {
    return [
        new Paragraph({ children: [logo(220)], spacing: { after: 0 } }),
        new Paragraph({ children: [], spacing: { before: 2600 } }),
        new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 28, color: '7F7F7F' })], spacing: { after: 120 } }),
        new Paragraph({ children: [new TextRun({ text: judul, bold: true, size: 60, color: WARNA })], spacing: { after: 240 } }),
        new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: WARNA, space: 8 } },
            children: [new TextRun({ text: subjudul, size: 28 })],
            spacing: { after: 480 },
        }),
        ...ringkasan.map((t) => p(t)),
        new Paragraph({ children: [], spacing: { before: 2000 } }),
        p('Versi 1.0'),
        p('Disusun oleh **KodeCoding**, Belajar dengan Praktek.'),
    ]
}

const daftarIsi = () => [
    new Paragraph({
        pageBreakBefore: true,
        spacing: { after: 240 },
        children: [new TextRun({ text: 'Daftar Isi', bold: true, size: 36, color: WARNA })],
    }),
    new TableOfContents('Daftar Isi', { hyperlink: true, headingStyleRange: '1-2' }),
]

// Daftar isi baru terisi setelah dibuka Word (lihat perbarui.ps1).
async function simpan({ keluar, judulDokumen, sampul: isiSampul, bab }) {
    const doc = new Document({
        creator: 'KodeCoding',
        lastModifiedBy: 'KodeCoding',
        title: judulDokumen,
        styles: {
            default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { line: 276 } } } },
            paragraphStyles: [
                {
                    id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 36, bold: true, color: WARNA },
                    paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 },
                },
                {
                    id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 28, bold: true, color: WARNA },
                    paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1, keepNext: true },
                },
                {
                    id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 24, bold: true, color: '404040' },
                    paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true },
                },
            ],
        },
        numbering: {
            config: [
                {
                    reference: 'titik',
                    levels: [
                        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
                    ],
                },
                {
                    reference: 'angka',
                    levels: [
                        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                    ],
                },
            ],
        },
        sections: [
            {
                properties: {
                    page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } },
                    titlePage: true,
                },
                headers: {
                    default: new Header({
                        children: [
                            new Paragraph({
                                tabStops: [{ type: TabStopType.RIGHT, position: LEBAR }],
                                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9', space: 4 } },
                                children: [logo(110), new TextRun({ text: `\t${judulDokumen}`, size: 18, color: '7F7F7F' })],
                            }),
                        ],
                    }),
                    first: new Header({ children: [] }),
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ children: ['Halaman ', PageNumber.CURRENT], size: 18, color: '7F7F7F' })],
                            }),
                        ],
                    }),
                    first: new Footer({ children: [] }),
                },
                children: [...isiSampul.flat(Infinity), ...daftarIsi(), ...bab.flat(Infinity)],
            },
        ],
    })
    fs.writeFileSync(keluar, await Packer.toBuffer(doc))
    console.log(`tersimpan ${keluar}`)
}

module.exports = { p, h1, h2, h3, titik, langkah, kotak, info, kode, tabel, tanyaJawab, gambar, gambarSejajar, sampul, simpan, jarak, WARNA, WARNA_MUDA, LEBAR }
