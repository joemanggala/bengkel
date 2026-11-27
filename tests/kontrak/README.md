# Tes kontrak

Satu suite Vitest yang dijalankan sama persis terhadap backend Laravel, Go, dan NestJS.
Setiap respons divalidasi otomatis terhadap `spec/openapi.yaml` (kode status, header wajib,
media type, skema tertutup), dan pesan WhatsApp dibandingkan huruf demi huruf dengan
`spec/whatsapp.md`.

```sh
npm ci
npm run cek-harness                       # tanpa backend: database uji, WA palsu, format, validator, header
npm run typecheck
npm run lint-spec
BASE_URL=http://localhost:8882 npm test   # Laravel (Go 8881, NestJS 8883)
```

Env harness, env wajib backend uji, dan cara menguji setup yang mati ada di
`docs/menjalankan.md` bagian "Tes kontrak". Contoh nilai env ada di `.env.example`.

| Folder | Isi |
|---|---|
| `src/` | harness: klien bertipe yang memvalidasi respons, akses database uji, pembuat data lewat API, format pesan WhatsApp dari spec, kendali WhatsApp palsu, persiapan global |
| `tes/` | satu berkas tes per area; `pembantu-<area>.ts` untuk pembantu khusus area |
| `fixtur/` | hash bcrypt lintas backend untuk sandi uji |
