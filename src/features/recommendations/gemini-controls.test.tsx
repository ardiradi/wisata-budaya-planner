import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GeminiControls } from "./gemini-controls";

const status = {
  modelId: "gemini-3.8-flash",
  keyConfigured: true,
  freeTierConfirmed: true,
  smokeEnabled: true,
  consumed: false,
  ready: true,
};
describe("one-shot Gemini readiness UI, with local network fakes only", () => {
  it("explains absent explicit model configuration without presenting a server outage or enabling inference", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ...status, modelId: "", ready: false }),
    );
    const run = vi.fn();
    render(<GeminiControls disabled={false} onRun={run} />);
    expect(
      await screen.findByText(/Belum aktif: model eksplisit/),
    ).toBeVisible();
    expect(
      screen.queryByText(/Status server belum tersedia/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
    expect(run).not.toHaveBeenCalled();
  });
  it("does not dispatch inference when the server gate is closed", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ ...status, ready: false, smokeEnabled: false }),
      );
    const run = vi.fn();
    render(<GeminiControls disabled={false} onRun={run} />);
    expect(await screen.findByText(/Belum aktif:/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Jalankan satu inferensi Gemini" }),
    ).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(run).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty("method", "POST");
  });
  it("requires explicit consent and locks the control after one submitted synthetic profile", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(status));
    const run = vi.fn();
    const user = userEvent.setup();
    render(<GeminiControls disabled={false} onRun={run} />);
    await screen.findByText(/Siap untuk satu uji/);
    const button = screen.getByRole("button", {
      name: "Jalankan satu inferensi Gemini",
    });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(button);
    await user.click(button);
    expect(run).toHaveBeenCalledExactlyOnceWith("gemini-3.8-flash");
    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Panggilan berikutnya dikunci",
    );
  });
  it("keeps offline recovery available when the local status request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("synthetic transport failure"),
    );
    render(<GeminiControls disabled={false} onRun={vi.fn()} />);
    expect(
      await screen.findByText(/Status server belum tersedia/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
