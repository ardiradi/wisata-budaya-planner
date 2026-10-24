"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExperienceArt } from "./experience-art";
import { cn } from "@/lib/utils";

const examples = [
  {
    id: "demo-gallery",
    kind: "culture" as const,
    category: "Budaya",
    title: "Galeri Cerita Demo",
    description:
      "Contoh ruang untuk menampilkan konteks budaya beserta sumbernya.",
    number: "01",
  },
  {
    id: "demo-kitchen",
    kind: "food" as const,
    category: "Kuliner",
    title: "Dapur Rasa Demo",
    description: "Contoh tampilan pengalaman makan dan rincian biaya kelompok.",
    number: "02",
  },
  {
    id: "demo-tradition",
    kind: "craft" as const,
    category: "Budaya",
    title: "Ruang Tradisi Demo",
    description: "Contoh bagaimana minat dan cerita dapat hadir dalam rencana.",
    number: "03",
  },
];

export function DestinationDiscovery() {
  const [filter, setFilter] = useState("Semua");
  const [search, setSearch] = useState("");
  const visible = examples.filter(
    (item) =>
      (filter === "Semua" || item.category === filter) &&
      `${item.title} ${item.category}`
        .toLocaleLowerCase("id")
        .includes(search.toLocaleLowerCase("id").trim()),
  );
  return (
    <section
      id="jelajahi"
      className="scroll-mt-8 border-t border-primary/10 py-16 sm:py-22"
    >
      <div className="content-container">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="eyebrow mb-3 text-accent">Mulai dari satu kota</p>
            <h2 className="display-title text-4xl sm:text-5xl">
              Ruang untuk rasa ingin tahu.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              Palembang menjadi kota pilot. Jelajahi konsep tampilan sebelum
              katalog nyata selesai dikurasi.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/15 bg-card px-5 py-3 text-sm">
            <MapPin className="size-4 text-accent" aria-hidden="true" />
            <span className="font-semibold">Palembang</span>
            <span className="text-muted-foreground">· Kota pilot</span>
          </div>
        </div>
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div
            className="flex gap-2"
            role="group"
            aria-label="Filter pengalaman"
          >
            {["Semua", "Budaya", "Kuliner"].map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={filter === label}
                onClick={() => setFilter(label)}
                className={cn(
                  "min-h-10 rounded-full border px-5 text-xs font-semibold transition-colors",
                  filter === label
                    ? "border-primary bg-primary text-white"
                    : "border-border hover:bg-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-64">
            <span className="sr-only">Cari contoh pengalaman</span>
            <Search
              className="pointer-events-none absolute top-3 left-4 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari contoh pengalaman"
              className="min-h-10 w-full rounded-full border bg-transparent py-2 pr-4 pl-10 text-xs placeholder:text-muted-foreground"
            />
          </label>
        </div>
        <p className="mb-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <SlidersHorizontal className="size-3" aria-hidden="true" />
          <span aria-live="polite">{visible.length} konsep sintetis</span>
          <span>· Bukan destinasi nyata atau rekomendasi terverifikasi</span>
        </p>
        {visible.length ? (
          <div className="grid gap-5 md:grid-cols-3">
            {visible.map((item) => (
              <article
                key={item.id}
                className="group overflow-hidden rounded-2xl border bg-card"
              >
                <div className="relative overflow-hidden">
                  <ExperienceArt
                    kind={item.kind}
                    className="w-full transition-transform duration-500 motion-safe:group-hover:scale-[1.035]"
                  />
                  <Badge
                    variant="secondary"
                    className="absolute top-4 left-4 bg-card/95 text-[10px]"
                  >
                    Contoh sintetis
                  </Badge>
                  <span
                    className="absolute right-4 bottom-3 font-display text-4xl text-white/80"
                    aria-hidden="true"
                  >
                    {item.number}
                  </span>
                </div>
                <div className="p-6">
                  <span className="eyebrow text-[9px] text-accent">
                    {item.category} · Ilustrasi konsep
                  </span>
                  <h3 className="mt-2 font-display text-2xl">{item.title}</h3>
                  <p className="mt-3 text-xs leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                  <details className="mt-5 border-t pt-4 text-xs">
                    <summary className="font-semibold">
                      Tentang contoh ini
                    </summary>
                    <p className="mt-3 leading-6 text-muted-foreground">
                      Identitas ini dibuat untuk pratinjau antarmuka. Lokasi,
                      jam buka, harga, dan klasifikasi nyata belum tersedia.
                      Tidak ada persetujuan peninjau manusia.
                    </p>
                  </details>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div
            className="paper-panel flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center"
            role="status"
          >
            <Search
              className="mb-4 size-7 text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="font-display text-2xl">
              Belum ada contoh yang cocok.
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Coba kata lain atau lihat semua konsep.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={() => {
                setSearch("");
                setFilter("Semua");
              }}
            >
              Reset pencarian
            </Button>
          </div>
        )}
        <div className="mt-7 flex flex-col justify-between gap-3 border-t border-primary/15 pt-5 text-xs sm:flex-row sm:items-center">
          <p className="text-muted-foreground">
            Kota lain menyusul setelah kurasi dan persetujuan yang diperlukan.
          </p>
          <Link
            href="/rencanakan"
            className="flex items-center gap-2 font-semibold"
          >
            Bentuk perjalanan Anda{" "}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
