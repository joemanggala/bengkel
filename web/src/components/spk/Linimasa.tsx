// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { LABEL_STATUS_SPK, type StatusSpk } from '@/skema/spk'
import { formatWaktuWib } from '@/utils/format'

type Baris = {
    toStatus: StatusSpk
    createdAt: string
    // Hanya di panel staf: siapa yang mengubah dan catatannya. Halaman lacak tidak memilikinya.
    by?: { name: string }
    note?: string
}

// Linimasa status SPK, terbaru di bawah seperti urutan dari API. Dipakai rincian SPK (dengan nama
// staf dan catatan) dan halaman lacak pelanggan (tanpa keduanya).
export default function Linimasa({ baris }: { baris: readonly Baris[] }) {
    return (
        <ol className="relative space-y-4 border-l-2 border-garis pl-5">
            {baris.map((b, i) => (
                <li key={`${b.toStatus}-${b.createdAt}-${i}`} className="relative">
                    <span
                        aria-hidden="true"
                        className={`absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-permukaan ${
                            i === baris.length - 1 ? 'bg-utama' : 'bg-garis-kuat'
                        }`}
                    />
                    <p className="font-semibold leading-snug">{LABEL_STATUS_SPK[b.toStatus]}</p>
                    <p className="text-sm text-redup">
                        {formatWaktuWib(b.createdAt)}
                        {b.by && ` · ${b.by.name}`}
                    </p>
                    {b.note && (
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{b.note}</p>
                    )}
                </li>
            ))}
        </ol>
    )
}
