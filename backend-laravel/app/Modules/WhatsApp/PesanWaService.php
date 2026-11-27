<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Modules\WhatsApp;

use App\Support\Database\Transaksi;
use App\Support\Http\LogGalat;
use App\Support\Security\Uuid;
use App\Support\Time\Clock;
use App\Support\Time\Time;
use App\Support\WhatsApp\SendResult;
use App\Support\WhatsApp\WhatsAppClient;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Mengirim satu pesan WhatsApp lalu mencatat hasilnya di wa_messages
 * (spec/whatsapp.md bagian 3).
 *
 * Pengiriman sinkron di dalam permintaan HTTP (bukan antrean), supaya hasil
 * kirimnya sudah tercatat sebelum balasan dikirim dan web bisa langsung
 * menampilkan "terkirim" atau "gagal, kirim ulang". Setiap percobaan,
 * berhasil atau gagal, menjadi satu baris.
 *
 * Pemanggil wajib memanggilnya SESUDAH transaksinya di-commit, tidak pernah
 * di dalam: penyedia bisa menahan sampai 10 detik, dan selama itu kunci baris
 * SPK atau booking akan ikut tertahan.
 */
final class PesanWaService
{
    public function __construct(
        private readonly WhatsAppClient $client,
        private readonly Clock $clock,
    ) {}

    /**
     * Mengirim lalu mencatat. Kegagalan penyedia bukan pengecualian:
     * pemanggil yang memutuskan (tetap 2xx untuk pesan otomatis, 503 untuk
     * kirim ulang kasir). Galat database saat mencatat diteruskan.
     *
     * @param  string  $rujukanId  booking_id untuk pesan booking, work_order_id untuk pesan SPK
     */
    public function kirim(JenisPesan $jenis, string $phone, string $body, string $rujukanId): SendResult
    {
        $hasil = $this->client->send($phone, $body);
        $now = Time::toDb($this->clock->now());
        Transaksi::jalankan(fn () => DB::table('wa_messages')->insert([
            'wa_message_id' => Uuid::new(),
            'type' => $jenis->value,
            'phone' => $phone,
            'body' => $body,
            'status' => $hasil->sent ? 'sent' : 'failed',
            // CHECK database: failure_reason terisi tepat untuk pesan gagal.
            'failure_reason' => $hasil->sent ? null : $hasil->failureReason,
            'booking_id' => $jenis->untukBooking() ? $rujukanId : null,
            'work_order_id' => $jenis->untukBooking() ? null : $rujukanId,
            'created_at' => $now,
        ]));

        return $hasil;
    }

    /**
     * Pengiriman otomatis sesudah commit (booking dikonfirmasi/ditolak, SPK
     * dibuat, SPK selesai). Galat apa pun, termasuk saat menyusun pesan atau
     * mencatatnya, hanya dicatat di log: transaksinya sudah tersimpan, jadi
     * balasan tetap 2xx (spec, "Galat sesudah commit bukan 500").
     *
     * @param  callable(): array{0: string, 1: string}  $susun  mengembalikan [nomor tujuan, isi pesan]
     */
    public function kirimOtomatis(JenisPesan $jenis, string $rujukanId, callable $susun): void
    {
        try {
            [$phone, $body] = $susun();
            $this->kirim($jenis, $phone, $body, $rujukanId);
        } catch (Throwable $e) {
            LogGalat::catat($e, 'pesan WhatsApp otomatis gagal dicatat');
        }
    }

    /**
     * Ringkasan `wa`: baris terbaru per jenis (created_at DESC, lalu
     * wa_message_id DESC), atau null bila jenis itu belum pernah dicoba.
     *
     * @param  list<JenisPesan>  $jenis
     * @return array<string, array{status: string, createdAt: string}|null>
     */
    public function ringkasan(string $kolomRujukan, string $rujukanId, array $jenis): array
    {
        $hasil = [];
        foreach ($jenis as $j) {
            $row = DB::table('wa_messages')->where($kolomRujukan, $rujukanId)->where('type', $j->value)
                ->orderByDesc('created_at')->orderByDesc('wa_message_id')->first(['status', 'created_at']);
            $hasil[$j->kunciRingkasan()] = $row === null ? null
                : ['status' => $row->status, 'createdAt' => Time::dbToJson($row->created_at)];
        }

        return $hasil;
    }

    /**
     * Ringkasan untuk banyak rujukan sekaligus (daftar booking), satu query.
     *
     * @param  list<string>  $rujukanIds
     * @param  list<JenisPesan>  $jenis
     * @return array<string, array<string, array{status: string, createdAt: string}|null>> rujukanId → ringkasan
     */
    public function ringkasanBanyak(string $kolomRujukan, array $rujukanIds, array $jenis): array
    {
        $kosong = [];
        foreach ($jenis as $j) {
            $kosong[$j->kunciRingkasan()] = null;
        }
        $hasil = array_fill_keys($rujukanIds, $kosong);
        if ($rujukanIds === []) {
            return $hasil;
        }
        $rows = DB::table('wa_messages')->whereIn($kolomRujukan, $rujukanIds)
            ->whereIn('type', array_map(fn (JenisPesan $j): string => $j->value, $jenis))
            ->orderByDesc('created_at')->orderByDesc('wa_message_id')
            ->get([$kolomRujukan.' as rujukan', 'type', 'status', 'created_at']);
        foreach ($rows as $row) {
            $kunci = JenisPesan::from($row->type)->kunciRingkasan();
            // Baris pertama per pasangan adalah yang terbaru.
            if ($hasil[$row->rujukan][$kunci] === null) {
                $hasil[$row->rujukan][$kunci] = ['status' => $row->status, 'createdAt' => Time::dbToJson($row->created_at)];
            }
        }

        return $hasil;
    }
}
