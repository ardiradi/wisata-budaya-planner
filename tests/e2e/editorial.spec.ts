import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test as base,
  type Page,
  type TestInfo,
} from "@playwright/test";

const test = base.extend<{ localEditorialBoundary: void }>({
  localEditorialBoundary: [
    async ({ context, page }, use) => {
      const errors: string[] = [];
      const external: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await context.route("**/*", async (route) => {
        if (
          ["http://127.0.0.1:3000", "http://localhost:3000"].includes(
            new URL(route.request().url()).origin,
          )
        )
          await route.continue();
        else {
          external.push(route.request().url());
          await route.abort("blockedbyclient");
        }
      });
      await use();
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
      expect(await context.cookies()).toEqual([]);
      if (!page.isClosed())
        expect(
          await page.evaluate(() => ({
            local: Object.keys(localStorage),
            session: Object.keys(sessionStorage),
          })),
        ).toEqual({ local: [], session: [] });
    },
    { auto: true },
  ],
});

async function axe(page: Page, testInfo: TestInfo, name: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await testInfo.attach(name, {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(result.violations).toEqual([]);
}

async function start(page: Page) {
  await page.goto("/editorial");
  await expect(
    page.getByRole("button", { name: "Tambah contoh", exact: true }),
  ).toBeEnabled();
}

test("editorial edit separates simulated actors, preserves source references and records immutable decisions", async ({
  page,
}, testInfo) => {
  await start(page);
  await expect(
    page.getByText("17 entri ditampilkan", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Studio editorial.", exact: true }),
  ).toBeVisible();
  await axe(page, testInfo, "editorial-baseline-axe");
  await page.getByRole("button", { name: "Sunting draf", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Batas bawah", exact: true })
    .fill("26000");
  await page
    .getByRole("spinbutton", { name: "Batas atas", exact: true })
    .fill("26000");
  await page
    .getByRole("button", { name: "Simpan draf sintetis", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kirim untuk peninjauan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Setujui dalam simulasi", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Kontributor tidak dapat menyetujui karya sendiri/),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Aktor simulasi aktif", exact: true })
    .selectOption("sim-reviewer");
  await page
    .getByRole("button", { name: "Setujui dalam simulasi", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "bukan persetujuan manusia nyata",
  );
  const detail = page.getByRole("region", {
    name: "Detail dan peninjauan editorial",
    exact: true,
  });
  await expect(detail).toContainText(/Rp\s*26\.000/);
  await expect(detail).toContainText("4 peristiwa immutable");
  await detail.getByText("Referensi bukti per bidang", { exact: true }).click();
  await expect(
    detail.getByText("Tidak ditinjau manusia · hanya fixture sintetis", {
      exact: true,
    }),
  ).toHaveCount(9);
  await expect(detail).toContainText("syn-history-01:identity:draft-1");
  await axe(page, testInfo, "editorial-approved-simulation-axe");
});

test("a missing evidence field blocks publication and a reviewer can reject the draft", async ({
  page,
}, testInfo) => {
  await start(page);
  await page
    .getByRole("button", { name: "Tambah contoh", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nama contoh", exact: true })
    .fill("Contoh Bukti Belum Lengkap · sintetis");
  await page
    .getByRole("combobox", { name: "Status bukti: Identitas", exact: true })
    .selectOption("unknown");
  await page
    .getByRole("button", { name: "Simpan draf sintetis", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kirim untuk peninjauan", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Aktor simulasi aktif", exact: true })
    .selectOption("sim-reviewer");
  await expect(
    page.getByRole("button", { name: "Setujui dalam simulasi", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/identity: bukti sintetis hilang/)).toBeVisible();
  await axe(page, testInfo, "editorial-missing-evidence-axe");
  await page.getByRole("button", { name: "Tolak draf", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draf ditolak");
  await expect(
    page.getByRole("region", {
      name: "Detail dan peninjauan editorial",
      exact: true,
    }),
  ).toContainText("Ditolak · simulasi");
});

test("emergency withdrawal suppresses affected current itinerary facts while revision identifiers remain", async ({
  page,
}) => {
  await page.goto("/rencana");
  await page
    .getByRole("button", { name: /Profil sintetis.*Jejak sejarah/ })
    .click();
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  await page
    .getByRole("button", { name: "Buka editor rencana", exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: "Ubah, lihat, lalu terapkan.",
    exact: true,
  });
  await editor
    .getByRole("button", {
      name: "Kunci Galeri Sejarah Contoh · sintetis",
      exact: true,
    })
    .click();
  await editor
    .getByRole("button", { name: "Terapkan sebagai versi baru", exact: true })
    .click();
  await expect(
    editor.getByText("2 versi immutable", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Studio katalog sintetis", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Studio editorial.", exact: true }),
  ).toBeVisible();
  await page.getByText("Penarikan darurat", { exact: true }).click();
  await page
    .getByRole("button", { name: "Tarik entri dari demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Entri ditarik dari penggunaan saat ini.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Lihat rencana sintetis", exact: true })
    .click();
  await expect(
    page.getByText(/Bukti versi ini sudah berubah, kedaluwarsa atau ditarik/),
  ).toBeVisible();
  await expect(page.getByTestId("total-upper")).toHaveText("Belum diketahui");
  await expect(
    page.getByRole("complementary", {
      name: "Biaya dan batas perhitungan",
      exact: true,
    }),
  ).not.toContainText(/280\.500/);
  await expect(
    page.getByRole("list", { name: "Linimasa hasil hari 1", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Buka editor rencana", exact: true })
    .click();
  await expect(
    page.getByText("2 versi immutable", { exact: true }),
  ).toBeVisible();
});

test("keyboard and mobile controls remain accessible, and reload clears synthetic editorial memory", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await start(page);
  const add = page.getByRole("button", { name: "Tambah contoh", exact: true });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("form", {
      name: "Formulir destinasi sintetis",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Nama contoh", exact: true })
    .fill("Studio Keyboard · sintetis");
  await page
    .getByRole("button", { name: "Simpan draf sintetis", exact: true })
    .click();
  await expect(
    page.getByText("18 entri ditampilkan", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Cari entri editorial", exact: true })
    .fill("Studio Keyboard");
  await expect(
    page.getByText("1 entri ditampilkan", { exact: true }),
  ).toBeVisible();
  await axe(page, testInfo, "editorial-keyboard-320px-axe");
  const size = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(size.content).toBeLessThanOrEqual(size.viewport);
  await testInfo.attach("editorial-320px", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page.reload();
  await expect(
    page.getByText("17 entri ditampilkan", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Daftar katalog sintetis", exact: true }),
  ).not.toContainText("Studio Keyboard");
});
