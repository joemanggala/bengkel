<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Jasa;

use App\Support\Time\Time;

/** Satu baris jasa servis dari tabel services. */
final class Jasa
{
    /** Kolom yang dibaca repository; urutannya tidak penting. */
    public const COLUMNS = [
        'service_id', 'name', 'description', 'price', 'duration_minutes',
        'is_public', 'is_active', 'sort_order', 'created_at', 'updated_at',
    ];

    /** createdAt dan updatedAt berupa nilai DATETIME(3) UTC dari database. */
    public function __construct(
        public readonly string $serviceId,
        public readonly string $name,
        public readonly string $description,
        public readonly int $price,
        public readonly ?int $durationMinutes,
        public readonly bool $isPublic,
        public readonly bool $isActive,
        public readonly int $sortOrder,
        public readonly string $createdAt,
        public readonly string $updatedAt,
    ) {}

    /**
     * Kolom BOOLEAN terbaca 0/1 dan BIGINT bisa terbaca sebagai teks
     * tergantung driver, jadi semuanya dipaksa ke tipe kontrak di sini.
     */
    public static function fromRow(object $row): self
    {
        return new self(
            $row->service_id,
            $row->name,
            $row->description,
            (int) $row->price,
            $row->duration_minutes === null ? null : (int) $row->duration_minutes,
            (bool) $row->is_public,
            (bool) $row->is_active,
            (int) $row->sort_order,
            $row->created_at,
            $row->updated_at,
        );
    }

    /** @return array<string, mixed> skema Jasa (untuk staf) */
    public function toArray(): array
    {
        return [
            'serviceId' => $this->serviceId,
            'name' => $this->name,
            'description' => $this->description,
            'price' => $this->price,
            'durationMinutes' => $this->durationMinutes,
            'isPublic' => $this->isPublic,
            'isActive' => $this->isActive,
            'sortOrder' => $this->sortOrder,
            'createdAt' => Time::dbToJson($this->createdAt),
            'updatedAt' => Time::dbToJson($this->updatedAt),
        ];
    }

    /**
     * Skema JasaPublik: hanya yang tampil di website. Status aktif, tampil,
     * dan urutan sengaja tidak ikut karena itu urusan panel staf.
     *
     * @return array<string, mixed>
     */
    public function toPublik(): array
    {
        return [
            'serviceId' => $this->serviceId,
            'name' => $this->name,
            'description' => $this->description,
            'price' => $this->price,
            'durationMinutes' => $this->durationMinutes,
        ];
    }
}
