# Fixtur bcrypt

`bcrypt.json` berisi hash untuk sandi `SandiUji123!` (cost 12) yang dibuat
dengan pustaka asli tiap bahasa. Awalannya berbeda karena tiap pustaka
menulis versi bcrypt yang berbeda, padahal algoritmanya sama:

| Kunci | Awalan | Dibuat dengan |
|---|---|---|
| `go` | `$2a$` | Go, `golang.org/x/crypto/bcrypt` |
| `node` | `$2b$` | Node, `bcryptjs` 3.0.3 |
| `php` | `$2y$` | PHP 8.4, `password_hash()` |

Harness menyisipkan staf uji langsung ke tabel `staff` dengan hash `node`,
lalu masuk lewat API. Tes `sandi-lintas-backend` memakai ketiganya: backend
mana pun wajib menerima ketiga awalan, karena satu database bisa dipakai
bergantian oleh Laravel, Go, dan NestJS.

Ketiga hash sama dengan fixtur produk KodeCoding lain yang memakai sandi uji
yang sama (dibuat dan diperiksa silang di sana). `npm run cek-harness`
memeriksa ulang ketiganya dengan `bcryptjs` setiap kali dijalankan: cocok
untuk sandi uji, ditolak untuk sandi lain, dan cost 12.

## Cara membuat ulang

Hash bcrypt memakai garam acak, jadi hasil baru selalu berbeda teks tetapi
sama sahnya. Membuat ulang hanya perlu bila sandi uji diganti.

Go (di folder sementara, bukan di repo ini):

```sh
go mod init bcryptfixtur
go get golang.org/x/crypto
cat > main.go <<'EOF'
package main

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	hash, err := bcrypt.GenerateFromPassword([]byte("SandiUji123!"), 12)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(hash))
}
EOF
go run .
```

Node (dari `tests/kontrak`, setelah `npm ci`):

```sh
node -e "console.log(require('bcryptjs').hashSync('SandiUji123!', 12))"
```

PHP:

```sh
php -r 'echo password_hash("SandiUji123!", PASSWORD_BCRYPT, ["cost" => 12]), PHP_EOL;'
```

Setiap hash baru wajib diperiksa silang: lolos `bcryptjs.compareSync`,
`password_verify`, dan `bcrypt.CompareHashAndPassword` untuk sandi yang
benar, dan ditolak untuk sandi yang salah.
