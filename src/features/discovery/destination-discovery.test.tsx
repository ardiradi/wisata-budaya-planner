import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DestinationDiscovery } from "./destination-discovery";

describe("destination concept discovery", () => {
  it("filters explicitly synthetic concepts and resets an empty search", async () => {
    const user = userEvent.setup();
    render(<DestinationDiscovery />);
    expect(screen.getAllByText("Contoh sintetis")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Kuliner" }));
    expect(
      screen.getByRole("heading", { name: "Dapur Rasa Demo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Galeri Cerita Demo" }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "tidak-ada");
    expect(
      screen.getByRole("heading", { name: "Belum ada contoh yang cocok." }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset pencarian" }));
    expect(screen.getAllByText("Contoh sintetis")).toHaveLength(3);
  });
});
