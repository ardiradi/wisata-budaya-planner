"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="content-container page-shell">
      <div role="alert" className="paper-panel max-w-xl p-8">
        <p className="eyebrow text-accent">Halaman belum dapat ditampilkan</p>
        <h1 className="mt-3 font-display text-4xl">Mari coba sekali lagi.</h1>
        <p className="my-5 text-sm leading-6 text-muted-foreground">
          Terjadi masalah pada tampilan demo. Coba muat ulang; isian dan riwayat
          sementara dapat hilang. Gunakan hanya data contoh.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={reset}>Coba lagi</Button>
          <Button asChild variant="outline">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
