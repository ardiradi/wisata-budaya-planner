import type { Metadata } from "next";
import { PreferenceIntake } from "@/features/preferences/preference-intake";
import { cityToday } from "@/features/preferences/intake-preview";

// Date-only defaults must use the same request-time seed on the server and client.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rencanakan perjalanan contoh",
  description:
    "Demo alur preferensi perjalanan budaya dan kuliner. Semua pilihan menggunakan skenario sintetis, tanpa AI atau routing langsung.",
};

export default function PlanPreferencesPage() {
  return <PreferenceIntake initialToday={cityToday()} />;
}
