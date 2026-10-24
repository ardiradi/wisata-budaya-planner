import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { MealScheduling } from "./intake-preview";
import { MealSchedulingFields } from "./meal-scheduling-fields";

function Form() {
  const [value, setValue] = useState<MealScheduling>({ mode: "unscheduled" });
  return (
    <MealSchedulingFields
      id="lunch"
      label="Makan siang"
      value={value}
      onChange={setValue}
    />
  );
}

describe("explicit meal scheduling controls", () => {
  it("requires traveler-entered clocks and service instead of assuming universal mealtimes", async () => {
    const user = userEvent.setup();
    render(<Form />);
    expect(screen.getByText(/Seluruh porsi tetap dihitung/)).toBeVisible();
    expect(
      screen.queryByLabelText("Makan siang: awal rentang makan"),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Makan siang: pengaturan waktu"),
      "scheduled",
    );
    expect(
      screen.getByLabelText("Makan siang: awal rentang makan"),
    ).toHaveValue("");
    expect(
      screen.getByLabelText("Makan siang: akhir rentang makan"),
    ).toHaveValue("");
    expect(
      screen.getByLabelText("Makan siang: layanan makan sintetis"),
    ).toHaveValue("");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("withdraws window confirmation after a service or time change and permits an explicit return to unscheduled", async () => {
    const user = userEvent.setup();
    render(<Form />);
    const mode = screen.getByLabelText("Makan siang: pengaturan waktu");
    await user.selectOptions(mode, "scheduled");
    await user.selectOptions(
      screen.getByLabelText("Makan siang: layanan makan sintetis"),
      "syn-meal-service-food-01",
    );
    fireEvent.change(screen.getByLabelText("Makan siang: awal rentang makan"), {
      target: { value: "12:00" },
    });
    fireEvent.change(
      screen.getByLabelText("Makan siang: akhir rentang makan"),
      { target: { value: "13:00" } },
    );
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.change(
      screen.getByLabelText("Makan siang: akhir rentang makan"),
      { target: { value: "13:30" } },
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await user.click(screen.getByRole("checkbox"));
    await user.selectOptions(
      screen.getByLabelText("Makan siang: layanan makan sintetis"),
      "syn-meal-service-food-02",
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await user.selectOptions(mode, "unscheduled");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(/Seluruh porsi tetap dihitung/)).toBeVisible();
  });
});
