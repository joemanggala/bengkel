#!/usr/bin/env bash
# Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
# Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

# Menjalankan tes kontrak (tests/kontrak) terhadap backend Laravel dalam satu
# perintah: menyalakan backend dengan env uji (php artisan bengkel:serve),
# menjalankan Vitest, lalu mematikan backend lagi.
#
# Pakai (dari folder mana pun):
#   backend-laravel/scripts/uji-kontrak.sh [DB_UJI] [PORT_BACKEND] [PORT_WA_PALSU] [argumen vitest...]
#
# Bawaan: bengkel_uji_laravel 8882 8892, yaitu pasangan resmi backend Laravel di
# docs/menjalankan.md. Database uji harus sudah dimigrasi dan namanya
# bengkel_uji atau berawalan bengkel_uji_ (harness menolak yang lain):
#   docker compose run --rm migrate-uji-laravel up
# WhatsApp palsu dinyalakan harness sendiri bila belum hidup di port itu.
# Untuk menguji setup yang mati:
#   SETUP_TOKEN= backend-laravel/scripts/uji-kontrak.sh bengkel_uji_laravel 8882 8892 tes/setup.test.ts
#
# Server bawaan PHP melayani satu permintaan sekaligus, jadi tes serentak tidak
# membuktikan penguncian di sini; ujilah di Nginx + php-cgi (scripts/uji-serentak.sh).

set -u

DB="${1:-bengkel_uji_laravel}"
PORT="${2:-8882}"
WA_PORT="${3:-8892}"
shift $(( $# > 3 ? 3 : $# ))

AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Di Windows (Git Bash), PHP dan Node butuh path bergaya D:/..., bukan /d/...
akar_asli="$AKAR"
if (cd "$AKAR" && pwd -W >/dev/null 2>&1); then
  akar_asli="$(cd "$AKAR" && pwd -W)"
fi

# Nilai uji bersama, sama dengan harness (tests/kontrak/src/env.ts).
WA_TOKEN="${WA_TOKEN:-token-wa-uji-bengkel-bukan-kunci-asli}"
SETUP_TOKEN="${SETUP_TOKEN-token-setup-uji-bengkel-bukan-rahasia}"
PUBLIC_WEB_URL="${PUBLIC_WEB_URL:-http://localhost:3880}"
# 127.0.0.1, bukan localhost: di Windows "localhost" diterjemahkan ke ::1 lebih
# dulu, MySQL di Docker tidak mendengarkan di sana, dan PHP menunggu ±2 detik
# sebelum mencoba 127.0.0.1 pada SETIAP koneksi database.
DATABASE_URL="mysql://bengkel:bengkel@127.0.0.1:3350/$DB"
LOG="$akar_asli/backend-laravel/storage/logs/api-$PORT.log"

mkdir -p "$AKAR/backend-laravel/storage/logs"

echo "== menyalakan backend Laravel di :$PORT (database $DB, WhatsApp palsu :$WA_PORT)"
cd "$AKAR/backend-laravel" || exit 1
PORT="$PORT" DATABASE_URL="$DATABASE_URL" WA_API_URL="http://localhost:$WA_PORT/send" \
  WA_TOKEN="$WA_TOKEN" SETUP_TOKEN="$SETUP_TOKEN" PUBLIC_WEB_URL="$PUBLIC_WEB_URL" \
  php artisan bengkel:serve >"$LOG" 2>&1 &
PID=$!

# `php artisan bengkel:serve` menjalankan server bawaan PHP sebagai proses
# anak. Mematikan proses induk saja membiarkan anaknya tetap memegang port,
# jadi seluruh pohon prosesnya dimatikan: taskkill /T di Windows, anak
# langsung lewat pkill di macOS dan Linux.
matikan_backend() {
  if command -v taskkill >/dev/null 2>&1; then
    taskkill //F //T //PID "$(cat "/proc/$PID/winpid" 2>/dev/null || echo "$PID")" >/dev/null 2>&1
  else
    pkill -P "$PID" 2>/dev/null
    kill "$PID" 2>/dev/null
  fi
  wait "$PID" 2>/dev/null
}
trap matikan_backend EXIT

# Backend gagal menyala (env atau database salah) → berhenti dengan pesannya.
for _ in $(seq 1 100); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "== backend gagal menyala:"
    cat "$LOG"
    exit 1
  fi
  if grep -q "backend bengkel siap" "$LOG" 2>/dev/null; then
    break
  fi
  sleep 0.3
done

echo "== menjalankan tes kontrak"
cd "$AKAR/tests/kontrak" || exit 1
BASE_URL="http://localhost:$PORT" BENGKEL_BASE_URL="http://localhost:$PORT" DATABASE_URL="$DATABASE_URL" \
  WA_PALSU_URL="http://localhost:$WA_PORT" WA_TOKEN="$WA_TOKEN" SETUP_TOKEN="$SETUP_TOKEN" \
  PUBLIC_WEB_URL="$PUBLIC_WEB_URL" npx vitest run "$@"
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  echo "== 30 baris terakhir log backend ($LOG)"
  tail -n 30 "$LOG"
fi
exit "$STATUS"
