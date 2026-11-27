// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Membaca searchParams halaman dengan curiga: nilainya bisa hilang, ganda (?a=1&a=2), atau
// diketik tangan. Nilai yang tidak sah diganti bawaan, bukan diteruskan ke API sebagai 422.

type NilaiQuery = string | string[] | undefined

export const ambilTeks = (nilai: NilaiQuery): string => {
    const teks = Array.isArray(nilai) ? nilai[0] : nilai
    return (teks ?? '').trim()
}

// Nomor halaman 1..1.000.000 (batas parameter page di spec).
export const ambilHalaman = (nilai: NilaiQuery): number => {
    const teks = ambilTeks(nilai)
    if (!/^[0-9]{1,7}$/.test(teks)) return 1
    const angka = Number(teks)
    return angka >= 1 && angka <= 1_000_000 ? angka : 1
}

// Pilihan jumlah baris per halaman di tabel. Batas atasnya 50 karena parameter limit di spec hanya
// menerima 1..50; nilai di luar pilihan (ketikan tangan, alamat lama) dianggap bawaan.
export const UKURAN_PILIHAN = [10, 20, 50] as const
export const UKURAN_BAWAAN = 20

export const ambilUkuran = (nilai: NilaiQuery, bawaan: number = UKURAN_BAWAAN): number => {
    const teks = ambilTeks(nilai)
    if (!/^[0-9]{1,3}$/.test(teks)) return bawaan
    const angka = Number(teks)
    return (UKURAN_PILIHAN as readonly number[]).includes(angka) ? angka : bawaan
}

// Nomor urut baris pertama di halaman ini: halaman 2 dengan 20 baris dimulai dari 21. Dipakai
// kolom "No" di tabel.
export const nomorAwal = (meta: { page: number; limit: number }): number =>
    (meta.page - 1) * meta.limit + 1

export const jumlahHalaman = (meta: { limit: number; total: number }): number =>
    Math.max(1, Math.ceil(meta.total / meta.limit))

// "Menampilkan 21–40 dari 45" untuk bilah bawah tabel.
export const rentangTampil = (meta: { page: number; limit: number; total: number }): string => {
    if (meta.total === 0) return 'Tidak ada data'
    const awal = nomorAwal(meta)
    if (awal > meta.total) return `${meta.total} data`
    return `Menampilkan ${awal}–${Math.min(meta.page * meta.limit, meta.total)} dari ${meta.total}`
}

// Menyusun alamat dengan query, membuang yang kosong: ("/admin/pelanggan", {search: "", page: 2})
// -> "/admin/pelanggan?page=2".
export const alamatDenganQuery = (
    path: string,
    query: Record<string, string | number | undefined>,
): string => {
    const param = new URLSearchParams()
    for (const [kunci, nilai] of Object.entries(query)) {
        if (nilai !== undefined && nilai !== '') param.set(kunci, String(nilai))
    }
    const teks = param.toString()
    return teks ? `${path}?${teks}` : path
}
