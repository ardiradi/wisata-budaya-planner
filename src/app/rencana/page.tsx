import type { Metadata } from "next";
import { GeneratedItinerary } from "@/features/planning/generated-itinerary";

export const metadata: Metadata = {
  title: "Hasil perhitungan sintetis",
  description:
    "Demo linimasa dan biaya dengan data sintetis. Bukan rencana perjalanan nyata atau informasi tempat terverifikasi.",
};

export default function ItineraryPage() {
  return <GeneratedItinerary />;
}
