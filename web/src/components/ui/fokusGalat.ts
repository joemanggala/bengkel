// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Memindahkan fokus papan ketik ke kolom pertama yang bermasalah sesudah form ditolak.
//
// Selama form dikirim, kolom dan tombolnya dikunci (disabled). Elemen yang terkunci kehilangan
// fokus dan tidak mendapatkannya kembali saat dibuka lagi, sehingga pengguna papan ketik terlempar
// ke awal halaman dan tombol Esc tidak lagi menutup dialog. Fokus karenanya dipasang sengaja:
// ke kolom pertama yang galat, atau, bila galatnya untuk seluruh form, ke tombol kirim.

// `urutan` = nama field menurut urutan di layar; `idDari` mengubah nama field menjadi id elemen.
// Ditunda sebentar supaya kolom yang baru dibuka kuncinya sudah dirender ulang.
export function fokusKolomGalat(
    urutan: readonly string[],
    galat: Record<string, string>,
    idDari: (nama: string) => string,
    idCadangan?: string,
): void {
    const nama = urutan.find((n) => n in galat)
    const id = nama ? idDari(nama) : idCadangan
    if (!id) return
    window.setTimeout(() => document.getElementById(id)?.focus(), 60)
}
