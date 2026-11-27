<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\WhatsApp;

/** Jenis pesan WhatsApp. Nilainya sama dengan kolom wa_messages.type. */
enum JenisPesan: string
{
    case BookingDikonfirmasi = 'booking_confirmed';

    case BookingDitolak = 'booking_rejected';

    case SpkDibuat = 'work_order_created';

    case SiapDiambil = 'work_order_done';

    case Nota = 'receipt';

    /** Pesan booking menunjuk booking_id; pesan SPK menunjuk work_order_id (CHECK wa_messages_rujukan_*). */
    public function untukBooking(): bool
    {
        return $this === self::BookingDikonfirmasi || $this === self::BookingDitolak;
    }

    /** Kunci di ringkasan `wa` (RingkasanWa, RingkasanWaBooking): camelCase dari nilainya. */
    public function kunciRingkasan(): string
    {
        return lcfirst(str_replace('_', '', ucwords($this->value, '_')));
    }
}
