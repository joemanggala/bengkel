// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { ReactNode } from 'react'

export type KolomTabel<T> = {
    kunci: string
    judul: string
    // indeks = urutan baris di halaman ini, mulai dari 0.
    isi: (baris: T, indeks: number) => ReactNode
    // Angka uang rata kanan dengan digit sama lebar, supaya mudah dibandingkan.
    angka?: boolean
    // Kolom yang boleh disembunyikan di layar sempit (tablet tegak), mis. tanggal dibuat.
    sembunyiSempit?: boolean
    // Kelas tambahan untuk kepala dan selnya, mis. lebar tetap.
    kelas?: string
}

type Props<T> = {
    // Dibacakan pembaca layar sebagai nama tabel, sekaligus nama wilayah gulirnya.
    keterangan: string
    kolom: KolomTabel<T>[]
    baris: T[]
    kunciBaris: (baris: T) => string
    kosong?: ReactNode
    // Bilah di dasar kartu, di bawah garis pemisah, mis. <Paginasi /> berisi baris per halaman.
    bawah?: ReactNode
    // Nomor urut baris pertama. Diisi = ada kolom "No" paling kiri; untuk daftar berhalaman
    // isinya nomorAwal(meta) supaya halaman 2 tidak mulai lagi dari 1.
    nomorAwal?: number
}

// Kelas sel yang bergantung pada kolom: rata angka, kolom yang disembunyikan di layar sempit,
// dan kelas tambahan milik kolom itu sendiri.
const kelasKolom = (kolom: { angka?: boolean; sembunyiSempit?: boolean; kelas?: string }): string =>
    [
        kolom.angka ? 'text-right angka' : 'text-left',
        kolom.sembunyiSempit ? 'hidden lg:table-cell' : '',
        kolom.kelas ?? '',
    ]
        .filter(Boolean)
        .join(' ')

// Bantalan kolom pertama dan terakhir dilebihkan (sm:pl-6 / sm:pr-6) supaya isi tabel lurus
// dengan tepi kiri dan kanan pita judul di atasnya.
const kelasUjung = (i: number, jumlah: number): string =>
    `${i === 0 ? 'sm:pl-6' : ''} ${i === jumlah - 1 ? 'sm:pr-6' : ''}`

// Tabel data bergaya panel: kartu bersudut membulat, kepala bernada pucat, garis
// tipis antarbaris, dan baris cukup tinggi untuk diketuk. Bila lebih lebar dari layar, tabel
// bergulir di dalam wadahnya, bukan seluruh halaman.
export default function Tabel<T>({
    keterangan,
    kolom: kolomIsi,
    baris,
    kunciBaris,
    kosong,
    bawah,
    nomorAwal,
}: Props<T>) {
    const kolom: KolomTabel<T>[] =
        nomorAwal === undefined
            ? kolomIsi
            : [
                  {
                      kunci: 'no',
                      judul: 'No',
                      kelas: 'w-16',
                      isi: (_, indeks) => (
                          <span className="angka text-redup">{nomorAwal + indeks}</span>
                      ),
                  },
                  ...kolomIsi,
              ]
    return (
        <div className="overflow-hidden rounded-xl border border-garis bg-permukaan">
            {/* Wilayah gulir bisa difokus supaya pengguna papan ketik juga bisa menggulirnya. */}
            <div role="region" aria-label={keterangan} tabIndex={0} className="overflow-x-auto">
                <table className="min-w-full border-collapse text-[15px]">
                    <caption className="sr-only">{keterangan}</caption>
                    <thead className="bg-utama-pucat/50">
                        <tr>
                            {kolom.map((k, i) => (
                                <th
                                    key={k.kunci}
                                    scope="col"
                                    className={`whitespace-nowrap border-b border-garis px-4 py-3 text-sm font-semibold text-redup ${kelasKolom(k)} ${kelasUjung(i, kolom.length)}`}
                                >
                                    {k.judul}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-garis">
                        {baris.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={kolom.length}
                                    className="px-4 py-10 text-center text-redup"
                                >
                                    {kosong ?? 'Belum ada data.'}
                                </td>
                            </tr>
                        ) : (
                            baris.map((b, indeks) => (
                                <tr
                                    key={kunciBaris(b)}
                                    className="transition-colors hover:bg-latar/70"
                                >
                                    {kolom.map((k, i) => (
                                        <td
                                            key={k.kunci}
                                            className={`h-14 px-4 py-4 align-middle ${kelasKolom(k)} ${kelasUjung(i, kolom.length)}`}
                                        >
                                            {k.isi(b, indeks)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {bawah}
        </div>
    )
}
