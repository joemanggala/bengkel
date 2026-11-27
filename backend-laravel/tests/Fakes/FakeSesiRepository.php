<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace Tests\Fakes;

use App\Modules\Sesi\Contracts\SesiRepositoryInterface;
use App\Modules\Sesi\Peran;
use App\Modules\Sesi\SesiStaf;

/**
 * Tabel staff_sessions di memori. Meniru aturan query aslinya: sesi hanya
 * ditemukan bila stafnya aktif.
 */
final class FakeSesiRepository implements SesiRepositoryInterface
{
    /** @var array<string, array{role: string, active: bool}> staff_id → data staf */
    public array $staff = [];

    /** @var array<string, array{id: string, owner: string, tokenHash: string, expiresAt: string, lastUsedAt: string}> sesiId → baris sesi */
    public array $rows = [];

    /** @var list<string> sesiId yang diperpanjang, berurutan */
    public array $touched = [];

    public function cariSesiStaf(string $tokenHash): ?SesiStaf
    {
        $row = $this->byHash($tokenHash);
        $staff = $row === null ? null : ($this->staff[$row['owner']] ?? null);
        if ($row === null || $staff === null || ! $staff['active']) {
            return null;
        }

        return new SesiStaf($row['id'], $row['owner'], Peran::from($staff['role']), $row['expiresAt'], $row['lastUsedAt']);
    }

    public function simpan(string $sesiId, string $staffId, string $tokenHash, string $now, string $expiresAt): void
    {
        $this->rows[$sesiId] = [
            'id' => $sesiId, 'owner' => $staffId, 'tokenHash' => $tokenHash, 'expiresAt' => $expiresAt, 'lastUsedAt' => $now,
        ];
    }

    public function perpanjang(string $sesiId, string $expiresAt, string $lastUsedAt): void
    {
        $this->rows[$sesiId]['expiresAt'] = $expiresAt;
        $this->rows[$sesiId]['lastUsedAt'] = $lastUsedAt;
        $this->touched[] = $sesiId;
    }

    public function hapus(string $sesiId): void
    {
        unset($this->rows[$sesiId]);
    }

    public function hapusKedaluwarsa(string $staffId, string $now): void
    {
        foreach ($this->rows as $id => $row) {
            if ($row['owner'] === $staffId && $row['expiresAt'] <= $now) {
                unset($this->rows[$id]);
            }
        }
    }

    public function hapusMilik(string $staffId, ?string $kecualiSesiId = null): void
    {
        foreach ($this->rows as $id => $row) {
            if ($row['owner'] === $staffId && $id !== $kecualiSesiId) {
                unset($this->rows[$id]);
            }
        }
    }

    /** @return array{id: string, owner: string, tokenHash: string, expiresAt: string, lastUsedAt: string}|null */
    private function byHash(string $tokenHash): ?array
    {
        foreach ($this->rows as $row) {
            if ($row['tokenHash'] === $tokenHash) {
                return $row;
            }
        }

        return null;
    }
}
