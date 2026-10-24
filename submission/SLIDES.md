# Wisata Budaya Planner — isi presentasi 10 slide

Revisi demo kompetisi berbasis E2, 24 Oktober 2026 WIB. Pertahankan desain krem, hijau tua dan terakota, sepuluh slide dan screenshot aplikasi aktual. **LIVE — demo sintetis kompetisi:** [wisata-budaya-planner-demo.netlify.app](https://wisata-budaya-planner-demo.netlify.app). Netlify credit-based Free/USD 0 telah diverifikasi; dua publikasi produksi sudah digunakan. Guidebook langsung/versi dan revisi tenggat belum diverifikasi.

## 1. Wisata Budaya Planner

Perencana perjalanan budaya dan kuliner personal, dengan Palembang sebagai konteks pilot.

**Demo Kompetisi — Data Sintetis.** Mock ranking dan fallback. URL anonim: [wisata-budaya-planner-demo.netlify.app](https://wisata-budaya-planner-demo.netlify.app). Hosting live tidak berarti inferensi AI live atau kelayakan wisata nyata.

Catatan: seluruh data runtime sintetis. Tidak ada live inference, booking, saran wisata nyata atau klaim fakta yang ditinjau independen.

## 2. Tantangan merencanakan wisata budaya

Wisatawan perlu menggabungkan minat, waktu kunjungan, rute, porsi makan dan biaya kelompok. Daftar tempat yang menarik belum membuktikan kelayakan. Konteks budaya memerlukan sumber dan jalur koreksi ketika bukti berubah.

Ini hipotesis produk, bukan statistik pasar atau hasil wawancara yang belum dilakukan.

## 3. Preferensi dan kebutuhan traveler

Empat langkah mengumpulkan tanggal 1–7 hari, rombongan, budget, minat wajib, kuliner, transportasi, waktu tersedia, ritme, walking dan inventaris makan.

Traveler dapat meminta makan terjadwal dengan jendela yang diisi dan dikonfirmasi sendiri. Tidak ada jam makan universal. Perubahan yang relevan memerlukan konfirmasi ulang. Syarat keras tetap berlaku.

Visual: intake aktual. Screenshot loopback diberi label asal, bukan bukti deployment.

## 4. Porsi berbiaya dan makan terjadwal

Contoh sejarah dua orang: total atas **Rp280.500**, termasuk cadangan. Semua angka sintetis.

Permintaan makan siang 12:00–13:00 menghasilkan layanan 12:00–12:30 dengan bukti layanan/porsi/durasi/lokasi/kesesuaian tersendiri. Dua porsi makan malam tetap berbiaya tanpa slot yang diklaim. Jendela 12:00–12:10 terblokir.

Eksplorasi seimbang menghasilkan empat kunjungan, **225 menit kunjungan**, **281 menit belum dialokasikan**, total **Rp423.500**. Pilihan singkat tetap tersedia dan tidak disebut hari penuh.

Visual: screenshot E2 makan. Kunjungan kuliner saja tidak membuktikan terpenuhinya makan.

## 5. Batas kewenangan rekomendasi

1. Filter deterministik memeriksa preferensi, kota, current evidence dan syarat keras.
2. Adapter ranking mengurutkan kandidat lengkap dan memilih reason code terkontrol.
3. Validator memeriksa output. Planner menghitung jadwal, rute, porsi, biaya dan kelayakan. Output invalid memakai fallback dengan syarat yang sama.

Demo publik menonaktifkan inferensi Gemini di server dan tidak memasang key. Mock bukan inferensi model. Satu request Gemini historis gagal dan belum menghasilkan respons tervalidasi.

Proyeksi input V2 memadatkan kandidat/preferensi tanpa kehilangan makna. Satu hari 17/30/60 lolos mock admission, tetapi byte bukan token provider dan beberapa input multi-hari tetap fail closed.

## 6. Personalisasi yang dapat dibandingkan

| Profil sintetis        | Pilihan                      | Total atas |
| ---------------------- | ---------------------------- | ---------: |
| Jejak sejarah, mobil   | Galeri dan Dapur             |  Rp280.500 |
| Kriya santai, berjalan | Studio Kriya dan Dapur       |  Rp242.000 |
| Ruang & rasa, taksi    | Arsitektur dan kuliner gurih |  Rp302.500 |

Dua orang, budget Rp1.500.000. Dua sarapan disediakan dan empat porsi makan siang/malam dibeli. Jadwal makan yang belum ditentukan tetap terlihat. Ranking tidak mengalahkan validasi.

## 7. Pratinjau dan riwayat revisi

Galeri menjadi Paviliun. Total atas **Rp280.500** menjadi **Rp302.500** sesudah preview. Perbandingan menampilkan perubahan waktu, rute berarah, walking dan biaya kelompok.

Komit menciptakan revisi baru. Revert memvalidasi ulang. Kunci tetap berlaku dan versi lama immutable dalam memori tab. Unduhan TXT memuat semua hari, revisi, status bukti dan timestamp. Refresh menghapus sesi dan file tidak memperbarui diri setelah withdrawal.

Visual: perbandingan aktual, dengan asal screenshot dinyatakan.

## 8. Bukti dan tanggung jawab editorial

Bukti per field memakai referensi immutable dan kepala bukti terkini. Review simulasi memisahkan kontributor dan peninjau. Withdrawal menarik klaim terkini tanpa menimpa body revisi lama.

Enam lead nyata tetap di karantina internal, bukan runtime, browser bundle atau prompt. Semua aktor editorial demo merupakan simulasi. Reviewer independen nyata belum ditunjuk. Komitmen kurator20+ jam/minggu bukan bukti kapasitas berkelanjutan. Target M5 tetap 30 tempat.

## 9. Pengujian berdasarkan risiko

**QA persiapan kompetisi:** 571 tes lokal/42 file (140,26 detik), 86 Edge desktop/mobile (280,776 detik), 42 configured axe scans tanpa pelanggaran. Lint/typecheck/format serta normal dan competition optimized builds lulus. Corpus 120 serangan/12 kategori seluruhnya ditolak. Angka historis tidak dijumlahkan.

Skenario mencakup makan terjadwal/berbiaya, partial/free days, budget seluruh trip, tujuh hari, bukti hilang/withdrawn, output AI invalid, lock/history, mobile dan keyboard. Tidak ada live calls di suite.

Terpisah: competition mode loopback lulus 16/16 kasus (76,092 detik), 10 configured axe scans tanpa pelanggaran. **HTTPS Netlify aktual:** 16/16 Edge desktop/mobile (134,74 detik), 10 configured axe scans tanpa pelanggaran; 16 network assertions tanpa request eksternal/provider, traveler API, runtime errors, cookies atau browser storage. Private paths 404; API Gemini GET/malformed POST 403 `LIVE_DISABLED`, `no-store`. Hasil lokal dan publik tidak dijumlahkan. Tes tidak membuktikan fakta, hak data atau manfaat pengguna nyata.

## 10. Status demo dan gerbang layanan nyata

**Deployment: LIVE — demo sintetis kompetisi.** [wisata-budaya-planner-demo.netlify.app](https://wisata-budaya-planner-demo.netlify.app). Free/USD 0 dikonfirmasi; saldo awal 300/300 credits. Dua publikasi produksi sudah digunakan. Observasi terakhir 11:45 WIB menunjukkan 269,6/300 credits tersisa dan 30,4 terpakai, termasuk 30 credits untuk dua publikasi. Metering dapat terlambat; notes deck mempertahankan snapshot awal bertimestamp, bukan saldo terakhir. Tidak ada headroom publikasi tambahan, paid upgrade atau provider live. Vercel Hobby sebelumnya tidak dipilih karena kelayakan kompetisi berhadiah belum jelas.

Demo sintetis dapat menunjukkan journey, planner, mock/fallback, edit/revisi, makan, ekspor dan editorial tanpa membuka data nyata. Rilis wisata nyata tetap memerlukan review independen, hak sumber/rute, bukti lapangan dan desain privasi/retensi/backup/region.

Visual: capture 19 landing dan 20 mobile dari URL HTTPS Netlify aktual; capture loopback historis tetap diberi label asal.

M1 tetap OPEN. M2 produksi belum diterima. E3 dan uji Gemini baru belum diotorisasi. Guidebook resmi perlu dikonfirmasi sebelum klaim kepatuhan.
