import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GeneratedItinerary } from "./generated-itinerary";
import { PlanningProvider } from "./planning-provider";

function renderPlanner() {
  return render(
    <PlanningProvider>
      <GeneratedItinerary />
    </PlanningProvider>,
  );
}

describe("temporary synthetic itinerary integration", () => {
  it("announces pending mock ranking and disables new submissions until the local calculation finishes", async () => {
    let resume: FrameRequestCallback | undefined;
    const frame = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback) => {
        resume = callback;
        return 1;
      });
    try {
      const user = userEvent.setup();
      renderPlanner();
      await user.click(
        screen.getByRole("button", { name: /Profil sintetis.*Jejak sejarah/ }),
      );
      const status = screen
        .getByRole("heading", { name: "Menghitung rencana sintetis…" })
        .closest("section");
      expect(status).toHaveAttribute("role", "status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveTextContent("Menghitung rencana sintetis");
      expect(status).toHaveTextContent("adapter rekomendasi terpilih");
      expect(
        screen.getByRole("combobox", { name: "Skenario rekomendasi sintetis" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /Profil sintetis.*Jejak sejarah/ }),
      ).toBeDisabled();
      expect(
        screen.queryByTestId("recommendation-panel"),
      ).not.toBeInTheDocument();
      expect(resume).toBeTypeOf("function");
      await act(async () => {
        resume!(0);
      });
      expect(
        await screen.findByText("Valid dalam simulasi sintetis"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("recommendation-panel")).toHaveTextContent(
        "Rekomendasi berbantuan AI · simulasi",
      );
    } finally {
      frame.mockRestore();
    }
  });

  it("starts empty and generates through the actual local planner with complete costs and evidence", async () => {
    const user = userEvent.setup();
    renderPlanner();
    expect(
      screen.getByRole("heading", { name: "Belum ada hasil di sesi ini." }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Valid dalam simulasi sintetis"),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Jalankan: Layak dalam simulasi/ }),
    );
    expect(
      await screen.findByText("Valid dalam simulasi sintetis"),
    ).toBeInTheDocument();
    const costs = screen.getByRole("region", {
      name: "Anggaran, dengan jelas.",
    });
    expect(within(costs).getByTestId("total-upper")).not.toHaveTextContent(
      "Belum diketahui",
    );
    expect(costs).toHaveTextContent("tanpa perjalanan pengambilan tambahan");
    const meals = screen.getByRole("region", {
      name: "Semua kebutuhan makan hari ini",
    });
    expect(meals).toHaveTextContent(
      "2 diperlukan · 2 dibawa · 0 prabayar · 0 dibeli",
    );
    expect(meals).toHaveTextContent(
      "2 diperlukan · 0 dibawa · 0 prabayar · 2 dibeli",
    );
    expect(
      screen.getByRole("region", { name: "Minat wajib sepanjang perjalanan" }),
    ).toHaveTextContent("Tercakup dalam simulasi");
    await user.click(
      screen.getByRole("button", { name: "Hapus hasil dari memori" }),
    );
    expect(
      screen.getByRole("heading", { name: "Belum ada hasil di sesi ini." }),
    ).toBeInTheDocument();
  });

  it("renders actual budget violations while keeping necessary food purchases visible", async () => {
    const user = userEvent.setup();
    renderPlanner();
    await user.click(
      screen.getByRole("button", { name: /Jalankan: Anggaran tidak cukup/ }),
    );
    expect(
      await screen.findByText("Terblokir · batas wajib belum terpenuhi"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tidak ada kebutuhan wajib, porsi makan, atau batas yang dihapus otomatis",
    );
    expect(
      screen.getByRole("region", { name: "Semua kebutuhan makan hari ini" }),
    ).toHaveTextContent("2 dibeli");
  });

  it("renders missing route evidence as draft with unknown total instead of manufactured zero", async () => {
    const user = userEvent.setup();
    renderPlanner();
    await user.click(
      screen.getByRole("button", { name: /Jalankan: Bukti rute hilang/ }),
    );
    expect(
      await screen.findByText("Draf · bukti simulasi belum lengkap"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("total-upper")).toHaveTextContent(
      "Belum diketahui",
    );
    expect(
      screen.getByRole("region", { name: "Yang masih perlu diselesaikan" }),
    ).toHaveTextContent("Belum diketahui");
    expect(
      screen.getByText(
        "Rute belum terbukti; tidak diganti dengan waktu atau biaya nol.",
      ),
    ).toBeInTheDocument();
  });
});
