import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEMO_LABEL } from "@/config/demo";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { GeminiControls } from "./gemini-controls";
import { GeneratedItinerary } from "@/features/planning/generated-itinerary";
import { PlanningProvider } from "@/features/planning/planning-provider";
import { getGeminiProxy } from "@/infrastructure/browser/gemini-proxy";
import type { RankingRequest } from "@/domain/recommendations/contracts";

vi.mock("@/config/demo", () => ({
  COMPETITION_DEMO: true,
  DEMO_LABEL: "Demo Kompetisi — Data Sintetis",
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/rencana" }));

describe("competition public UI", () => {
  it("does not mount Gemini readiness controls or request status in competition mode", () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const run = vi.fn();
    const view = render(<GeminiControls disabled={false} onRun={run} />);
    expect(view.container).toBeEmptyDOMElement();
    expect(fetcher).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses even a programmatically invoked live browser adapter without dispatch", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const result = await getGeminiProxy("gemini-2.5-flash").rank(
      {} as RankingRequest,
      {
        signal: new AbortController().signal,
        attempt: 1,
      },
    );
    expect(result).toMatchObject({
      status: "error",
      code: "LIVE_DISABLED",
      retryable: false,
      usage: { modelCalls: 0 },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("truthfully labels the hosted demo and generates/recoveries in memory without Gemini or browser storage", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const user = userEvent.setup();
    const view = render(
      <PlanningProvider>
        <SiteHeader />
        <GeneratedItinerary />
        <SiteFooter />
      </PlanningProvider>,
    );
    expect(screen.getAllByText(new RegExp(DEMO_LABEL)).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.queryByText("Status uji Gemini · opsional"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Demo lokal/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pratinjau lokal/)).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Jalankan: Layak dalam simulasi/ }),
    );
    expect(
      await screen.findByText("Valid dalam simulasi sintetis"),
    ).toBeVisible();
    expect(screen.getByTestId("recommendation-panel")).toHaveTextContent(
      "Rekomendasi berbantuan AI · simulasi",
    );
    expect(screen.queryByText("Jejak rekomendasi")).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Hapus hasil dari memori" }),
    );
    expect(
      screen.getByRole("heading", { name: "Belum ada hasil di sesi ini." }),
    ).toBeVisible();
    view.unmount();
    render(
      <PlanningProvider>
        <GeneratedItinerary />
      </PlanningProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Belum ada hasil di sesi ini." }),
    ).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });
});
