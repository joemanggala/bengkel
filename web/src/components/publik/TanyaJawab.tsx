// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import Ikon from '@/components/ui/Ikon'
import { JUDUL_TANYA_JAWAB, TANYA_JAWAB } from '@/constants/konten'

// Tanya jawab di halaman depan, isinya dari src/constants/konten.ts. Memakai <details> bawaan
// HTML: bisa dibuka-tutup tanpa JavaScript, dengan papan ketik, dan dibacakan pembaca layar,
// sementara isinya tetap ada di HTML sehingga terbaca mesin pencari.
export default function TanyaJawab() {
    return (
        <section aria-labelledby="judul-tanya-jawab">
            <h2 id="judul-tanya-jawab" className="text-xl font-bold">
                {JUDUL_TANYA_JAWAB}
            </h2>
            <div className="mt-4 divide-y divide-garis overflow-hidden rounded-2xl border border-garis bg-permukaan">
                {TANYA_JAWAB.map((item) => (
                    <details key={item.tanya} className="group">
                        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                            {item.tanya}
                            <Ikon
                                nama="bawah"
                                className="h-5 w-5 shrink-0 text-redup transition-transform group-open:rotate-180"
                            />
                        </summary>
                        <p className="px-4 pb-4 leading-relaxed text-redup">{item.jawab}</p>
                    </details>
                ))}
            </div>
        </section>
    )
}
