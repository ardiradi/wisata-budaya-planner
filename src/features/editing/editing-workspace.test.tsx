import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { buildSyntheticScenario } from "@/application/planning/preview-planner";
import { cityToday } from "@/features/preferences/intake-preview";
import { GeneratedItinerary } from "@/features/planning/generated-itinerary";
import {
  PlanningProvider,
  usePlanning,
} from "@/features/planning/planning-provider";

function RepeatIntake() {
  const planning = usePlanning();
  return (
    <button
      onClick={() =>
        void planning.generate(
          buildSyntheticScenario("low-budget", cityToday()),
        )
      }
    >
      Kirim ulang intake anggaran kecil
    </button>
  );
}
function renderPlanner() {
  render(
    <PlanningProvider>
      <RepeatIntake />
      <GeneratedItinerary />
    </PlanningProvider>,
  );
}
async function start(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: /Jalankan: Layak dalam simulasi/ }),
  );
  await screen.findByText("Valid dalam simulasi sintetis", { exact: true });
  await user.click(screen.getByRole("button", { name: "Buka editor rencana" }));
  return screen.getByRole("region", {
    name: "Ubah, lihat, lalu terapkan.",
  });
}

describe("local interactive editing", () => {
  it("previews a real destination swap and explicitly adds a new revision without erasing version one", async () => {
    const user = userEvent.setup();
    renderPlanner();
    const room = await start(user);
    await user.click(
      within(room).getByRole("button", {
        name: "Ganti Galeri Sejarah Contoh · sintetis",
      }),
    );
    await user.selectOptions(
      await within(room).findByLabelText("Destinasi pengganti sintetis", {}),
      "syn-culture-02",
    );
    await user.click(
      within(room).getByRole("button", {
        name: "Pratinjau penggantian",
      }),
    );
    await within(room).findByText("Usulan valid dalam simulasi", {});
    expect(
      within(room).getByRole("region", {
        name: "Sebelum perubahan",
      }),
    ).toHaveTextContent("Galeri Sejarah Contoh");
    expect(
      within(room).getByRole("region", {
        name: "Usulan setelah dihitung ulang",
      }),
    ).toHaveTextContent("Paviliun Contoh");
    expect(screen.getByTestId("total-upper")).toHaveTextContent(/280\.500/);
    await user.click(
      within(room).getByRole("button", {
        name: "Terapkan sebagai versi baru",
      }),
    );
    await within(room).findByText("Versi aktif 2 · valid dalam simulasi", {});
    expect(screen.getByTestId("total-upper")).toHaveTextContent(/302\.500/);
    expect(
      within(room).getByRole("button", {
        name: "Tinjau kembali versi 1",
      }),
    ).toBeEnabled();
    expect(
      within(room).getByText("2 versi immutable", { exact: true }),
    ).toBeInTheDocument();
  });

  it("requires explicit acknowledgement for a blocked removal and leaves the valid revision active until then", async () => {
    const user = userEvent.setup();
    renderPlanner();
    const room = await start(user);
    await user.click(
      within(room).getByRole("button", {
        name: "Hapus Galeri Sejarah Contoh · sintetis",
      }),
    );
    await within(room).findByText("Usulan terblokir", { exact: true });
    expect(
      within(room).getByRole("list", {
        name: "Konsekuensi dan bukti yang belum lengkap",
      }),
    ).toHaveTextContent(/wajib/i);
    const commit = within(room).getByRole("button", {
      name: "Simpan usulan terblokir secara eksplisit",
    });
    expect(commit).toBeDisabled();
    expect(
      within(room).getByText("Versi aktif 1 · valid dalam simulasi", {}),
    ).toBeInTheDocument();
    await user.click(
      within(room).getByRole("checkbox", {
        name: /Saya memilih menyimpan usulan terblokir ini secara eksplisit/,
      }),
    );
    await user.click(commit);
    await within(room).findByText("Versi aktif 2 · terblokir", { exact: true });
    expect(
      within(room).getByText("Versi valid terakhir: 1", { exact: true }),
    ).toBeInTheDocument();
    expect(
      within(room).getByRole("button", {
        name: "Tinjau kembali versi 1",
      }),
    ).toBeEnabled();
  });

  it("keeps lock controls disabled until an explicit unlock has been previewed and committed", async () => {
    const user = userEvent.setup();
    renderPlanner();
    const room = await start(user);
    await user.click(
      within(room).getByRole("button", {
        name: "Kunci Galeri Sejarah Contoh · sintetis",
      }),
    );
    await within(room).findByText("Usulan valid dalam simulasi", {});
    await user.click(
      within(room).getByRole("button", {
        name: "Terapkan sebagai versi baru",
      }),
    );
    await within(room).findByRole("button", {
      name: "Buka kunci Galeri Sejarah Contoh · sintetis",
    });
    expect(
      within(room).getByRole("button", {
        name: "Hapus Galeri Sejarah Contoh · sintetis",
      }),
    ).toBeDisabled();
    expect(
      within(room).getByRole("button", {
        name: "Turunkan Galeri Sejarah Contoh · sintetis",
      }),
    ).toBeDisabled();
    await user.click(
      within(room).getByRole("button", {
        name: "Buka kunci Galeri Sejarah Contoh · sintetis",
      }),
    );
    await within(room).findByText("Usulan valid dalam simulasi", {});
    await user.click(
      within(room).getByRole("button", {
        name: "Terapkan sebagai versi baru",
      }),
    );
    await within(room).findByText("Versi aktif 3 · valid dalam simulasi", {});
    expect(
      within(room).getByRole("button", {
        name: "Hapus Galeri Sejarah Contoh · sintetis",
      }),
    ).toBeEnabled();
  });

  it("turns another intake submission into a preview rather than silently replacing existing history", async () => {
    const user = userEvent.setup();
    renderPlanner();
    const room = await start(user);
    await user.click(
      screen.getByRole("button", {
        name: "Kirim ulang intake anggaran kecil",
      }),
    );
    await within(room).findByText("Usulan terblokir", { exact: true });
    expect(
      screen.getByText("Valid dalam simulasi sintetis", { exact: true }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("total-upper")).toHaveTextContent(/280\.500/);
    expect(
      within(room).getByText("1 versi immutable", { exact: true }),
    ).toBeInTheDocument();
    await user.click(
      within(room).getByRole("button", {
        name: "Batalkan usulan",
      }),
    );
    expect(
      within(room).queryByRole("heading", {
        name: "Pratinjau perubahan",
      }),
    ).not.toBeInTheDocument();
  });
});
