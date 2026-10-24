import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <section className="content-container page-shell text-center">
      <p className="eyebrow text-accent">404 · Di luar jalur</p>
      <h1 className="my-5 font-display text-5xl">Halaman belum ditemukan.</h1>
      <p className="mb-7 text-muted-foreground">
        Kembali ke awal untuk melanjutkan penjelajahan.
      </p>
      <Button asChild>
        <Link href="/">Kembali ke beranda</Link>
      </Button>
    </section>
  );
}
