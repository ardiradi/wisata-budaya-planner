import { describe, expect, it } from "vitest";
import {
  buildSyntheticScenario,
  generateSyntheticPlan,
} from "./preview-planner";
import { createItineraryTextExport } from "./itinerary-export";
const today = "2026-10-23";
const exported = "2026-10-23T12:00:00.000Z";

describe("explicit synthetic text export", () => {
  it("exports all seven days, revision, timestamps and unassigned meals without changing the plan", async () => {
    const input = buildSyntheticScenario("feasible", today);
    input.input.endDate = "2026-10-30";
    const { initialDay } =
      await import("@/features/preferences/intake-preview");
    input.days = Array.from({ length: 7 }, (_, i) => ({
      ...initialDay(`2026-10-${24 + i}`, 2),
      inventoryConfirmed: true,
    }));
    input.input.budget = "10000000";
    const result = await generateSyntheticPlan(input);
    const before = JSON.stringify(result);
    const output = createItineraryTextExport(result, "local-rev-7", exported);
    expect(output.filename).toMatch(/^wisata-budaya-sintetis-.*\.txt$/);
    expect(output.text).toContain("HARI 7 — 2026-10-30");
    expect(output.text).toContain("Revisi: local-rev-7");
    expect(output.text).toContain(`Dihitung/diperiksa: ${result.evaluatedAt}`);
    expect(output.text).toContain(`Diekspor: ${exported}`);
    expect(output.text).toContain("Jam/tempat belum ditetapkan");
    expect(output.text).toContain("tidak diperbarui setelah bukti berubah");
    expect(output.text).toContain("Tidak ada persetujuan manusia independen");
    expect(JSON.stringify(result)).toBe(before);
  });
  it("labels a blocked budget and preserves every necessary portion", async () => {
    const result = await generateSyntheticPlan(
      buildSyntheticScenario("low-budget", today),
    );
    const file = createItineraryTextExport(result, "blocked-rev", exported);
    expect(file.text).toContain("Status: TERBLOKIR");
    expect(file.text).toContain("Makan malam: 2 perlu");
  });
  it("rejects tampered result data and invalid export dates", async () => {
    const result = await generateSyntheticPlan(
      buildSyntheticScenario("feasible", today),
    );
    expect(() =>
      createItineraryTextExport(
        { ...result, synthetic: false },
        "rev",
        exported,
      ),
    ).toThrow();
    expect(() =>
      createItineraryTextExport(result, "rev", "not-a-date"),
    ).toThrow();
  });

  it("exports the actual scheduled meal window and service charge while clearly keeping other necessary meals unscheduled", async () => {
    const input = buildSyntheticScenario("feasible", today);
    input.days[0].meals.lunch.scheduling = {
      mode: "scheduled",
      serviceId: "syn-meal-service-food-01",
      window: { start: "12:00", end: "13:00" },
      windowConfirmed: true,
    };
    const result = await generateSyntheticPlan(input);
    expect(result.status).toBe("validated");
    const lunch = result.days[0].meals.find((meal) => meal.id === "lunch")!;
    expect(lunch.schedulingStatus).toBe("scheduled");
    const file = createItineraryTextExport(result, "meal-rev", exported);
    expect(file.text).toContain(
      "Makan terjadwal dalam simulasi 12:00–12:30 WIB",
    );
    expect(file.text).toContain("Biaya layanan grup terpisah");
    expect(file.text).toContain("Makan malam: 2 perlu");
    expect(file.text).toContain(
      "Biaya tanpa jadwal makan. Jam/tempat belum ditetapkan",
    );
  });
});
