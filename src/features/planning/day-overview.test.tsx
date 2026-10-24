import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildSyntheticScenario,
  generateSyntheticPlan,
} from "@/application/planning/preview-planner";
import { DayOverview } from "./day-overview";

describe("daily clarity without fabricated appointments", () => {
  it("distinguishes a short cost-valid itinerary from a fully planned day", async () => {
    const result = await generateSyntheticPlan(
      buildSyntheticScenario("feasible", "2026-10-23"),
    );
    render(<DayOverview day={result.days[0]} />);
    const region = screen.getByRole("region", {
      name: "Cakupan waktu dan makan",
    });
    expect(region).toHaveTextContent("10:28");
    expect(region).toHaveTextContent("10:38");
    expect(region).toHaveTextContent("442 menit");
    expect(region).toHaveTextContent("158 dari 600 menit");
    expect(region).toHaveTextContent("jam & tempat makan belum ditetapkan");
    expect(region).toHaveTextContent("6 porsi diperlukan, 4 dibeli");
  });
  it("does not present missing routing as available leisure time", async () => {
    const result = await generateSyntheticPlan(
      buildSyntheticScenario("feasible", "2026-10-23"),
      "missing-route",
    );
    render(<DayOverview day={result.days[0]} />);
    expect(
      screen.getByText(/Waktu yang hilang tidak dianggap waktu bebas/),
    ).toBeVisible();
    expect(screen.queryByText(/442 menit/)).not.toBeInTheDocument();
  });

  it("reports evidenced scheduled portions separately from remaining unassigned meals and waiting time", async () => {
    const input = buildSyntheticScenario("feasible", "2026-10-23");
    input.days[0].meals.lunch.scheduling = {
      mode: "scheduled",
      serviceId: "syn-meal-service-food-01",
      window: { start: "12:00", end: "13:00" },
      windowConfirmed: true,
    };
    const result = await generateSyntheticPlan(input);
    render(<DayOverview day={result.days[0]} />);
    const region = screen.getByRole("region", {
      name: "Cakupan waktu dan makan",
    });
    expect(region).toHaveTextContent(
      "2 porsi terjadwal, 0 porsi dengan jadwal belum terpenuhi",
    );
    expect(region).toHaveTextContent("Menunggu jendela waktu");
    expect(region).toHaveTextContent(
      "Jadwal memasukkan layanan makan yang Anda minta",
    );
    expect(region).toHaveTextContent("Pencarian terbatas");
    expect(region).not.toHaveTextContent("jam & tempat makan belum ditetapkan");
  });
});
