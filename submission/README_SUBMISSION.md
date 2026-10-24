# Wisata Budaya Planner

Perencana perjalanan budaya dan kuliner personal, dengan Palembang sebagai konteks pilot.

**Demo Kompetisi — Data Sintetis.** Katalog, bukti, jam, biaya, layanan makan dan rute seluruhnya sintetis. Mock ranking serta fallback deterministik menjalankan personalisasi. Hasil bukan saran wisata nyata, pemesanan atau fakta budaya yang ditinjau independen. M1 tetap OPEN dan penerimaan M2 produksi belum diberikan.

## Akses demo

**Status deployment: LIVE — demo kompetisi sintetis.** URL HTTPS anonim terverifikasi: [wisata-budaya-planner-demo.netlify.app](https://wisata-budaya-planner-demo.netlify.app). COMP-DEPLOY-NETLIFY-01 berlaku hanya untuk satu site sintetis; M1 tetap OPEN dan M2 produksi tidak diterima. HTTP dialihkan 301 ke HTTPS. Plan aktual credit-based Free/USD 0 dikonfirmasi sebelum deployment, dengan saldo awal 300/300 credits sampai 27 Oktober 2026 serta tanpa kartu tersimpan atau billing details. Dua publikasi produksi telah digunakan, sesuai batas satu awal dan satu korektif; tidak ada headroom publikasi tambahan. Observasi terakhir 11:45 WIB menunjukkan 269,6/300 credits tersisa dan 30,4 terpakai, termasuk dua publikasi/30 credits, 753 web requests/0,2 credits, bandwidth 0,2 credits, compute <1 credit dan AI inference 0. Ini menggantikan snapshot 01:44 WIB yang belum lengkap. Metering dapat terlambat; saldo tersebut bukan jaminan konsumsi mendatang. Batas persiapan/verifikasi awal tetap 60 credits dan kas USD 0. Tidak ada billing activation, paid plan/trial, paid credits, auto recharge, custom domain, add-on berbayar atau repository GitHub. Lihat [keputusan hosting](../docs/m1/DECISION_REGISTER.md#14-competition-only-synthetic-deployment-authorization).

Vercel tidak dipilih karena kelayakan Hobby untuk kasus kompetisi berhadiah uang belum jelas. Ini temuan historis, bukan penolakan Netlify yang baru disetujui. Sumber: [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines), [halaman kompetisi](https://it-fest-26.vercel.app/competition).

Demo tidak meminta nama, kontak, alamat privat atau unggahan. Gunakan input contoh saja. Rencana, revisi dan editorial berada dalam memori tab. Refresh menghapus sesi. Tidak ada akun atau penyimpanan traveler server-side. Hosting dapat memproses metadata permintaan teknis sesuai kebijakannya. Demo tidak mengklaim retensi provider nol.

## Masalah dan nilai produk

Wisatawan perlu menggabungkan minat budaya, waktu, makanan, perjalanan dan biaya rombongan. Konteks budaya juga memerlukan sumber dan jalur koreksi. Ini hipotesis produk yang belum diuji bersama pengguna nyata. Tidak ada metrik kepuasan, endorsement atau dampak pasar yang diklaim.

AI hanya mengurutkan ID kandidat yang memenuhi syarat dan memilih kode alasan. Domain deterministik menghitung jadwal, rute, biaya, makan, walking dan kelayakan. Ketidakpastian tetap terlihat dan tidak diisi dengan pengetahuan model.

## Pengalaman yang tersedia

- Discovery dan empat langkah preferensi untuk 1–7 hari, rombongan, budget, minat wajib, kuliner, moda, ritme, walking, waktu harian dan inventaris makan.
- Jadwal berarah, opening window, durasi, buffer, titik berangkat/kembali dan biaya kelompok dengan cadangan 10%.
- Semua porsi makan yang diperlukan tetap dihitung. Porsi disediakan/prabayar hanya membebaskan biaya pembelian yang tepat, bukan kebutuhan diet atau jadwal.
- Traveler dapat meminta makan terjadwal dengan jendela yang diisi dan dikonfirmasi sendiri. Bukti layanan, lokasi, durasi, porsi dan kesesuaian berbeda dari bukti kunjungan kuliner. Makan berbiaya tanpa jadwal tetap dinyatakan belum terjadwal.
- Rencana singkat atau eksplorasi lebih penuh tetap mematuhi ritme, stop cap, budget seluruh perjalanan dan batas kerja. Waktu menunggu dan waktu belum dialokasikan terlihat. Pencarian sparse tidak menjamin optimum global.
- Swap, hapus, urutkan, kunci, ubah preferensi, preview sebelum/sesudah, komit eksplisit dan revert dengan validasi terkini. Revisi lama tetap immutable dalam memori.
- Unduhan TXT atas tindakan pengguna memuat semua hari, revisi, status bukti dan timestamp. File tidak memperbarui diri setelah bukti ditarik.
- Mock ranking dengan schema ketat, allowlist lengkap, alasan terkontrol dan fallback deterministik.
- Studio editorial sintetis dengan aktor simulasi, bukti per field, review terpisah, event immutable dan withdrawal. Simulasi ini bukan review manusia independen.

## Contoh sintetis yang dapat direproduksi

Fixture dievaluasi 23 Oktober 2026 untuk perjalanan 24 Oktober 2026. Dua orang, satu hari, budget Rp1.500.000, dua sarapan disediakan dan empat porsi makan siang/malam dibeli.

| Profil                 | Pilihan                      | Total atas termasuk cadangan |
| ---------------------- | ---------------------------- | ---------------------------: |
| Jejak sejarah, mobil   | Galeri dan Dapur             |                    Rp280.500 |
| Kriya santai, berjalan | Studio Kriya dan Dapur       |                    Rp242.000 |
| Ruang & rasa, taksi    | Arsitektur dan kuliner gurih |                    Rp302.500 |

Profil sejarah singkat kembali 10:28, dengan 158 dari 600 menit dimodelkan dan 442 menit belum dialokasikan. Anggaran makan tidak otomatis menciptakan slot makan.

Permintaan makan siang 12:00–13:00 pada layanan Dapur Cerita sintetis menghasilkan layanan 12:00–12:30 di dalam kunjungan 12:00–12:45. Dua porsi makan malam tetap berbiaya tanpa waktu/tempat yang diklaim. Total atas Rp280.500. Jendela 12:00–12:10 terblokir karena tidak mencukupi durasi layanan. Versi valid sebelumnya tetap tersedia.

Eksplorasi seimbang menghasilkan empat kunjungan, 225 menit kunjungan, 319 dari 600 menit dimodelkan dan 281 menit belum dialokasikan, total atas Rp423.500. Tidak ada aktivitas pengisi atau syarat keras yang dilonggarkan.

Swap Galeri ke Paviliun pada profil singkat mengubah total Rp280.500 menjadi Rp302.500. Revert tervalidasi menciptakan revisi baru Rp280.500 sambil menjaga versi lama.

## AI dan fakta

Demo menjalankan mock dan fallback. Inferensi Gemini harus nonaktif di server pada public mode dan key tidak boleh menjadi deployment variable. Adapter SDK yang tersedia pada source bukan bukti keberhasilan AI live.

Satu attempted invocation `gemini-2.5-flash` historis pada 23 Oktober 2026, 18:37:32–18:37:42 WIB gagal HTTP lokal 502 / `UNAVAILABLE`. Tidak ada respons tervalidasi, upstream status atau usage provider. Permit lama habis. Tidak ada provider call E1/E2 atau panggilan baru yang diotorisasi untuk deployment.

Input ranking V2 mempertahankan preferensi dan kandidat secara lossless serta output ranking lengkap. Satu hari 17/30/60 kandidat lolos mock admission. Bytes bukan token provider. Input multi-hari terlalu besar tetap fail closed dan fallback.

Batas tetap maksimum 60 kandidat, dua percobaan model termasuk repair, 12.000 input/2.000 output per percobaan, 42 percobaan rute dan satu deadline operasi 45 detik. Mock tidak membuktikan billing, latency atau kelayakan provider.

## Status konten nyata

Enam lead Palembang nyata tetap di karantina dokumentasi internal, bukan katalog runtime, bundle browser atau input AI. Tidak ada klaim fakta, hak reuse atau persetujuan independen dari lead tersebut. Reviewer independen belum ditunjuk. Komitmen kurator Product Owner 20+ jam/minggu tidak membuktikan kapasitas berkelanjutan. Target M5 tetap 30 tempat.

## Verifikasi

**Checkpoint E2 lokal:** lint, typecheck, formatting dan optimized build lulus. **564/564 tes unit/integrasi/komponen dalam 39 file (72,53 detik)**, **86/86 browser Edge desktop/mobile (271,13 detik)** dan **42 configured axe scans tanpa pelanggaran**. Corpus 120 serangan sintetis dalam 12 kategori tetap ditolak. Hasil ini belum termasuk smoke URL publik dan tidak membuktikan fakta lapangan atau manfaat pengguna nyata.

**Persiapan kompetisi, hasil lokal baru:** 571/571 tes dalam 42 file (140,26 detik), lint, typecheck dan formatting lulus. Optimized build normal dan competition mode lulus. Rerun 86/86 browser Edge lulus (280,776 detik) dengan 42 configured axe scans tanpa pelanggaran. Tambahan terpisah: 16/16 kasus competition mode di loopback (76,092 detik), 10 configured axe scans tanpa pelanggaran. Pemeriksaan jaringan pada 16 kasus tidak menemukan dispatch eksternal/provider, error runtime, cookies atau browser storage. Ini bukan smoke URL HTTPS publik. Jangan membaca angka E2 sebagai run baru. Smoke publik aktual dicatat terpisah di bawah. Tidak ada uji live dalam automated suite. Axe tidak menggantikan uji pembaca layar dan perangkat fisik.

## Menjalankan source secara lokal

Prasyarat Node.js 24 LTS dan npm. Dari root hasil ekstraksi:

```powershell
npm ci
$env:NEXT_PUBLIC_COMPETITION_DEMO = "true"
$env:GEMINI_DEMO_SMOKE_ENABLED = "false"
npm run build
npm run start
```

Buka [127.0.0.1:3000](http://127.0.0.1:3000/). Jika dependensi/build tersedia, `scripts/start-demo.ps1` menyediakan launcher loopback. Setelah source berubah, hentikan server lama lalu jalankan `-Rebuild`. Tidak ada key, Maps atau database yang diperlukan. Instalasi pertama memerlukan registry atau cache paket.

Perintah verifikasi regresi normal: hentikan server sebelumnya terlebih dahulu. Suite normal memeriksa kontrol Gemini yang dimock; kontrol tersebut sengaja tidak ditampilkan pada competition build. Rebuild dengan flag `false` sebelum suite normal, tanpa mengaktifkan live request:

```powershell
npm run lint
npm run typecheck
npm run format:check
npm test
$env:NEXT_PUBLIC_COMPETITION_DEMO = "false"
$env:GEMINI_DEMO_SMOKE_ENABLED = "false"
npm run build
$env:PLAYWRIGHT_CHANNEL = "msedge"
npm run test:e2e
```

Untuk smoke competition mode lokal, hentikan server normal, rebuild dengan flag `true`, jalankan server dan gunakan `$env:DEMO_BASE_URL='http://127.0.0.1:3000'; npx playwright test -c playwright.deployment.config.ts`. Untuk uji publik anonim yang telah dijalankan:

```powershell
$env:DEMO_BASE_URL = "https://wisata-budaya-planner-demo.netlify.app"
$env:PLAYWRIGHT_CHANNEL = "msedge"
npx playwright test -c playwright.deployment.config.ts
```

**Verifikasi HTTPS publik:** 16/16 kasus Edge desktop/mobile lulus dalam 134,74 detik, dengan 10 configured axe scans tanpa pelanggaran. Enam belas pemeriksaan batas jaringan tidak menemukan request eksternal/provider, traveler API dispatch, runtime errors, cookies atau browser storage. Private paths mengembalikan 404; Gemini GET dan candidate-free malformed POST mengembalikan 403 `LIVE_DISABLED` dengan `no-store`. Ini uji anonim terhadap URL Netlify aktual, terpisah dari 16/10 loopback. Axe tidak menggantikan pembaca layar atau perangkat fisik.

## Materi kompetisi

[Panduan demo](DEMO_GUIDE.md), [pitch Indonesia](PITCH_SCRIPT_ID.md), [isi 10 slide](SLIDES.md), [AI development log](AI_DEVELOPMENT_LOG.md), [checklist](SUBMISSION_CHECKLIST.md), [PPTX](Wisata-Budaya-Planner-Presentation.pptx), [PDF](Wisata-Budaya-Planner-Presentation.pdf) dan source ZIP (workspace-only artifact, excluded from this public repository: `Wisata-Budaya-Planner-Source.zip`).

Screenshot 01–08 historis, 09–12 E1 dan 13–16 E2 berasal dari loopback. Capture 17–18 juga competition mode loopback. Capture 19–20 berasal dari URL HTTPS Netlify aktual; gunakan label asal untuk membedakan bukti publik dari historis. [Landing publik](screenshots/19-netlify-public-landing.png) dan [hasil mobile publik](screenshots/20-netlify-public-mobile-result.png).

Deck final sepuluh slide memuat URL publik, capture HTTPS dan hasil 16/16 publik serta 10 axe scans, terpisah dari hasil lokal. PPTX 558.386 bytes dan PDF 792.722 bytes lulus pemeriksaan SHA/CRC, layout/font/native-table/import; sepuluh halaman PDF cocok pixel dengan render PNG yang diperiksa. Exporter mengembalikan exit 1 setelah menulis file/receipt lengkap; command tidak diklaim bersih. PowerPoint asli belum diuji dan PDF gambar tidak bertag.

Deployment memakai curated source terpisah: 82 source files, 29 browser/static files, satu function ZIP berisi 1.526 members, delapan prerender blobs dan 1.523 generated adapter files diperiksa tanpa private paths atau exact key/pattern matches. Delapan belas traces tetap di staging yang ditetapkan. Site/shared environment variable lists kosong; tidak ada secret yang dicetak. Team AI gateway nonaktif. Semua identitas, bukti, harga, jam, layanan makan dan rute runtime sintetis. Pemeriksaan ini terbatas, bukan jaminan keamanan universal. Source ZIP final berisi 200 file. Seluruh file hasil ekstraksi cocok SHA-256 dengan sumber; CRC lulus, forbidden paths, exact local-key matches dan credential-pattern matches nol. Hash final disimpan pada receipt lokal di luar arsip untuk menghindari hash melingkar. Arsip harus tetap mengecualikan `.env*`, receipts, `.local-demo`, `.git`, caches, dependencies, logs, traces, unpublished research, raw evidence dan historical experiments. Tidak ada unggah ke portal kompetisi.

Product Owner mengidentifikasi [halaman kompetisi](https://it-fest-26.vercel.app/competition) sebagai sumber resmi. URL/versi GUIDEBOOK, revisi tenggat dan persyaratan submission tetap **NOT VERIFIED**. Tema dan nama lomba berasal dari brief Product Owner. Tidak ada unggah ke portal atau bukti penerimaan yang diklaim.

Demo publik sintetis tidak menutup gerbang review independen, hak sumber/rute, bukti operasional, metode walking/accessibility atau keputusan privasi, retensi, backup dan region untuk layanan nyata. M1 tetap OPEN. Geoapify tetap kandidat dan food-venue repetition tetap belum diputuskan.
