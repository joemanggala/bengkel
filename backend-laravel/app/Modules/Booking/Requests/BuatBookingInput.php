<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\Booking\Requests;

use App\Modules\Booking\TanggalDatang;
use App\Support\Validation\ControlChars;
use App\Support\Validation\JsonObject;
use App\Support\Validation\Plate;
use App\Support\Validation\TextRule;
use DateTimeImmutable;

/**
 * Isian form booking publik (BuatBookingRequest) sesudah dibaca dari badan.
 *
 * baca() hanya mencatat galat ke JsonObject tanpa melempar, karena rujukan
 * serviceId (butuh database) dinilai sekaligus dengan field lain sebelum
 * pemanggil melempar 422. Nilai di objek ini baru boleh dipakai sesudah
 * throwIfInvalid() lolos.
 */
final class BuatBookingInput
{
    private function __construct(
        public readonly string $customerName,
        public readonly string $phone,
        public readonly string $vehicleType,
        public readonly ?Plate $plate,
        public readonly string $vehicleBrand,
        public readonly string $vehicleModel,
        public readonly ?string $serviceId,
        public readonly string $visitDate,
        public readonly string $complaint,
    ) {}

    /**
     * Nama pemesan, merek, dan tipe tidak boleh memuat karakter kontrol sama
     * sekali; keluhan boleh memuat tab dan baris baru. Teks ini tampil di
     * panel staf dan disalin ke pelanggan dan SPK, jadi karakter tak terlihat
     * yang bisa memalsukan baris atau membalik arah teks ditolak (bagian
     * "Teks" spec).
     *
     * @param  DateTimeImmutable  $sekarang  saat permintaan diterima, untuk batas tanggal datang WIB
     */
    public static function baca(JsonObject $body, DateTimeImmutable $sekarang): self
    {
        $customerName = $body->text('customerName', new TextRule(trim: true, min: 2, max: 100, controlChars: ControlChars::SingleLine));
        $phone = $body->phone('phone');
        $vehicleType = $body->choice('vehicleType', ['MOTOR', 'CAR']);
        $plate = $body->plate('plate');
        $vehicleBrand = $body->text('vehicleBrand', new TextRule(trim: true, max: 50, controlChars: ControlChars::SingleLine));
        $vehicleModel = $body->text('vehicleModel', new TextRule(optional: true, trim: true, max: 50, controlChars: ControlChars::SingleLine));
        $serviceId = $body->nullableUuid('serviceId');

        // Tanggal tidak dipangkas. Rentangnya (hari ini sampai +30 hari WIB)
        // hanya dinilai bila tipe dan kekosongannya sudah lolos.
        $visitDate = $body->text('visitDate', new TextRule);
        if ($visitDate !== '' && ! $body->failed('visitDate')) {
            $body->fail('visitDate', TanggalDatang::periksa($visitDate, $sekarang));
        }

        $complaint = $body->text('complaint', new TextRule(trim: true, max: 1000, controlChars: ControlChars::MultiLine));

        return new self($customerName, $phone, $vehicleType, $plate, $vehicleBrand, $vehicleModel, $serviceId, $visitDate, $complaint);
    }
}
