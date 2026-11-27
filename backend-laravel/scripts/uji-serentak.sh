#!/usr/bin/env bash
# Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
# Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

# Menjalankan tes kontrak terhadap backend Laravel yang melayani permintaan
# BERSAMAAN: Nginx di depan beberapa proses php-cgi (FastCGI). Server bawaan
# PHP (bengkel:serve) hanya melayani satu permintaan sekaligus, jadi tes
# serentak (nomor SPK dan booking, stok terakhir, batas 3 booking menunggu,
# setup bersamaan, dua pemilik terakhir) baru bermakna di sini. Susunannya
# meniru produksi Nginx + PHP-FPM; di Windows tidak ada PHP-FPM, jadi dipakai
# beberapa php-cgi dengan upstream least_conn.
#
# Pakai (Git Bash, dari folder mana pun):
#   backend-laravel/scripts/uji-serentak.sh [DB_UJI] [PORT_BACKEND] [PORT_WA_PALSU] [argumen vitest...]
#
# Env opsional: NGINX (path nginx.exe/nginx), PHP_CGI (path php-cgi), JUMLAH_CGI
# (bawaan 6). Bawaan Laragon: C:/laragon/bin/nginx/nginx-*/nginx.exe dan
# php-cgi.exe di folder php yang sama dengan `php`.

set -u

DB="${1:-bengkel_uji_laravel}"
PORT="${2:-8882}"
WA_PORT="${3:-8892}"
shift $(( $# > 3 ? 3 : $# ))
JUMLAH_CGI="${JUMLAH_CGI:-6}"

AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
akar_asli="$AKAR"
if (cd "$AKAR" && pwd -W >/dev/null 2>&1); then
  akar_asli="$(cd "$AKAR" && pwd -W)"
fi

NGINX="${NGINX:-$(ls /c/laragon/bin/nginx/nginx-*/nginx.exe 2>/dev/null | head -n 1)}"
NGINX="${NGINX:-$(command -v nginx)}"
PHP_CGI="${PHP_CGI:-$(dirname "$(command -v php)")/php-cgi.exe}"
[ -x "$PHP_CGI" ] || PHP_CGI="$(command -v php-cgi)"
if [ -z "$NGINX" ] || [ -z "$PHP_CGI" ]; then
  echo "== nginx atau php-cgi tidak ditemukan; isi env NGINX dan PHP_CGI" >&2
  exit 1
fi

WA_TOKEN="${WA_TOKEN:-token-wa-uji-bengkel-bukan-kunci-asli}"
SETUP_TOKEN="${SETUP_TOKEN-token-setup-uji-bengkel-bukan-rahasia}"
PUBLIC_WEB_URL="${PUBLIC_WEB_URL:-http://localhost:3880}"
DATABASE_URL="mysql://bengkel:bengkel@127.0.0.1:3350/$DB"

# Folder kerja Nginx (konfigurasi, log, berkas sementara) di storage/logs, yang tidak dilacak git.
PREFIX="$AKAR/backend-laravel/storage/logs/nginx-uji-$PORT"
PREFIX_ASLI="$akar_asli/backend-laravel/storage/logs/nginx-uji-$PORT"
rm -rf "$PREFIX"
mkdir -p "$PREFIX/conf" "$PREFIX/logs" "$PREFIX/temp"

# Env backend diberikan ke proses php-cgi; Laravel membacanya lewat getenv.
# Tidak ada berkas .env yang dibaca bila env sudah ada di proses.
export PORT DATABASE_URL WA_TOKEN SETUP_TOKEN PUBLIC_WEB_URL
export WA_API_URL="http://localhost:$WA_PORT/send"
# php-cgi berhenti sesudah 500 permintaan bila tidak diatur, lalu Nginx membalas 502.
export PHP_FCGI_MAX_REQUESTS=0

PIDS=()
UPSTREAM=""
for i in $(seq 1 "$JUMLAH_CGI"); do
  CGI_PORT=$(( PORT + 1000 + i ))
  "$PHP_CGI" -b "127.0.0.1:$CGI_PORT" -d enable_post_data_reading=0 -d display_errors=0 -d log_errors=1 \
    -d expose_php=0 -d zend_extension=opcache -d opcache.enable=1 \
    >"$PREFIX/logs/cgi-$i.log" 2>&1 &
  PIDS+=("$!")
  UPSTREAM="$UPSTREAM        server 127.0.0.1:$CGI_PORT;
"
done

cat >"$PREFIX/conf/nginx.conf" <<KONF
worker_processes 1;
error_log logs/error.log warn;
pid logs/nginx.pid;
events { worker_connections 1024; }
http {
    access_log off;
    client_body_temp_path temp/body;
    fastcgi_temp_path temp/fastcgi;
    proxy_temp_path temp/proxy;
    uwsgi_temp_path temp/uwsgi;
    scgi_temp_path temp/scgi;
    # Batas badan di aplikasi 1 MiB (413 kontrak); Nginx diberi longgar
    # supaya 413 dijawab aplikasi dalam bentuk galat kontrak.
    client_max_body_size 8m;
    large_client_header_buffers 8 64k;
    upstream php_bengkel {
        least_conn;
$UPSTREAM    }
    server {
        listen 127.0.0.1:$PORT;
        location / {
            include fastcgi_params;
            fastcgi_param SCRIPT_FILENAME $akar_asli/backend-laravel/public/index.php;
            fastcgi_param SCRIPT_NAME /index.php;
            fastcgi_param PATH_INFO "";
            fastcgi_read_timeout 60s;
            fastcgi_pass php_bengkel;
        }
    }
}
KONF
cp "$(dirname "$NGINX")/conf/fastcgi_params" "$PREFIX/conf/" 2>/dev/null || true

matikan() {
  "$NGINX" -p "$PREFIX_ASLI/" -c conf/nginx.conf -s stop >/dev/null 2>&1
  for pid in "${PIDS[@]}"; do
    if command -v taskkill >/dev/null 2>&1; then
      taskkill //F //PID "$(cat "/proc/$pid/winpid" 2>/dev/null || echo "$pid")" >/dev/null 2>&1
    else
      kill "$pid" 2>/dev/null
    fi
  done
}
trap matikan EXIT

echo "== pemeriksaan env dan database (bengkel:periksa)"
(cd "$AKAR/backend-laravel" && php artisan bengkel:periksa) || exit 1

echo "== Nginx :$PORT → $JUMLAH_CGI php-cgi (database $DB, WhatsApp palsu :$WA_PORT)"
(cd "$PREFIX" && "$NGINX" -p "$PREFIX_ASLI/" -c conf/nginx.conf) &
for _ in $(seq 1 50); do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/api/health" && break
  sleep 0.3
done

echo "== menjalankan tes kontrak"
cd "$AKAR/tests/kontrak" || exit 1
BASE_URL="http://localhost:$PORT" BENGKEL_BASE_URL="http://localhost:$PORT" DATABASE_URL="$DATABASE_URL" \
  WA_PALSU_URL="http://localhost:$WA_PORT" npx vitest run "$@"
STATUS=$?
if [ "$STATUS" -ne 0 ]; then
  echo "== log Nginx dan php-cgi di $PREFIX_ASLI/logs"
  tail -n 20 "$PREFIX/logs/error.log" 2>/dev/null
fi
exit "$STATUS"
