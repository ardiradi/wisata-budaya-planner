import {
  fireEvent,
  render as renderBase,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PreferenceIntake } from "./preference-intake";
import { PlanningProvider } from "@/features/planning/planning-provider";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const render = (component: ReactNode) =>
  renderBase(component, { wrapper: PlanningProvider });

describe("synthetic traveler intake", () => {
  it("leaves meals costed without clocks by default and focuses a recoverable missing-window error after an explicit scheduling request", async () => {
    const user = userEvent.setup();
    render(<PreferenceIntake initialToday="2026-10-23" />);
    const start = screen.getByLabelText(
      "Tanggal mulai contoh",
    ) as HTMLInputElement;
    fireEvent.change(screen.getByLabelText("Tanggal selesai contoh"), {
      target: { value: start.value },
    });
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    expect(
      screen.getByLabelText("Seberapa banyak hari ingin direncanakan?"),
    ).toHaveValue("short");
    await user.selectOptions(
      screen.getByLabelText("Seberapa banyak hari ingin direncanakan?"),
      "pace",
    );
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    expect(screen.getByLabelText("Makan siang: pengaturan waktu")).toHaveValue(
      "unscheduled",
    );
    await user.selectOptions(
      screen.getByLabelText("Makan siang: pengaturan waktu"),
      "scheduled",
    );
    expect(
      screen.getByLabelText("Makan siang: awal rentang makan"),
    ).toHaveValue("");
    await user.click(
      screen.getByRole("checkbox", {
        name: /Saya mengonfirmasi inventaris contoh hari ini lengkap/,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "isi awal dan akhir rentang makan",
    );
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "konfirmasi rentang makan yang Anda tentukan",
    );
    expect(
      screen.getByRole("spinbutton", {
        name: "Makan siang: diperlukan (porsi)",
      }),
    ).toHaveValue(2);
  });
  it("copies only daily times and anchors while preserving portions and requiring fresh per-day confirmation", async () => {
    const user = userEvent.setup();
    render(<PreferenceIntake initialToday="2026-10-23" />);
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    fireEvent.change(screen.getByLabelText("Mulai aktivitas"), {
      target: { value: "13:00" },
    });
    fireEvent.change(screen.getByLabelText("Selesai aktivitas"), {
      target: { value: "16:00" },
    });
    await user.click(
      screen.getByRole("checkbox", {
        name: /Saya mengonfirmasi inventaris contoh hari ini lengkap/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Periksa Hari 2" }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Makan siang: dibawa (porsi)" }),
      { target: { value: "1" } },
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /Saya mengonfirmasi inventaris contoh hari ini lengkap/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Hari 1" }));
    await user.click(
      screen.getByRole("button", {
        name: "Salin waktu & titik ke 1 hari lain",
      }),
    );
    expect(
      screen.getByText(/Waktu dan titik perjalanan disalin ke 1 hari lain/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Hari 2" }));
    expect(screen.getByLabelText("Mulai aktivitas")).toHaveValue("13:00");
    expect(screen.getByLabelText("Selesai aktivitas")).toHaveValue("16:00");
    expect(
      screen.getByRole("spinbutton", { name: "Makan siang: dibawa (porsi)" }),
    ).toHaveValue(1);
    expect(
      screen.getByRole("checkbox", {
        name: /Saya mengonfirmasi inventaris contoh hari ini lengkap/,
      }),
    ).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Hari 2: konfirmasi seluruh inventaris makan",
    );
  });
  it("uses the serialized request-date seed even when the browser clock differs", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-24T06:00:00Z"));
      const { rerender } = render(
        <PreferenceIntake initialToday="2026-10-23" />,
      );
      expect(screen.getByLabelText("Tanggal mulai contoh")).toHaveValue(
        "2026-10-30",
      );
      expect(screen.getByLabelText("Tanggal selesai contoh")).toHaveValue(
        "2026-10-31",
      );
      expect(screen.getByLabelText("Tanggal mulai contoh")).toHaveAttribute(
        "min",
        "2026-10-23",
      );
      vi.setSystemTime(new Date("2026-11-25T06:00:00Z"));
      rerender(<PreferenceIntake initialToday="2026-10-23" />);
      expect(screen.getByLabelText("Tanggal mulai contoh")).toHaveValue(
        "2026-10-30",
      );
      expect(screen.getByLabelText("Tanggal mulai contoh")).toHaveAttribute(
        "min",
        "2026-10-23",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("retains inputs when returning and focuses a recoverable error without proceeding", async () => {
    const user = userEvent.setup();
    render(<PreferenceIntake />);
    expect(
      screen.getByText(/Preview lokal · data sintetis/),
    ).toBeInTheDocument();
    const budget = screen.getByRole("textbox", {
      name: "Total anggaran grup (IDR)",
    });
    await user.clear(budget);
    await user.type(budget, "0");
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /rupiah bulat yang lebih besar dari nol/,
    );
    expect(
      screen.getByRole("heading", { name: "Ruang untuk perjalanan Anda" }),
    ).toBeInTheDocument();
    await user.clear(budget);
    await user.type(budget, "2000000");
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    expect(
      screen.getByRole("heading", { name: "Apa yang membuat Anda penasaran?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kembali" }));
    expect(
      screen.getByRole("textbox", { name: "Total anggaran grup (IDR)" }),
    ).toHaveValue("2000000");
  });

  it("preserves hard requirements, requires meal confirmation, and gates the calculated-result handoff", async () => {
    const user = userEvent.setup();
    render(<PreferenceIntake />);
    // One-day example keeps this a traveler journey test, not a scheduler test.
    const start = screen.getByLabelText(
      "Tanggal mulai contoh",
    ) as HTMLInputElement;
    fireEvent.change(screen.getByLabelText("Tanggal selesai contoh"), {
      target: { value: start.value },
    });
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    await user.click(
      screen.getByRole("checkbox", {
        name: "Wajib tercakup sepanjang perjalanan",
      }),
    );
    await user.selectOptions(
      screen.getByLabelText("Kebutuhan akses contoh"),
      "step-free",
    );
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /konfirmasi seluruh inventaris makan/,
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /Saya mengonfirmasi inventaris contoh hari ini lengkap/,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    expect(
      screen.getByRole("heading", { name: "Satu pandangan, semua preferensi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Kebutuhan wajib tetap diperiksa/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Jejak sejarah \(wajib\)/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Hitung rencana sintetis/ }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: /Saya memahami bahwa hasil dihitung/,
      }),
    );
    const navigation = screen.getByRole("button", {
      name: /^Hitung rencana sintetis/,
    });
    expect(navigation).toBeEnabled();
    const summary = screen.getByRole("region", {
      name: "Gambaran perjalanan contoh",
    });
    expect(
      within(summary).getByText(/wajib pintu masuk tanpa anak tangga/),
    ).toBeInTheDocument();
  });

  it("retains an extra necessary occasion across days and review, and prevents removing outstanding portions", async () => {
    const user = userEvent.setup();
    render(<PreferenceIntake />);
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    const dailyConfirmation = () =>
      screen.getByRole("checkbox", {
        name: /Saya mengonfirmasi inventaris contoh hari ini lengkap/,
      });
    await user.click(dailyConfirmation());
    await user.click(
      screen.getByRole("button", { name: "Tambah waktu makan contoh" }),
    );
    expect(dailyConfirmation()).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Hapus makan tambahan 1" }),
    ).toBeDisabled();
    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Makan tambahan 1: dibawa (porsi)",
      }),
      { target: { value: "1" } },
    );
    await user.click(dailyConfirmation());
    await user.click(screen.getByRole("button", { name: "Hari 2" }));
    expect(
      screen.queryByRole("spinbutton", {
        name: "Makan tambahan 1: dibawa (porsi)",
      }),
    ).not.toBeInTheDocument();
    await user.click(dailyConfirmation());
    await user.click(screen.getByRole("button", { name: /Hari 1/ }));
    expect(
      screen.getByRole("spinbutton", {
        name: "Makan tambahan 1: dibawa (porsi)",
      }),
    ).toHaveValue(1);
    await user.click(screen.getByRole("button", { name: /^Lanjutkan/ }));
    expect(
      screen.getByText(/Makan tambahan 1 2 porsi \(1 dibawa, 0 prabayar\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("13 porsi perlu dibeli.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kembali" }));
    expect(
      screen.getByRole("spinbutton", {
        name: "Makan tambahan 1: dibawa (porsi)",
      }),
    ).toHaveValue(1);
    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Makan tambahan 1: diperlukan (porsi)",
      }),
      { target: { value: "0" } },
    );
    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Makan tambahan 1: dibawa (porsi)",
      }),
      { target: { value: "0" } },
    );
    expect(
      screen.getByRole("button", { name: "Hapus makan tambahan 1" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: /inventaris contoh makan tambahan 1 hari ini memang tidak memiliki porsi/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Hapus makan tambahan 1" }),
    );
    expect(
      screen.queryByRole("spinbutton", {
        name: "Makan tambahan 1: diperlukan (porsi)",
      }),
    ).not.toBeInTheDocument();
    expect(dailyConfirmation()).not.toBeChecked();
  });
});
