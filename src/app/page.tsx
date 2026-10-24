import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleCheck,
  Leaf,
  MapPin,
  Route,
  Sparkles,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestinationDiscovery } from "@/features/discovery/destination-discovery";
import { COMPETITION_DEMO } from "@/config/demo";

export default function HomePage() {
  return (
    <>
      <section className="content-container grid items-center gap-12 pt-12 pb-14 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:pt-17 lg:pb-20">
        <div className="reveal relative">
          <div className="eyebrow mb-7 flex items-center gap-2 text-accent">
            <span className="h-px w-7 bg-accent" /> Budaya, rasa, dan cerita
          </div>
          <h1 className="display-title max-w-xl text-[clamp(3rem,5.2vw,4.8rem)]">
            Bukan sekadar pergi.
            <br />
            Temukan <span className="italic text-accent">makna</span>
            <br className="hidden sm:block" /> di setiap langkah.
          </h1>
          <p className="mt-7 max-w-md text-sm leading-7 text-muted-foreground sm:text-[15px]">
            Perjalanan yang mengikuti rasa ingin tahu Anda. Rangkai budaya dan
            kuliner dalam ritme yang terasa pas, dengan ruang untuk memahami
            setiap pilihan.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
              <Link href="/rencanakan">
                Mulai rencanakan <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
            <Link
              href="/rencana"
              className="inline-flex min-h-12 items-center gap-2 text-xs font-semibold"
            >
              Lihat contoh rencana{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <p className="mt-5 max-w-md text-xs leading-5 text-muted-foreground">
            {COMPETITION_DEMO
              ? "Coba demo kompetisi"
              : "Coba perhitungan lokal"}{" "}
            dengan katalog, rute, dan biaya sintetis. Tidak ada permintaan AI
            atau rute berbayar.
          </p>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-primary/15 pt-6 text-[11px] font-medium">
            <span className="flex items-center gap-2">
              <BookOpen className="size-4 text-accent" aria-hidden="true" />{" "}
              Cerita dengan sumber
            </span>
            <span className="flex items-center gap-2">
              <Leaf className="size-4 text-accent" aria-hidden="true" /> Ritme
              pilihan Anda
            </span>
            <span className="flex items-center gap-2">
              <Route className="size-4 text-accent" aria-hidden="true" /> Biaya
              yang terbuka
            </span>
          </div>
        </div>
        <figure className="hero-art reveal mx-auto w-full max-w-[470px] px-3 pb-5 lg:px-0">
          <div className="overflow-hidden rounded-t-[48%] rounded-b-3xl">
            <Image
              src="/river-city.svg"
              alt="Ilustrasi konseptual sungai, jembatan, pepohonan dan perahu; bukan gambaran tempat nyata"
              width={640}
              height={680}
              priority
              className="h-auto w-full"
              unoptimized
            />
          </div>
          <figcaption className="absolute right-0 bottom-0 left-5 flex items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-card px-6 py-5 shadow-[0_10px_30px_#23483c12] sm:-left-7 sm:right-7">
            <div>
              <p className="eyebrow text-[8px] text-muted-foreground">
                Awal perjalanan kita
              </p>
              <p className="mt-1 font-display text-2xl">
                Palembang
                <span className="ml-2 text-xs font-sans text-muted-foreground">
                  Indonesia
                </span>
              </p>
              <p className="mt-1 text-[9px] text-muted-foreground">
                Kota pilot · ilustrasi konseptual
              </p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-accent/30 text-accent">
              <MapPin size={19} strokeWidth={1.5} aria-hidden="true" />
            </span>
          </figcaption>
        </figure>
      </section>
      <div className="content-container mb-12 flex items-center justify-between gap-6 border-y border-primary/15 py-5">
        <span className="eyebrow text-[9px] text-muted-foreground">
          Lebih dekat dengan perjalanan Anda
        </span>
        <a
          href="#jelajahi"
          className="flex items-center gap-3 text-[11px] font-medium"
        >
          Mulai menjelajah <ArrowDown className="size-4" aria-hidden="true" />
        </a>
      </div>
      <DestinationDiscovery />
      <section id="cara-kerja" className="bg-[#e9ede4] py-17 sm:py-22">
        <div className="content-container grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-24">
          <div>
            <p className="eyebrow mb-4 text-accent">Sederhana, sejak awal</p>
            <h2 className="display-title text-4xl sm:text-5xl">
              Rencana yang terasa
              <br />
              <span className="italic">seperti Anda.</span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
              Mulai dari keinginan, pahami pilihannya, lalu sesuaikan
              perjalanan. Anda tetap memegang kendali.
            </p>
            <Link
              href="/rencanakan"
              className="mt-7 inline-flex items-center gap-2 border-b border-primary pb-1 text-xs font-semibold"
            >
              Coba alurnya <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <ol className="grid gap-7 sm:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: "Ceritakan ritmenya",
                body: "Pilih tanggal, anggaran, minat, dan kebutuhan harian Anda.",
              },
              {
                icon: Utensils,
                title: "Lihat gambarannya",
                body: "Kenali urutan kegiatan, kebutuhan makan, dan rincian biaya.",
              },
              {
                icon: CircleCheck,
                title: "Pahami batasnya",
                body: "Bedakan fakta, perkiraan, dan hal yang masih perlu ditinjau.",
              },
            ].map((step, index) => (
              <li key={step.title} className="border-t border-primary/20 pt-5">
                <div className="mb-7 flex items-center justify-between">
                  <step.icon
                    className="size-6 text-primary"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="font-display text-2xl text-primary/70">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="content-container py-16 sm:py-22">
        <div className="flex flex-col justify-between gap-7 rounded-3xl bg-primary px-7 py-10 text-primary-foreground sm:px-12 md:flex-row md:items-center">
          <div>
            <p className="eyebrow mb-3 text-[#d6c6a3]">
              Ada cerita di setiap perjalanan
            </p>
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              Mulai dari rasa ingin tahu.
            </h2>
            <p className="mt-3 max-w-md text-xs leading-6 text-[#d4dfd4]">
              Jelajahi pratinjau perencana dengan contoh sintetis. Tidak ada
              akun atau pemesanan yang diperlukan.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="w-fit bg-[#f3e8ce] text-primary hover:bg-white"
          >
            <Link href="/rencanakan">
              Bentuk rencana Anda <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
