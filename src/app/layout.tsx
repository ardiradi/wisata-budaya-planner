import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { PlanningProvider } from "@/features/planning/planning-provider";
import { EditorialProvider } from "@/features/editorial/editorial-provider";
import { COMPETITION_DEMO } from "@/config/demo";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wisata Budaya — perjalanan dengan makna",
    template: "%s | Wisata Budaya",
  },
  description: COMPETITION_DEMO
    ? "Demo Kompetisi — Data Sintetis. Simulasi perencana budaya dan kuliner; bukan saran wisata nyata atau fakta budaya yang ditinjau independen."
    : "Pratinjau lokal perencana perjalanan budaya dan kuliner. Seluruh contoh sintetis, bukan rekomendasi perjalanan nyata.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <a href="#konten-utama" className="skip-link">
          Lewati ke konten utama
        </a>
        <EditorialProvider>
          <PlanningProvider>
            <SiteHeader />
            <main id="konten-utama" tabIndex={-1}>
              {children}
            </main>
            <SiteFooter />
          </PlanningProvider>
        </EditorialProvider>
      </body>
    </html>
  );
}
