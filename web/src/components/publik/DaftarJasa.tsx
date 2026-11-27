// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import Link from 'next/link'
import { PATH_BOOKING } from '@/constants/publik'
import type { JasaPublik } from '@/skema/jasa'
import { formatRupiah } from '@/utils/format'

// "90 menit", "2 jam", "1 jam 30 menit".
export const formatDurasi = (menit: number): string => {
    const jam = Math.floor(menit / 60)
    const sisa = menit % 60
    if (jam === 0) return `${sisa} menit`
    return sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`
}

// Jasa dan harga di halaman depan, dari GET /api/public/services (hanya jasa aktif yang tampil
// di website, urut seperti diatur pemilik). Setiap kartu membuka form booking dengan jasa itu
// sudah terpilih.
export default function DaftarJasa({ jasa }: { jasa: readonly JasaPublik[] }) {
    return (
        <section aria-labelledby="judul-jasa">
            <h2 id="judul-jasa" className="text-xl font-bold">
                Jasa dan harga
            </h2>
            {jasa.length === 0 ? (
                <p className="mt-3 text-redup">
                    Daftar jasa belum diisi bengkel. Tetap bisa booking dan tulis keluhanmu.
                </p>
            ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {jasa.map((j) => (
                        <li key={j.serviceId} className="grid">
                            <Link
                                href={`${PATH_BOOKING}?jasa=${j.serviceId}`}
                                className="flex flex-col rounded-2xl border border-garis bg-permukaan p-4 transition-colors hover:border-utama"
                            >
                                <span className="font-bold leading-snug">{j.name}</span>
                                {j.description && (
                                    <span className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-redup">
                                        {j.description}
                                    </span>
                                )}
                                <span className="mt-auto flex items-baseline justify-between gap-3 pt-3">
                                    <span className="angka text-lg font-bold text-utama-tua">
                                        {formatRupiah(j.price)}
                                    </span>
                                    {j.durationMinutes !== null && (
                                        <span className="text-sm text-redup">
                                            ± {formatDurasi(j.durationMinutes)}
                                        </span>
                                    )}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <p className="mt-3 text-sm text-redup">
                Harga jasa belum termasuk sparepart yang dibutuhkan.
            </p>
        </section>
    )
}
