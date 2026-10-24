"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowUpRight, Compass, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COMPETITION_DEMO, DEMO_LABEL } from "@/config/demo";

const links = [
  { href: "/#jelajahi", label: "Jelajahi" },
  { href: "/#cara-kerja", label: "Cara kerja" },
  { href: "/rencana", label: "Contoh rencana" },
  { href: "/editorial", label: "Studio katalog" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  return (
    <>
      <div className="border-b border-primary/10 bg-[#e9ede4] px-4 py-2 text-center text-xs leading-relaxed text-primary">
        {COMPETITION_DEMO ? DEMO_LABEL : "Pratinjau lokal · Data sintetis"}
        {" · "}Belum ditinjau manusia. Tidak untuk perjalanan nyata.
      </div>
      <header
        className="relative z-30 border-b border-primary/10 bg-background/95"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            menuButtonRef.current?.focus();
          }
        }}
      >
        <div className="content-container flex h-21 items-center justify-between gap-5">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            onClick={() => setOpen(false)}
          >
            <span className="sr-only">Beranda: </span>
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-background">
              <Compass
                className="size-6"
                strokeWidth={1.4}
                aria-hidden="true"
              />
            </span>
            <span className="text-[17px] font-bold tracking-tight">
              wisata<span className="font-normal">budaya</span>
              <span className="ml-0.5 text-accent">.</span>{" "}
              <span className="block text-[8px] font-medium uppercase tracking-[.27em]">
                Perjalanan dengan makna
              </span>
            </span>
          </Link>
          <nav
            aria-label="Navigasi utama"
            className="hidden items-center gap-7 md:flex"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cn(
                  "text-xs font-medium transition-colors hover:text-accent",
                  pathname === link.href && "text-accent",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/rencanakan">
                Rencanakan perjalanan <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={open ? "Tutup navigasi" : "Buka navigasi"}
              aria-expanded={open}
              aria-controls="mobile-navigation"
              onClick={() => setOpen(!open)}
              className="flex size-11 items-center justify-center rounded-full border md:hidden"
            >
              {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            id="mobile-navigation"
            aria-label="Navigasi seluler"
            className="border-t bg-background p-5 md:hidden"
          >
            <div className="content-container flex flex-col gap-1">
              {[
                ...links,
                { href: "/rencanakan", label: "Rencanakan perjalanan" },
              ].map((link) => (
                <Link
                  className="rounded-lg px-3 py-3 text-sm hover:bg-secondary"
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
