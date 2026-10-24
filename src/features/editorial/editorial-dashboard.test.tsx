import { useSyncExternalStore } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  createEditorialSession,
  type EditorialSession,
} from "@/application/editorial/session";
import { EditorialWorkbench } from "./editorial-dashboard";

function setup() {
  const session = createEditorialSession({
    now: () => "2026-10-23T11:00:00.000Z",
  });
  function Harness({ session }: { session: EditorialSession }) {
    const snapshot = useSyncExternalStore(
      session.subscribe,
      session.getSnapshot,
      session.getSnapshot,
    );
    return <EditorialWorkbench session={session} snapshot={snapshot} />;
  }
  render(<Harness session={session} />);
  return { session, user: userEvent.setup() };
}
const detail = () =>
  screen.getByRole("region", { name: "Detail dan peninjauan editorial" });

describe("synthetic editorial workbench", () => {
  it("labels baseline fixtures honestly and searches/filters the actual catalogue", async () => {
    const { user } = setup();
    expect(
      screen.getByRole("heading", { name: "Studio editorial." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/bukan autentikasi atau persetujuan manusia/),
    ).toBeInTheDocument();
    expect(screen.getByText("17 entri ditampilkan")).toBeInTheDocument();
    const catalogue = screen.getByRole("region", {
      name: "Daftar katalog sintetis",
    });
    await user.type(
      screen.getByRole("searchbox", { name: "Cari entri editorial" }),
      "syn-food-01",
    );
    expect(
      within(catalogue).getByText("1 entri ditampilkan"),
    ).toBeInTheDocument();
    expect(
      within(catalogue).getByRole("button", { name: /Dapur Cerita Contoh/ }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Status katalog" }),
      "approved",
    );
    expect(within(catalogue).getByRole("status")).toHaveTextContent(
      "Tidak ada entri",
    );
    expect(
      within(detail()).getByText("Fixture awal · bukan peninjauan"),
    ).toBeInTheDocument();
  });

  it("requires a distinct simulated reviewer before publishing an edited fixture", async () => {
    const { session, user } = setup();
    const original = session.getSnapshot();
    const pinned = original.records.find(
      (record) => record.id === "syn-history-01",
    )!.active!.evidence.identity;
    await user.click(screen.getByRole("button", { name: "Sunting draf" }));
    const lower = screen.getByRole("spinbutton", {
      name: "Batas bawah",
    });
    const upper = screen.getByRole("spinbutton", {
      name: "Batas atas",
    });
    await user.clear(lower);
    await user.type(lower, "26000");
    await user.clear(upper);
    await user.type(upper, "26000");
    await user.click(
      screen.getByRole("button", { name: "Simpan draf sintetis" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Kirim untuk peninjauan" }),
    );
    expect(
      screen.getByRole("button", { name: "Setujui dalam simulasi" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Kontributor tidak dapat menyetujui karya sendiri/),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Aktor simulasi aktif" }),
      "sim-reviewer",
    );
    await user.click(
      screen.getByRole("button", { name: "Setujui dalam simulasi" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "bukan persetujuan manusia nyata",
    );
    const published = session
      .getSnapshot()
      .records.find((record) => record.id === "syn-history-01")!;
    expect(published.status).toBe("approved");
    expect(published.active!.price.upper).toBe(26000);
    expect(published.active!.independentlyReviewed).toBe(false);
    expect(session.getRepository().isCurrent([pinned])).toBe(false);
    expect(
      original.records.find((record) => record.id === "syn-history-01")!.active!
        .price.upper,
    ).toBe(25000);
    expect(
      original.records.find((record) => record.id === "syn-history-01")!.events,
    ).toHaveLength(1);
  });

  it("keeps missing field evidence visible and disables simulated approval", async () => {
    const { session, user } = setup();
    await user.click(screen.getByRole("button", { name: "Tambah contoh" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Status bukti: Identitas" }),
      "unknown",
    );
    await user.click(
      screen.getByRole("button", { name: "Simpan draf sintetis" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Kirim untuk peninjauan" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Aktor simulasi aktif" }),
      "sim-reviewer",
    );
    expect(
      screen.getByRole("button", { name: "Setujui dalam simulasi" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/identity: bukti sintetis hilang/),
    ).toBeInTheDocument();
    const entry = session
      .getSnapshot()
      .records.find((record) => record.id.startsWith("syn-editorial-"))!;
    expect(entry.active).toBeNull();
    expect(entry.status).toBe("submitted");
    await user.click(screen.getByRole("button", { name: "Tolak draf" }));
    expect(
      session.getSnapshot().records.find((record) => record.id === entry.id)!
        .status,
    ).toBe("rejected");
    expect(screen.getByRole("status")).toHaveTextContent("Draf ditolak");
  });

  it("shows immutable field references and retracts eligibility without rewriting prior snapshots", async () => {
    const { session, user } = setup();
    const before = session.getSnapshot();
    const original = before.records.find(
      (record) => record.id === "syn-history-01",
    )!;
    const refs = Object.values(original.active!.evidence);
    await user.click(
      screen.getByText("Referensi bukti per bidang", { exact: true }),
    );
    expect(
      screen.getByText(`Asersi: ${refs[0].assertionId}`),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Tidak ditinjau manusia · hanya fixture sintetis"),
    ).toHaveLength(9);
    await user.click(screen.getByText("Penarikan darurat", { exact: true }));
    await user.click(
      screen.getByRole("button", { name: "Tarik entri dari demo" }),
    );
    expect(session.getRepository().isCurrent(refs)).toBe(false);
    expect(original.active!.name).toBe("Galeri Sejarah Contoh · sintetis");
    expect(original.events).toHaveLength(1);
    expect(
      within(detail()).getByRole("heading", {
        name: "Entri ditarik dari penggunaan saat ini.",
      }),
    ).toBeInTheDocument();
    expect(
      within(detail()).queryByText("Galeri Sejarah Contoh · sintetis"),
    ).not.toBeInTheDocument();
    expect(
      within(detail()).getByText(
        /klaim dan total yang terdampak disembunyikan/,
      ),
    ).toBeInTheDocument();
    expect(
      session.getSnapshot().records.find((record) => record.id === original.id)!
        .events,
    ).toHaveLength(2);
  });

  it("checks opening-window and price consistency before saving a draft", async () => {
    const { session, user } = setup();
    await user.click(screen.getByRole("button", { name: "Sunting draf" }));
    const start = screen.getByLabelText("Buka", { exact: true });
    await user.clear(start);
    await user.type(start, "20:00");
    await user.click(
      screen.getByRole("button", { name: "Simpan draf sintetis" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "rentang biaya, waktu buka",
    );
    expect(session.getSnapshot().revision).toBe(0);
    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(
      screen.queryByRole("form", { name: "Formulir destinasi sintetis" }),
    ).not.toBeInTheDocument();
  });
});
