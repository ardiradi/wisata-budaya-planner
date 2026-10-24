import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
import { COMPETITION_DEMO, DEMO_LABEL } from "@/config/demo";

export function SiteFooter() {
  return (
    <footer className="border-t border-primary/15 bg-[#eeeee5] py-10">
      <div className="content-container flex flex-col justify-between gap-8 md:flex-row">
        <div className="max-w-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Compass size={20} aria-hidden="true" /> wisatabudaya.
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            Kenali tempatnya. Hargai ceritanya. Nikmati perjalanannya.
          </p>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            {COMPETITION_DEMO
              ? `${DEMO_LABEL}. Rute dan rekomendasi memakai simulasi; Gemini dan semua API langsung dinonaktifkan.`
              : "Demo lokal · data dan rute sintetis. Mock offline tersedia; uji Gemini gratis opsional memerlukan konfigurasi dan izin terpisah."}
            <br />
            Bukan saran wisata nyata, pemesanan, atau fakta budaya yang ditinjau
            independen. Isian contoh hanya di memori tab; muat ulang
            menghapusnya. Jangan masukkan data pribadi.
          </p>
        </div>
        <nav
          aria-label="Navigasi kaki halaman"
          className="flex flex-wrap gap-x-8 gap-y-4 self-start text-xs font-medium"
        >
          <Link href="/#jelajahi">Jelajahi</Link>
          <Link href="/#cara-kerja">Cara kerja</Link>
          <Link href="/editorial">Studio katalog sintetis</Link>
          <Link href="/rencanakan" className="flex items-center gap-1">
            Coba perencana <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </nav>
      </div>
      <div className="content-container mt-9 border-t border-primary/10 pt-5 text-[10px] text-muted-foreground">
        Wisata Budaya Planner · Palembang, Indonesia · Ilustrasi orisinal dan
        konten contoh sintetis.
      </div>
    </footer>
  );
}
