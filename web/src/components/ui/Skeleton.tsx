// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Kerangka abu-abu berdenyut selama data dimuat. Tinggi dan lebarnya ditentukan pemanggil lewat
// className, sebaiknya sama dengan isi aslinya supaya halaman tidak melompat saat data tiba.
// Denyutnya mati sendiri bila pengguna meminta gerakan dikurangi (lihat globals.css).
export default function Skeleton({ className = 'h-5 w-full' }: { className?: string }) {
    return (
        <div
            aria-hidden="true"
            className={`animate-pulse rounded-md bg-garis motion-reduce:animate-none ${className}`}
        />
    )
}

// Kerangka satu kartu SPK di papan servis: nomor, plat, dua baris keterangan, dan lencana.
export function SkeletonKartu() {
    return (
        <div
            role="status"
            aria-label="Memuat"
            className="space-y-3 rounded-xl border border-garis bg-permukaan p-4"
        >
            <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
        </div>
    )
}

// Kerangka tabel: kepala dan beberapa baris.
export function SkeletonTabel({ baris = 5 }: { baris?: number }) {
    return (
        <div
            role="status"
            aria-label="Memuat"
            className="space-y-3 rounded-xl border border-garis bg-permukaan p-4"
        >
            <Skeleton className="h-5 w-full bg-utama-pucat" />
            {Array.from({ length: baris }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
            ))}
        </div>
    )
}
