<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Staf;

use App\Modules\Sesi\Peran;
use App\Support\Time\Time;

/** Profil staf yang boleh dikirim ke klien; password_hash tidak pernah ikut. */
final class Staf
{
    /** createdAt berupa nilai DATETIME(3) UTC dari database. */
    public function __construct(
        public readonly string $staffId,
        public readonly string $name,
        public readonly string $email,
        public readonly Peran $role,
        public readonly bool $isActive,
        public readonly string $createdAt,
    ) {}

    public static function fromRow(object $row): self
    {
        // Kolom BOOLEAN MySQL terbaca sebagai 0/1; kontrak menuntut true/false.
        return new self($row->staff_id, $row->name, $row->email, Peran::from($row->role), (bool) $row->is_active, $row->created_at);
    }

    public function pemilikAktif(): bool
    {
        return $this->role === Peran::Pemilik && $this->isActive;
    }

    /** @return array<string, string|bool> skema Staf di spec */
    public function toArray(): array
    {
        return [
            'staffId' => $this->staffId,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'isActive' => $this->isActive,
            'createdAt' => Time::dbToJson($this->createdAt),
        ];
    }
}
