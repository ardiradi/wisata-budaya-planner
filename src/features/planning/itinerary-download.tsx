"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createItineraryTextExport } from "@/application/planning/itinerary-export";
import { usePlanning } from "./planning-provider";

export function ItineraryDownload() {
  const planning = usePlanning();
  const [message, setMessage] = useState("");
  const available =
    planning.editingSnapshot?.current.availability === "available";
  function download() {
    try {
      const session = planning.editingSession;
      session?.refreshEvidence();
      const current = session?.getSnapshot().current;
      if (!current || current.availability !== "available")
        throw new Error("Unavailable current evidence");
      const file = createItineraryTextExport(
        current.result,
        current.id,
        new Date().toISOString(),
      );
      const url = URL.createObjectURL(
        new Blob([file.text], { type: "text/plain;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "Salinan sintetis diunduh. Simpan secara sadar; unduhan tidak mengikuti perubahan bukti.",
      );
    } catch {
      setMessage(
        "Unduhan belum tersedia. Bukti terkini perlu diperiksa; versi lama tidak diekspor.",
      );
    }
  }
  return (
    <div>
      <Button
        variant="outline"
        disabled={!available || planning.phase === "loading"}
        onClick={download}
      >
        <Download className="size-4" aria-hidden="true" />
        Unduh rencana sintetis (.txt)
      </Button>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 max-w-xl text-xs leading-6 text-muted-foreground"
      >
        {message ||
          "Semua hari · status bukti, ID revisi dan waktu pemeriksaan disertakan. Unduhan hanya atas pilihan Anda."}
      </p>
    </div>
  );
}
