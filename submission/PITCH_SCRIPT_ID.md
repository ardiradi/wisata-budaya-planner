# Naskah pitch Indonesia — sekitar 4 menit

Baca alami bersama demo. Durasi adalah target latihan, bukan rekaman terukur. Semua angka contoh adalah fixture sintetis. Demo HTTPS anonim tersedia di [wisata-budaya-planner-demo.netlify.app](https://wisata-budaya-planner-demo.netlify.app). Netlify credit-based Free dan batas kas USD 0 telah diverifikasi. Dua publikasi produksi yang disetujui sudah digunakan; tidak ada publikasi lanjutan yang diotorisasi. Batas persiapan/verifikasi awal 60 credits tetap berlaku; saldo dashboard dapat terlambat mencerminkan publikasi dan traffic. Detail saldo aktual ada pada README submission.

Selamat datang, Bapak dan Ibu juri.

Ketika mengunjungi sebuah kota, kita mudah menemukan daftar tempat menarik. Mengubahnya menjadi perjalanan lebih sulit. Apakah tempat itu buka saat kita tiba? Apakah anggota rombongan sanggup menempuh jalurnya? Apakah biaya makan sudah dihitung? Dan dari mana cerita budaya yang kita baca berasal?

Wisata Budaya Planner menyusun perjalanan budaya dan kuliner sesuai minat, waktu dan anggaran. Palembang menjadi konteks pilot. Kami ingin pengguna dapat memeriksa alasan pilihan dan akibat perubahan rencana. Kami belum mengklaim hasil riset kepuasan atau dampak bagi wisatawan nyata.

Demo Kompetisi ini memakai data sintetis. Identitas, bukti, jam, harga, layanan makan dan rute merupakan fixture. Hasil bukan saran wisata nyata, booking atau fakta budaya yang ditinjau independen. Enam lead Palembang nyata tetap dikarantina di dokumentasi internal dan tidak masuk runtime.

Pengguna mengisi empat langkah preferensi. Tanggal, rombongan, budget, minat wajib, kuliner, moda dan walking tetap eksplisit. Waktu harian dan inventaris porsi makan perlu konfirmasi. Tidak ada identitas, kontak atau lokasi privat yang diperlukan.

Profil Jejak sejarah untuk dua orang menghasilkan total atas Rp280.500, termasuk cadangan. Rencana singkat kembali pukul 10:28. Ringkasan memperlihatkan 158 dari 600 menit dimodelkan dan 442 menit belum dialokasikan. Ini tidak dipresentasikan sebagai hari penuh.

Pengguna juga dapat memilih eksplorasi lebih penuh. Contoh seimbang menghasilkan empat kunjungan, 225 menit kunjungan dan total atas Rp423.500. Pemeriksaan budget wajib seluruh perjalanan mendahului kunjungan tambahan. Syarat keras tetap berlaku dan pencarian terbatas tidak menjanjikan optimum global.

Porsi makan dan jadwal makan merupakan dua hal berbeda. Semua porsi yang diperlukan tetap masuk ledger, kecuali biaya porsi tepat yang dinyatakan disediakan atau prabayar. Pengecualian biaya tidak membebaskan kebutuhan diet dan waktu.

Traveler dapat meminta makan siang dengan rentang yang ia isi dan konfirmasikan, misalnya 12:00 sampai 13:00. Layanan sintetis yang memiliki bukti porsi, durasi, lokasi dan kesesuaian mendapat slot 12:00 sampai 12:30. Dua porsi makan malam tetap berbiaya tanpa lokasi atau waktu yang dikarang. Jika rentang makan hanya sepuluh menit, preview terblokir dan versi valid sebelumnya tetap tersedia.

Apa peran AI?

Filter deterministik memeriksa syarat keras dan bukti terkini lebih dahulu. Adapter ranking hanya boleh mengurutkan ID kandidat dan memilih kode alasan. Validator mengikat output ke kandidat dan bukti asli. Mesin deterministik tetap memiliki keputusan jadwal, rute, biaya dan kelayakan.

Demo memakai mock ranking dan fallback. Jika simulasi mengirim ID asing, sistem menolaknya dan memakai fallback dengan batas yang sama. Alasan kecocokan minat bukan fakta sejarah. Adapter Gemini resmi tersedia pada source, tetapi satu request historis gagal dan belum ada respons live yang lolos validasi. Public mode menonaktifkan provider di server dan tidak memasang key. Tidak ada inferensi live yang diklaim.

Rencana dapat diedit. Ganti Galeri dengan Paviliun, lalu periksa perubahan waktu, rute, walking dan biaya sebelum komit. Total menjadi Rp302.500. Komit menciptakan revisi baru. Revert memvalidasi kembali dengan bukti terkini. Stop yang terkunci tidak boleh diganti otomatis.

Traveler dapat mengunduh TXT sintetis dengan semua hari, revisi, status bukti dan timestamp. File tidak memperbarui diri sesudah withdrawal. Rencana dan studio editorial berada dalam memori tab, sehingga refresh menghapus sesi. Ini bukan penyimpanan akun.

Studio editorial menunjukkan bukti per field dan event review immutable. Aktor kurator dan peninjau adalah simulasi. Self-approval ditolak dan withdrawal menarik kelayakan terkini tanpa menimpa body revisi lama. Reviewer independen nyata belum ditunjuk.

QA persiapan sebelumnya lulus 571 tes lokal, 86 kasus browser desktop/mobile dan 42 configured accessibility scans tanpa pelanggaran. Loopback terpisah lulus 16 kasus/10 scans. URL HTTPS Netlify kemudian lulus 16/16 kasus anonim desktop/mobile dalam 134,74 detik, dengan 10 configured accessibility scans tanpa pelanggaran. Tidak ditemukan request eksternal/provider, traveler API dispatch, runtime errors, cookies atau browser storage dalam network assertions. Gemini GET dan malformed POST ditolak 403 di server. Tes tidak menggantikan review budaya, uji pengguna atau pemeriksaan lapangan.

Target M5 tetap 30 tempat. Hak sumber, review manusia, bukti perjalanan nyata dan desain privasi serta operasi masih memerlukan keputusan. M1 tetap OPEN dan penerimaan M2 produksi belum diberikan. Demo kompetisi ini menunjukkan personalisasi dalam batas yang dapat diperiksa sambil menjaga tanggung jawab terhadap fakta. Terima kasih.
