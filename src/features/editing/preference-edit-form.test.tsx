import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildSyntheticScenario } from "@/application/planning/preview-planner";
import { PreferenceEditForm } from "./preference-edit-form";

describe("explicit synthetic preference edits", () => {
  it("preserves all necessary meal portions while previewing a budget change", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const submission = buildSyntheticScenario("feasible", "2026-10-23");
    render(
      <PreferenceEditForm
        submission={submission}
        busy={false}
        onPreview={onPreview}
      />,
    );
    await user.clear(screen.getByLabelText("Anggaran edit (IDR)"));
    await user.type(screen.getByLabelText("Anggaran edit (IDR)"), "10000");
    await user.click(
      screen.getByRole("button", { name: "Pratinjau perubahan preferensi" }),
    );
    expect(onPreview).toHaveBeenCalledOnce();
    expect(onPreview.mock.calls[0][0].input.budget).toBe("10000");
    expect(onPreview.mock.calls[0][0].days[0].meals).toEqual(
      submission.days[0].meals,
    );
    expect(submission.input.budget).toBe("1500000");
  });

  it("sends explicit time and mandatory-interest changes together", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    render(
      <PreferenceEditForm
        submission={buildSyntheticScenario("feasible", "2026-10-23")}
        busy={false}
        onPreview={onPreview}
      />,
    );
    await user.clear(screen.getByLabelText("Mulai hari 1"));
    await user.type(screen.getByLabelText("Mulai hari 1"), "10:00");
    await user.click(screen.getByLabelText("Kriya & tradisi wajib"));
    await user.click(
      screen.getByRole("button", { name: "Pratinjau perubahan preferensi" }),
    );
    expect(onPreview.mock.calls[0][0].days[0].start).toBe("10:00");
    expect(onPreview.mock.calls[0][0].input.mandatoryInterests).toContain(
      "craft-example",
    );
    expect(onPreview.mock.calls[0][0].input.interests).toContain(
      "craft-example",
    );
  });

  it("disables changes and preview submission while an operation is pending", () => {
    render(
      <PreferenceEditForm
        submission={buildSyntheticScenario("feasible", "2026-10-23")}
        busy
        onPreview={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Anggaran edit (IDR)")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Pratinjau perubahan preferensi" }),
    ).toBeDisabled();
  });

  it("previews an explicit meal window while retaining the exact provided/prepaid inventory and original submission", async () => {
    const user = userEvent.setup();
    const submission = buildSyntheticScenario("feasible", "2026-10-23");
    submission.input.planningStyle = "pace";
    submission.days[0].meals.lunch.provided = 1;
    submission.days[0].meals.lunch.prepaid = 1;
    const onPreview = vi.fn();
    render(
      <PreferenceEditForm
        submission={submission}
        busy={false}
        onPreview={onPreview}
      />,
    );
    await user.click(
      screen.getByText("Inventaris makan hari 1 · semua porsi tetap dihitung"),
    );
    await user.selectOptions(
      screen.getByLabelText("Makan siang hari 1: pengaturan waktu"),
      "scheduled",
    );
    await user.selectOptions(
      screen.getByLabelText("Makan siang hari 1: layanan makan sintetis"),
      "syn-meal-service-food-01",
    );
    fireEvent.change(
      screen.getByLabelText("Makan siang hari 1: awal rentang makan"),
      { target: { value: "12:00" } },
    );
    fireEvent.change(
      screen.getByLabelText("Makan siang hari 1: akhir rentang makan"),
      { target: { value: "13:00" } },
    );
    await user.click(
      screen.getByLabelText(
        "Saya menentukan dan mengonfirmasi rentang makan siang hari 1 ini.",
      ),
    );
    await user.click(
      screen.getByRole("button", { name: "Pratinjau perubahan preferensi" }),
    );
    const output = onPreview.mock.calls[0][0];
    expect(output.input.planningStyle).toBe("pace");
    expect(output.days[0].meals.lunch).toEqual({
      ...submission.days[0].meals.lunch,
      scheduling: {
        mode: "scheduled",
        serviceId: "syn-meal-service-food-01",
        window: { start: "12:00", end: "13:00" },
        windowConfirmed: true,
      },
    });
    expect(submission.days[0].meals.lunch.scheduling).toBeUndefined();
  });
});
