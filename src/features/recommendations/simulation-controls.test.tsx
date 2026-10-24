import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SimulationControls } from "./simulation-controls";

describe("local recommendation simulation controls", () => {
  it("selects a local failure fixture without dispatching a plan or configuring a provider", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onProfile = vi.fn();
    render(
      <SimulationControls
        scenario="normal"
        onScenarioChange={onChange}
        onProfile={onProfile}
      />,
    );
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Skenario rekomendasi sintetis",
      }),
      "invalid",
    );
    expect(onChange).toHaveBeenCalledExactlyOnceWith("invalid");
    expect(onProfile).not.toHaveBeenCalled();
    expect(screen.getByText(/bukan layanan AI aktif/)).toBeInTheDocument();
    expect(
      screen.getByText(/tidak mengubah rencana yang sudah dikomit/),
    ).toBeInTheDocument();
  });

  it("exposes contrasting structured profiles through keyboard buttons", async () => {
    const user = userEvent.setup();
    const onProfile = vi.fn();
    render(
      <SimulationControls
        scenario="normal"
        onScenarioChange={vi.fn()}
        onProfile={onProfile}
      />,
    );
    const craft = screen.getByRole("button", { name: /Kriya santai/ });
    craft.focus();
    await user.keyboard("{Enter}");
    expect(onProfile).toHaveBeenCalledExactlyOnceWith("craft");
    expect(screen.getByRole("button", { name: /Jejak sejarah/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Ruang & rasa/ })).toBeEnabled();
  });

  it("blocks new profile dispatch while generation is running", async () => {
    const user = userEvent.setup();
    const onProfile = vi.fn();
    const onChange = vi.fn();
    render(
      <SimulationControls
        scenario="timeout"
        onScenarioChange={onChange}
        onProfile={onProfile}
        disabled
      />,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
    for (const button of screen.getAllByRole("button"))
      expect(button).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Jejak sejarah/ }));
    expect(onProfile).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
