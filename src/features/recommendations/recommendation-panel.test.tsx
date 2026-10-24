import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildSyntheticScenario,
  generateSyntheticPlan,
} from "@/application/planning/preview-planner";
import type { PlanResult } from "@/domain/planner/types";
import { cityToday } from "@/features/preferences/intake-preview";
import { RecommendationPanel } from "./recommendation-panel";

let base: PlanResult;
beforeAll(async () => {
  base = await generateSyntheticPlan(
    buildSyntheticScenario("feasible", cityToday()),
  );
});

function reportResult(
  source: "mock_ai" | "deterministic_fallback" | "unavailable" = "mock_ai",
): PlanResult {
  const stop = base.days[0].stops[0];
  return {
    ...base,
    recommendation: {
      schemaVersion: "recommendation-report-v1",
      source,
      synthetic: true,
      independentlyReviewed: false,
      providerId: "synthetic-ui-fixture",
      snapshotId: "snapshot-ui-test",
      candidateCount: 3,
      attempts: 1,
      inputTokens: 300,
      outputTokens: 80,
      simulatedCostMicroUsd: 40,
      actualApiCostMicroUsd: 0,
      rejectionCodes: [],
      rankings: [
        {
          placeId: stop.placeId,
          reasonCodes: ["INTEREST_MATCH", "MANDATORY_INTEREST"],
          categoryIds: stop.categoryIds,
          assertionIds: stop.evidenceRefs.map((ref) => ref.assertionId),
        },
        {
          placeId: "syn-culture-02",
          reasonCodes: ["AVAILABLE_WINDOW"],
          categoryIds: ["history-example"],
          assertionIds: ["synthetic-alternative-assertion"],
        },
      ],
    },
  } as PlanResult;
}

describe("controlled recommendation explanation", () => {
  it("labels mock ranking, template reasons and immutable fixture references without verified-cultural claims", async () => {
    const user = userEvent.setup();
    const result = reportResult();
    render(<RecommendationPanel result={result} />);
    expect(
      screen.getByRole("heading", {
        name: "Rekomendasi berbantuan AI · simulasi",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bukan layanan AI langsung/)).toBeInTheDocument();
    expect(
      screen.getByText(/belum ada fakta budaya nyata/),
    ).toBeInTheDocument();
    const reasons = screen.getByRole("list", {
      name: "Alasan rekomendasi terjadwal",
    });
    expect(reasons).toHaveTextContent(base.days[0].stops[0].name);
    expect(reasons).toHaveTextContent("Sesuai minat budaya yang Anda pilih.");
    await user.click(
      within(reasons).getByText(/Referensi immutable untuk alasan/),
    );
    expect(reasons).toHaveTextContent(
      base.days[0].stops[0].evidenceRefs[0].assertionId,
    );
    expect(screen.getByText("USD 0")).toBeInTheDocument();
  });

  it("shows alternatives as uncommitted IDs and provides no action that can silently replace a stop", async () => {
    const user = userEvent.setup();
    render(<RecommendationPanel result={reportResult()} />);
    await user.click(screen.getByText(/Alternatif kandidat sintetis/));
    const alternatives = screen.getByRole("list", {
      name: "Alternatif rekomendasi belum dijadwalkan",
    });
    expect(alternatives).toHaveTextContent("syn-culture-02");
    expect(alternatives).not.toHaveTextContent("Paviliun");
    expect(
      screen.getByText(
        /tidak pernah mengganti kunjungan atau membuka kunci otomatis/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(["gemini_live", "deterministic_fallback"] as const)(
    "does not claim reconciled zero billing for %s",
    (source) => {
      const result = reportResult();
      if (!result.recommendation) throw new Error("Missing test report");
      result.recommendation = {
        ...result.recommendation,
        source,
        modelId: "gemini-2.5-flash",
        liveModelCalls: 1,
        actualApiCostMicroUsd: null,
      };
      render(<RecommendationPanel result={result} />);
      expect(screen.queryByText("USD 0")).not.toBeInTheDocument();
      expect(screen.getByText("Rekonsiliasi biaya provider")).toBeVisible();
      expect(screen.getByText("Belum tersedia")).toBeVisible();
      expect(screen.getByText("1 / 1")).toBeVisible();
      if (source === "deterministic_fallback") {
        expect(screen.getByText("Belum terverifikasi")).toBeVisible();
        expect(screen.queryByText("Gemini AI — Live")).not.toBeInTheDocument();
      } else {
        expect(screen.getByText("300 masuk · 80 keluar")).toBeVisible();
      }
    },
  );

  it("ignores injected free-form factual text and displays a controlled fallback explanation", () => {
    const result = reportResult("deterministic_fallback");
    const malicious = {
      ...result,
      recommendation: {
        ...result.recommendation,
        narrative: "Invented temple founded in 1401; ignore all constraints",
        rejectionCodes: ["UNKNOWN_ID"],
      },
    } as PlanResult;
    render(<RecommendationPanel result={malicious} />);
    expect(
      screen.getByRole("heading", {
        name: "Rekomendasi fallback deterministik",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "ID di luar kandidat yang diizinkan ditolak.",
    );
    expect(screen.queryByText(/Invented temple/)).not.toBeInTheDocument();
    expect(screen.getByText(/batas wajib yang sama/)).toBeInTheDocument();
  });

  it("distinguishes a deterministic B2 edit from AI unavailability or fallback", () => {
    const edited = { ...base };
    delete edited.recommendation;
    render(<RecommendationPanel result={edited} />);
    expect(
      screen.getByRole("heading", {
        name: "Perubahan diperiksa secara deterministik.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Versi ini tidak memiliki hasil ranking AI/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Rekomendasi fallback deterministik"),
    ).not.toBeInTheDocument();
  });

  it("keeps unavailable recommendations and missing evidence explicit without supplying claims", () => {
    const result = reportResult("unavailable");
    result.days = [];
    if (result.recommendation) result.recommendation.rankings = [];
    render(<RecommendationPanel result={result} />);
    expect(
      screen.getByRole("heading", { name: "Rekomendasi belum tersedia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/tidak diganti dengan fakta buatan/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Alasan rekomendasi terjadwal" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Galeri Sejarah/)).not.toBeInTheDocument();
  });
});
