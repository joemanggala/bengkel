<?php

// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

declare(strict_types=1);

namespace App\Support\WhatsApp;

use App\Support\Config\Settings;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;

/**
 * Klien API kirim WhatsApp berbentuk Fonnte (lihat spec/whatsapp.md).
 *
 * Penyedia lain dengan bentuk API berbeda cukup disesuaikan di kelas ini:
 * cara menyusun permintaan dan cara membaca "terkirim". Kelas ini tidak
 * tahu apa-apa soal pesanan; ia hanya mengirim satu teks ke satu nomor.
 */
class WhatsAppClient
{
    /** Batas waktu seluruh permintaan, termasuk membuka koneksi. */
    private const TIMEOUT_SECONDS = 10;

    private readonly ClientInterface $http;

    public function __construct(private readonly Settings $settings, ?ClientInterface $http = null)
    {
        $this->http = $http ?? new Client;
    }

    /**
     * Mengirim satu pesan. Tidak pernah melempar: kegagalan apa pun
     * dikembalikan sebagai SendResult supaya pemanggil yang memutuskan
     * (mencatat dan lanjut, atau membalas 503).
     *
     * @param  string  $phone  nomor tujuan bentuk 628…
     * @param  string  $message  isi pesan dengan pergantian baris LF
     */
    public function send(string $phone, string $message): SendResult
    {
        try {
            $response = $this->http->request('POST', $this->settings->waApiUrl, [
                // Fonnte membaca token apa adanya, tanpa awalan "Bearer".
                'headers' => ['Authorization' => $this->settings->waToken, 'Accept' => 'application/json'],
                // Tepat dua field teks; nomor sudah 628…, jadi countryCode
                // dan field lain tidak dikirim.
                'multipart' => [
                    ['name' => 'target', 'contents' => $phone],
                    ['name' => 'message', 'contents' => $message],
                ],
                'timeout' => self::TIMEOUT_SECONDS,
                'connect_timeout' => self::TIMEOUT_SECONDS,
                // Header Authorization ikut terkirim ke tujuan pengalihan mana
                // pun, jadi pengalihan tidak diikuti dan dianggap gagal.
                'allow_redirects' => false,
                'http_errors' => false,
            ]);
        } catch (GuzzleException $e) {
            return $this->gagal(self::networkReason($e->getMessage()));
        }

        $status = $response->getStatusCode();
        $body = json_decode(substr((string) $response->getBody(), 0, 64 * 1024), true);
        $reason = is_array($body) && is_string($body['reason'] ?? null) ? $body['reason'] : '';

        // Fonnte membalas kegagalan dengan HTTP 200 dan "status": false, jadi
        // status HTTP saja tidak cukup: terkirim hanya bila 2xx DAN badannya
        // objek JSON DAN "status" bernilai boolean true.
        if ($status < 200 || $status >= 300) {
            return $this->gagal($reason !== '' ? 'HTTP '.$status.': '.$reason : 'HTTP '.$status);
        }
        if (! is_array($body) || array_is_list($body)) {
            return $this->gagal('balasan penyedia bukan objek JSON');
        }
        if (($body['status'] ?? null) !== true) {
            return $this->gagal($reason !== '' ? $reason : 'penyedia tidak menerima pesan');
        }

        return SendResult::sent();
    }

    /** WA_TOKEN tidak pernah boleh ikut tersimpan di failure_reason atau log. */
    private function gagal(string $reason): SendResult
    {
        return SendResult::failed($reason, $this->settings->waToken);
    }

    /** Pesan galat jaringan yang singkat; alamat dan token tidak ikut tertulis. */
    private static function networkReason(string $message): string
    {
        if (stripos($message, 'timed out') !== false || stripos($message, 'timeout') !== false) {
            return 'waktu habis';
        }
        if (preg_match('/cURL error (\d+)/', $message, $match) === 1) {
            return 'gagal terhubung ke penyedia (cURL '.$match[1].')';
        }

        return 'gagal terhubung ke penyedia';
    }
}
