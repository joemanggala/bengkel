// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

'use client'

type Props<T extends string> = {
    label: string
    opsi: readonly { nilai: T; label: string; jumlah?: number }[]
    nilai: T
    onUbah: (nilai: T) => void
}

// Deretan tombol penyaring di bawah pita judul (Aktif/Riwayat, status booking). Tombol yang
// sedang dipakai ditandai aria-pressed, bukan hanya warna. Bisa digulir menyamping di HP.
export default function Tab<T extends string>({ label, opsi, nilai, onUbah }: Props<T>) {
    return (
        <div
            role="group"
            aria-label={label}
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        >
            {opsi.map((o) => {
                const aktif = o.nilai === nilai
                return (
                    <button
                        key={o.nilai}
                        type="button"
                        aria-pressed={aktif}
                        onClick={() => onUbah(o.nilai)}
                        className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold transition-colors ${
                            aktif
                                ? 'border-utama-tua bg-utama text-white'
                                : 'border-garis-kuat bg-permukaan text-tinta hover:bg-latar'
                        }`}
                    >
                        {o.label}
                        {o.jumlah !== undefined && (
                            <span
                                className={`angka rounded-full px-2 text-sm ${aktif ? 'bg-white/20' : 'bg-latar'}`}
                            >
                                {o.jumlah}
                            </span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
