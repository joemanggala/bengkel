// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { JUDUL_LANGKAH, LANGKAH_BOOKING } from '@/constants/konten'

// Langkah booking di halaman depan. Isinya dari src/constants/konten.ts (keputusan rancangan
// nomor 13), jadi pembeli cukup mengedit berkas itu. Berupa daftar bernomor supaya urutannya
// juga terbaca pembaca layar.
export default function LangkahBooking() {
    return (
        <section aria-labelledby="judul-langkah">
            <h2 id="judul-langkah" className="text-xl font-bold">
                {JUDUL_LANGKAH}
            </h2>
            <ol className="mt-4 space-y-3">
                {LANGKAH_BOOKING.map((langkah, i) => (
                    <li
                        key={langkah.judul}
                        className="flex gap-4 rounded-2xl border border-garis bg-permukaan p-4"
                    >
                        <span
                            aria-hidden="true"
                            className="angka grid h-9 w-9 shrink-0 place-items-center rounded-full bg-utama-pucat font-bold text-utama-tua"
                        >
                            {i + 1}
                        </span>
                        <div className="min-w-0">
                            <p className="font-bold leading-snug">{langkah.judul}</p>
                            <p className="mt-1 leading-relaxed text-redup">{langkah.isi}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    )
}
