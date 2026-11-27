// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import type { Pesan } from './keadaan';

function aman(teks: string): string {
  return teks
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function kartu(pesan: Pesan): string {
  return `<article>
  <p class="meta">#${pesan.nomor} · ${aman(pesan.waktu)}</p>
  <pre>${aman(pesan.pesan)}</pre>
</article>`;
}

// Pesan dikelompokkan per nomor tujuan. Nomor yang paling baru menerima
// pesan tampil paling atas, dan di dalam kelompok pesan terbaru di atas.
function kelompok(semua: Pesan[]): string {
  const perNomor = new Map<string, Pesan[]>();
  for (const pesan of [...semua].reverse()) {
    const daftar = perNomor.get(pesan.target) ?? [];
    daftar.push(pesan);
    perNomor.set(pesan.target, daftar);
  }
  return [...perNomor.entries()]
    .map(
      ([nomor, daftar]) => `<section>
<h2><a href="/?nomor=${encodeURIComponent(nomor)}">+${aman(nomor)}</a> <span class="meta">${daftar.length} pesan</span></h2>
${daftar.map(kartu).join('\n')}
</section>`,
    )
    .join('\n');
}

export function halamanDaftar(semua: Pesan[], nomor?: string): string {
  const tampil = nomor ? semua.filter((p) => p.target === nomor) : semua;
  const judul = nomor ? `Pesan untuk +${aman(nomor)}` : 'WhatsApp palsu';
  const kembali = nomor ? '<p class="catatan"><a href="/">Semua nomor</a></p>' : '';
  const isi =
    tampil.length === 0
      ? '<p class="kosong">Belum ada pesan. Buat SPK, tandai SPK Selesai, konfirmasi atau tolak booking, atau kirim nota dari rincian SPK; pesannya muncul di sini.</p>'
      : kelompok(tampil);
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="5">
<title>WhatsApp palsu</title>
<style>
  body { font-family: system-ui, sans-serif; background: #eef3ef; margin: 0; padding: 24px 16px; color: #1d2733; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 24px 0 8px; }
  a { color: #0b6b3a; }
  .catatan, .meta, .kosong { color: #5b6876; font-size: 14px; margin: 4px 0; font-weight: normal; }
  article { background: #fff; border-radius: 12px; padding: 12px 18px; margin: 10px 0; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  pre { white-space: pre-wrap; word-break: break-word; background: #f3faf5; padding: 12px; border-radius: 8px; font-size: 14px; margin: 8px 0 4px; }
  form { margin: 8px 0 0; }
  button { padding: 8px 14px; border: 0; border-radius: 8px; background: #b42318; color: #fff; cursor: pointer; }
</style>
</head>
<body><main>
<h1>${judul}</h1>
<p class="catatan">Semua pesan WhatsApp dari backend lokal tertangkap di sini dan tidak pernah sampai ke WhatsApp sungguhan. Halaman memuat ulang setiap 5 detik.</p>
${kembali}
<form method="post" action="/__kendali/reset"><button type="submit">Kosongkan</button></form>
${isi}
</main></body>
</html>`;
}
