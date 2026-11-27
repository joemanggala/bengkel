# Copyright (c) 2026 ariefmanggalaputra <idekodecoding@gmail.com>. Hak cipta dilindungi.
# Lisensi: lihat berkas LICENSE. Dilarang menjual ulang atau membagikan source code ini.

# Membuka setiap .docx di Microsoft Word tanpa jendela, mengisi daftar isi beserta nomor
# halamannya, lalu menyimpan. Library docx hanya menulis kerangka daftar isi.

param([Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$Berkas)

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    foreach ($b in $Berkas) {
        $doc = $word.Documents.Open((Resolve-Path $b).Path)
        foreach ($t in $doc.TablesOfContents) { $t.Update() }
        $doc.Save()
        Write-Output ("{0}: {1} halaman" -f $b, $doc.ComputeStatistics(2))
        $doc.Close()
    }
} finally {
    $word.Quit()
}
