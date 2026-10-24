# Video demonstrasi — Bahasa Indonesia

Master subtitle Indonesia untuk IT Festival 2026, disusun24 Oktober2026 WIB. Semua layar fungsional berasal dari aplikasi HTTPS aktual dengan input sintetis, bukan mockup interaksi. Penutup adalah kartu rangkuman editorial, bukan layar aplikasi.

**Versi tanpa narasi audio.** Hanya suara offline bahasa Inggris yang ditemukan. Tidak ada panggilan layanan speech eksternal, musik, atau voiceover yang diklaim. Naskah di bawah dapat direkam pemilik; subtitle Indonesia sudah menyampaikan seluruh narasi. AAC tidak berlaku karena master ini tidak memiliki track audio.

- Berkas video diserahkan terpisah: `Wisata-Budaya-Planner-Demo-ID.mp4`; tidak dimasukkan ke repository sumber atau source ZIP.
- [Subtitle SRT](Wisata-Budaya-Planner-Demo-ID.srt):48 cues, masing-masing5 detik, maksimal2 baris dan46 karakter per baris; caption dibakar ke gambar video.
- Master final4:00,1920×1080,16:9,30fps,H.264/yuv420p dengan fast-start; decode penuh lulus. Bukti teknis dan batas visual dicatat pada [checklist](SUBMISSION_CHECKLIST.md).
- [Demo publik](https://wisata-budaya-planner-demo.netlify.app/) · [GitHub publik](https://github.com/ardiradi/wisata-budaya-planner).

## Alur dan kontinuitas

| Waktu     | Isi                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:25 | Landing aktual dan masalah perencanaan                                                                                        |
| 0:25–0:50 | Discovery, filter kuliner dan batas data sintetis                                                                             |
| 0:50–1:30 | Profil A:25 Oktober2026,1 hari,2 orang,Rp1.500.000,jejak sejarah wajib,mobil,seimbang,batas4.000m,rencana singkat             |
| 1:30–1:50 | Profil A asli:Galeri08:18–09:18,Dapur09:35–10:20,kembali10:28,total atasRp280.500                                             |
| 1:50–2:20 | Profil B terpisah:permintaan makan siang12:00–13:00,layanan12:00–12:30 untuk2porsi;makan malam tetap dianggarkan tanpa jadwal |
| 2:20–3:00 | Kembali Profil A:previewRp280.500→Rp302.500,komit,revert tervalidasi ke revisi3,kunci pada revisi4                            |
| 3:00–3:35 | Invalid-ranking fallback,larangan self-approval simulasi,sesi valid baru lalu penarikan bukti/total tidak diketahui           |
| 3:35–4:00 | Bukti engineering historis yang tercatat,URL demo/source dan batas kesiapan                                                   |

Sarapan2porsi disediakan tepat;makan siang/malam masing-masing2porsi tetap dibeli. Profil B tidak diklaim kembali10:28. Data layanan makan berbeda dari bukti kunjungan kuliner. Angka/histori tersebut adalah fixture sintetis dan bukan harga,jam atau rute Palembang nyata.

Pemotongan membuang loading dan jeda navigasi; frame aktual dapat ditahan untuk waktu membaca. Tidak ada percepatan interaksi, hasil palsu, DOM injection, atau penggantian angka pada layar. Label Profil A/B adalah anotasi video, bukan kontrol aplikasi. Badge hosting asli yang tampak dalam footage berasal dari aplikasi, bukan watermark yang ditambahkan ke master.

## Naskah narasi

### 0:00 — Perjalanan budaya yang dapat diperiksa

Daftar tempat menarik belum menjadi sebuah perjalanan. Kita masih perlu mencocokkan minat budaya, jam kunjungan, perjalanan, makan, dan anggaran rombongan. Wisata Budaya Planner menyatukannya dalam rencana yang dapat diperiksa. Palembang menjadi konteks pilot, dengan tujuan membantu wisatawan memahami pilihan dan konsekuensi perjalanannya.

### 0:25 — Demo kompetisi — data sintetis

Ini adalah demo kompetisi dengan data sintetis. Nama tempat contoh, jam, harga, rute, dan bukti merupakan fixture, bukan informasi wisata nyata yang ditinjau independen. Nilai yang ingin dibangun adalah transparansi: mengapa sebuah tempat dipilih, bukti apa yang mendukungnya, dan apa yang masih belum diketahui.

### 0:50 — Preferensi personal, syarat tetap eksplisit

Kita gunakan satu profil contoh: dua orang, satu hari, anggaran satu juta lima ratus ribu rupiah, dengan minat sejarah. Empat langkah mengumpulkan tanggal, waktu tersedia, minat wajib, kuliner, transportasi, dan batas berjalan. Inventaris makan juga dikonfirmasi: sarapan dua porsi disediakan, sementara makan siang dan malam tetap dibeli. Input terstruktur menjaga kebutuhan penting tetap terlihat. Pengguna tidak perlu memasukkan identitas, kontak, atau lokasi privat. Sistem tidak boleh diam-diam melonggarkan syarat untuk menghasilkan rencana.

### 1:30 — Jadwal, porsi makan, dan waktu yang jujur

Profil awal menghasilkan rencana singkat dengan total atas dua ratus delapan puluh ribu lima ratus rupiah, termasuk cadangan. Kembali pukul sepuluh lewat dua puluh delapan, sehingga sisa hari ditampilkan sebagai waktu belum dialokasikan. Kunjungan kuliner tidak otomatis menjadi jadwal makan. Sekarang, contoh terpisah: traveler meminta makan siang antara pukul dua belas dan satu siang. Layanan sintetis dua porsi ditempatkan pukul dua belas sampai dua belas tiga puluh. Waktu menunggu terlihat, bukan diisi kegiatan karangan. Makan malam tetap dianggarkan, tanpa mengarang lokasi atau jamnya. Semua porsi yang diperlukan tetap dihitung.

### 2:20 — Ubah dengan preview, simpan sebagai revisi baru

Kembali ke profil singkat awal, kita mengganti Galeri dengan Paviliun. Preview memperlihatkan dampak pada waktu, rute, berjalan, dan biaya rombongan. Total berubah menjadi tiga ratus dua ribu lima ratus rupiah. Perubahan baru berlaku setelah komit eksplisit. Riwayat mempertahankan versi sebelumnya, dan revert harus divalidasi kembali. Stop terkunci tidak boleh diganti otomatis. Usulan yang melanggar syarat keras diblokir tanpa diam-diam menimpa versi valid. Traveler tetap memegang kendali atas perubahan rencananya.

### 3:00 — AI memberi peringkat; mesin menentukan kelayakan

AI dirancang untuk mengurutkan kandidat yang sudah lolos filter, memakai identitas dan kode alasan yang dibatasi. Jadwal, rute, biaya, dan kelayakan tetap ditentukan mesin deterministik. Demo publik memakai simulasi ranking dan fallback. Adapter Gemini tersedia, tetapi belum ada respons live tervalidasi. Output asing ditolak. Studio editorial menunjukkan bukti per bidang dan penarikan kelayakan terkini. Aktor review adalah simulasi; ini bukan persetujuan manusia independen. Fakta budaya tidak boleh muncul hanya karena model mengatakannya.

### 3:35 — Terukur dalam pengujian, jujur tentang batasnya

Pemeriksaan tercatat mencakup lima ratus tujuh puluh satu tes lokal, delapan puluh enam kasus browser, dan seratus dua puluh serangan sintetis yang ditolak. Verifikasi publik lulus enam belas kasus dan sepuluh pemindaian aksesibilitas terkonfigurasi tanpa pelanggaran. Ini bukti engineering, bukan kesiapan wisata nyata. M satu tetap terbuka. Wisata Budaya Planner: perjalanan lebih personal, transparan, dan bermakna.

## Bukti dan keterbatasan

571 tes lokal/86 kasus browser/120 serangan sintetis serta16 kasus HTTPS publik/10scan axe adalah hasil checkpoint yang benar-benar tercatat,bukan run baru atau pengukuran manfaat wisata nyata. Hasil tersebut tidak dijumlahkan. Katalog dan peninjau editorial adalah simulasi. Adapter Gemini tersedia, tetapi satu percobaan historis gagal dan tidak ada respons live tervalidasi. Tidak ada live AI/routing,perubahan aplikasi atau deployment pada produksi video ini.

Satu rekaman penutup awal gagal karena menunggu `networkidle`; penggantinya menggunakan DOMContentLoaded dan assertion UI aktual. Rekaman awal dan bukti privat disimpan di workspace, tidak dipublikasikan. Intake/makan direkam ulang hanya untuk menyamakan tanggal25Oktober dengan profil edit. Bukti withdrawal khusus dimulai dari hasil valid baru, sehingga tidak disamakan dengan perubahan head dari review sebelumnya.

Temuan UI yang belum diubah: setelah withdrawal, sebagian copy cakupan kategori dapat berbunyi tidak ada kategori wajib walaupun preferensi asal masih memiliki minat wajib. Warning withdrawal,total tidak diketahui dan penghentian kelayakan tetap bekerja. Ini tindak lanjut produk, bukan perbaikan yang disisipkan ke video.

M1 tetapOPEN,M2 belum diterima,guidebook/versi/tenggat resmi belum diverifikasi,tidak ada review budaya manusia independen atau pengiriman formulir panitia. Kedua publikasi Netlify telah digunakan; tidak ada redeployment atau open-source license baru.
