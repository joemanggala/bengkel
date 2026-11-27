// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

import { bacaEnv } from './env';
import { buktikanDatabaseBackend, cekDatabase, pastikanWaPalsu, tungguBackend, type LayananHidup } from './persiapan';
import { bundelSpec } from './spec';

// Urutan sengaja dari yang paling murah: kesalahan konfigurasi (env, spec,
// database, WhatsApp palsu) muncul sebelum harness menunggu backend sampai
// batas waktunya. WhatsApp palsu harus sudah menyala sebelum backend diuji,
// karena pembuktian awal membuat SPK yang langsung mengirim pesan.
export default async function persiapanGlobal(): Promise<() => Promise<void>> {
  const env = bacaEnv();
  await bundelSpec();
  await cekDatabase(env);
  let wa: LayananHidup | undefined;
  try {
    wa = await pastikanWaPalsu(env);
    await tungguBackend(env);
    await buktikanDatabaseBackend(env);
  } catch (galat) {
    await wa?.tutup();
    throw galat;
  }
  return async () => {
    await wa?.tutup();
  };
}
