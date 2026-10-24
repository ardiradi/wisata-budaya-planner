import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildSyntheticScenario,
  generateSyntheticPlan,
} from "@/application/planning/preview-planner";
import { cityToday } from "@/features/preferences/intake-preview";
import { RevisionComparison } from "./revision-comparison";

describe("before and after evidence comparison", () => {
  it("makes changed directed route positions explicit when transport changes", async () => {
    const submission = buildSyntheticScenario("feasible", cityToday());
    const before = await generateSyntheticPlan(submission);
    submission.input.transport = "taxi";
    const after = await generateSyntheticPlan(submission);
    render(<RevisionComparison before={before} after={after} />);
    const changes = screen.getByRole("region", {
      name: "Perubahan jadwal, rute dan berjalan",
    });
    expect(changes).toHaveTextContent("3 posisi rute berubah");
    expect(changes).toHaveTextContent("Selisih jalan kaki 0 m/orang");
    expect(changes).toHaveTextContent(
      "Semua rute tetap dihitung ulang sebelum komit",
    );
  });
  it("keeps unknown route cost unknown while preserving the prior known cost and meal inventory", async () => {
    const submission = buildSyntheticScenario("feasible", cityToday());
    const before = await generateSyntheticPlan(submission);
    const after = await generateSyntheticPlan(submission, "missing-route");
    render(<RevisionComparison before={before} after={after} />);
    const previous = screen.getByRole("region", {
      name: "Sebelum perubahan",
    });
    const proposed = screen.getByRole("region", {
      name: "Usulan setelah dihitung ulang",
    });
    expect(previous).toHaveTextContent(/280\.500/);
    expect(proposed).toHaveTextContent("Belum diketahui");
    expect(
      screen.getByText(
        "Selisih biaya belum diketahui; data yang hilang tidak diganti nol.",
      ),
    ).toBeInTheDocument();
    expect(proposed).toHaveTextContent(
      "Makan siang: 2 diperlukan · 0 dibawa · 0 prabayar · 2 dibeli",
    );
    expect(
      within(previous).getByText(/Galeri Sejarah Contoh/),
    ).toBeInTheDocument();
    expect(proposed).toHaveTextContent("08:18–09:18");
    expect(proposed).toHaveTextContent("bukti belum lengkap");
  });
});
