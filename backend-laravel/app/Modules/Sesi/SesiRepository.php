<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Sesi;

use App\Modules\Sesi\Contracts\SesiRepositoryInterface;
use App\Support\Database\Transaksi;
use Illuminate\Support\Facades\DB;

final class SesiRepository implements SesiRepositoryInterface
{
    public function cariSesiStaf(string $tokenHash): ?SesiStaf
    {
        $row = DB::table('staff_sessions as s')
            ->join('staff as st', 'st.staff_id', '=', 's.staff_id')
            ->where('s.token_hash', $tokenHash)
            ->where('st.is_active', true)
            ->first(['s.staff_session_id', 's.staff_id', 's.expires_at', 's.last_used_at', 'st.role']);

        return $row === null ? null : new SesiStaf(
            $row->staff_session_id, $row->staff_id, Peran::from($row->role), $row->expires_at, $row->last_used_at);
    }

    public function simpan(string $sesiId, string $staffId, string $tokenHash, string $now, string $expiresAt): void
    {
        // Di luar transaksi pemanggil (masuk staf), INSERT ini sendiri yang
        // diulang bila bertabrakan dengan sesi baru staf lain.
        Transaksi::jalankan(fn () => DB::table('staff_sessions')->insert([
            'staff_session_id' => $sesiId,
            'staff_id' => $staffId,
            'token_hash' => $tokenHash,
            'created_at' => $now,
            'expires_at' => $expiresAt,
            'last_used_at' => $now,
        ]));
    }

    public function perpanjang(string $sesiId, string $expiresAt, string $lastUsedAt): void
    {
        Transaksi::jalankan(fn () => DB::table('staff_sessions')->where('staff_session_id', $sesiId)
            ->update(['expires_at' => $expiresAt, 'last_used_at' => $lastUsedAt]));
    }

    public function hapus(string $sesiId): void
    {
        DB::table('staff_sessions')->where('staff_session_id', $sesiId)->delete();
    }

    /**
     * Penghapusan berdasarkan staf dilakukan dua langkah: id sesinya dibaca
     * dengan SELECT biasa, lalu dihapus lewat primary key. DELETE … WHERE
     * staff_id = ? langsung memasang kunci celah (gap lock) di indeks
     * staff_id, juga saat tidak ada baris yang cocok, dan kunci itu
     * bertabrakan dengan sesi baru milik staf lain yang masuk bersamaan.
     */
    public function hapusKedaluwarsa(string $staffId, string $now): void
    {
        $ids = DB::table('staff_sessions')->where('staff_id', $staffId)->where('expires_at', '<=', $now)
            ->pluck('staff_session_id')->all();
        $this->hapusId($ids);
    }

    public function hapusMilik(string $staffId, ?string $kecualiSesiId = null): void
    {
        $ids = DB::table('staff_sessions')->where('staff_id', $staffId)->pluck('staff_session_id')
            ->reject(fn (string $id) => $id === $kecualiSesiId)->values()->all();
        $this->hapusId($ids);
    }

    /** @param  list<string>  $ids */
    private function hapusId(array $ids): void
    {
        if ($ids !== []) {
            DB::table('staff_sessions')->whereIn('staff_session_id', $ids)->delete();
        }
    }
}
