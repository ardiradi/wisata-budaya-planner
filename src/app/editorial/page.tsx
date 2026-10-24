import type { Metadata } from "next";
import { EditorialDashboard } from "@/features/editorial/editorial-dashboard";

export const metadata: Metadata = {
  title: "Studio editorial sintetis",
  description:
    "Demonstrasi kurasi, bukti, peninjauan, dan penarikan katalog sintetis. Tanpa autentikasi atau persetujuan manusia nyata.",
};

export default function EditorialPage() {
  return <EditorialDashboard />;
}
