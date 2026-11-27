// Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
// Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

// Alamat halaman website publik. Alamat lacak servis /servis/<trackingToken> juga dirangkai
// backend untuk pesan WhatsApp ({PUBLIC_WEB_URL}/servis/<token>, spec/whatsapp.md), jadi bentuknya
// tidak boleh diubah di sini saja.

export const PATH_BOOKING = '/booking'

export const alamatStatusBooking = (bookingToken: string): string =>
    `${PATH_BOOKING}/${encodeURIComponent(bookingToken)}`

export const alamatLacakServis = (trackingToken: string): string =>
    `/servis/${encodeURIComponent(trackingToken)}`
