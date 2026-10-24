import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test as base,
  type Page,
  type TestInfo,
} from "@playwright/test";

const test = base.extend<{ offlineBoundary: void }>({
  offlineBoundary: [
    async ({ context, page }, use) => {
      const external: string[] = [];
      const inference: string[] = [];
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (
          url.pathname === "/api/recommendations/gemini" &&
          request.method() === "POST"
        ) {
          inference.push(url.pathname);
          await route.abort();
        } else if (
          ["http://127.0.0.1:3000", "http://localhost:3000"].includes(
            url.origin,
          )
        )
          await route.continue();
        else {
          external.push(url.origin);
          await route.abort();
        }
      });
      await use();
      expect(external).toEqual([]);
      expect(inference).toEqual([]);
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

async function axe(page: Page, testInfo: TestInfo, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await testInfo.attach(label, {
    body: JSON.stringify(result),
    contentType: "application/json",
  });
}
async function firstDay(page: Page, style: "short" | "pace") {
  await page.goto("/rencanakan");
  const start = await page
    .getByLabel("Tanggal mulai contoh", { exact: true })
    .inputValue();
  await page.getByLabel("Tanggal selesai contoh", { exact: true }).fill(start);
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByLabel("Seberapa banyak hari ingin direncanakan?", { exact: true })
    .selectOption(style);
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page.getByLabel("Sarapan: dibawa (porsi)", { exact: true }).fill("2");
}
async function submit(page: Page) {
  await page
    .getByRole("checkbox", {
      name: /Saya mengonfirmasi inventaris contoh hari ini lengkap/,
    })
    .check();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /Saya memahami bahwa hasil dihitung/ })
    .check();
  await page
    .getByRole("button", { name: "Hitung rencana sintetis", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Ringkasan hasil sintetis" }),
  ).toBeVisible();
}

test("traveler-confirmed meal is scheduled while another necessary meal stays costed without an invented clock", async ({
  page,
}, testInfo) => {
  await firstDay(page, "short");
  const mode = page.getByLabel("Makan siang: pengaturan waktu", {
    exact: true,
  });
  await mode.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  await expect(mode).toHaveValue("scheduled");
  await expect(
    page.getByLabel("Makan siang: awal rentang makan", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("combobox", {
      name: "Makan siang: layanan makan sintetis",
      exact: true,
    })
    .selectOption("syn-meal-service-food-01");
  await page
    .getByLabel("Makan siang: awal rentang makan", { exact: true })
    .fill("12:00");
  await page
    .getByLabel("Makan siang: akhir rentang makan", { exact: true })
    .fill("13:00");
  await page
    .getByRole("checkbox", {
      name: "Saya menentukan dan mengonfirmasi rentang makan siang ini.",
      exact: true,
    })
    .check();
  await submit(page);
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
  const meals = page.getByRole("region", {
    name: "Semua kebutuhan makan hari ini",
  });
  const lunch = meals.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Makan siang", exact: true }),
  });
  await expect(lunch).toContainText("Makan terjadwal · simulasi");
  await expect(lunch).toContainText("12:00–12:30 WIB");
  await expect(lunch).toContainText(
    "2 diperlukan · 0 dibawa · 0 prabayar · 2 dibeli",
  );
  const dinner = meals.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Makan malam", exact: true }),
  });
  await expect(dinner).toContainText("Biaya tanpa jadwal makan");
  await expect(dinner).toContainText("Jam & tempat makan belum ditetapkan");
  await expect(
    page.getByRole("region", { name: "Cakupan waktu dan makan" }),
  ).toContainText("2 porsi terjadwal");
  await axe(page, testInfo, "e2-scheduled-meals-axe");
  await testInfo.attach("e2-scheduled-meal-ledger", {
    body: await meals.screenshot(),
    contentType: "image/png",
  });
  if (testInfo.project.name === "desktop-chromium")
    await meals.screenshot({ path: "submission/screenshots/13-e2-meals.png" });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
});

test("an impossible edited meal window is blocked without overwriting a valid immutable version", async ({
  page,
}, testInfo) => {
  await page.goto("/rencana");
  await page
    .getByRole("button", { name: /Jalankan: Layak dalam simulasi/ })
    .click();
  await page
    .getByRole("button", { name: "Buka editor rencana", exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: "Ubah, lihat, lalu terapkan.",
    exact: true,
  });
  await editor
    .getByText("Edit preferensi, waktu & inventaris makan", { exact: true })
    .click();
  await editor
    .getByText("Inventaris makan hari 1 · semua porsi tetap dihitung", {
      exact: true,
    })
    .click();
  await editor
    .getByLabel("Makan siang hari 1: pengaturan waktu", { exact: true })
    .selectOption("scheduled");
  await editor
    .getByRole("combobox", {
      name: "Makan siang hari 1: layanan makan sintetis",
      exact: true,
    })
    .selectOption("syn-meal-service-food-01");
  await editor
    .getByLabel("Makan siang hari 1: awal rentang makan", { exact: true })
    .fill("12:00");
  await editor
    .getByLabel("Makan siang hari 1: akhir rentang makan", { exact: true })
    .fill("12:10");
  await editor
    .getByRole("checkbox", {
      name: "Saya menentukan dan mengonfirmasi rentang makan siang hari 1 ini.",
      exact: true,
    })
    .check();
  await editor
    .getByRole("button", {
      name: "Pratinjau perubahan preferensi",
      exact: true,
    })
    .click();
  await expect(
    editor.getByText("Usulan terblokir", { exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByRole("region", {
      name: "Usulan setelah dihitung ulang",
      exact: true,
    }),
  ).toContainText("Jadwal makan belum terpenuhi");
  await expect(
    editor.getByText("Versi aktif 1 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByText("1 versi immutable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  await expect(
    editor.getByRole("region", {
      name: "Perubahan jadwal, rute dan berjalan",
      exact: true,
    }),
  ).toContainText("kebutuhan makan berubah");
  await axe(page, testInfo, "e2-meal-conflict-preview-axe");
  await editor
    .getByRole("button", { name: "Batalkan usulan", exact: true })
    .click();
  await expect(
    editor.getByText("Versi aktif 1 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
});

test("paced intake uses more of the available day and discloses the bounded search without changing the approved stop cap", async ({
  page,
}, testInfo) => {
  await firstDay(page, "pace");
  await submit(page);
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
  const timeline = page.getByRole("list", {
    name: "Linimasa hasil hari 1",
    exact: true,
  });
  await expect(timeline.locator("article")).toHaveCount(4);
  const overview = page.getByRole("region", {
    name: "Cakupan waktu dan makan",
  });
  await expect(overview).toContainText("Eksplorasi seimbang");
  await expect(overview).toContainText(
    "Batas jumlah kunjungan sesuai ritme sudah tercapai",
  );
  await expect(overview).toContainText("Pencarian terbatas");
  await expect(overview).not.toContainText("158 dari 600 menit");
  await axe(page, testInfo, "e2-paced-utilization-axe");
  await testInfo.attach("e2-paced-day-overview", {
    body: await overview.screenshot(),
    contentType: "image/png",
  });
  if (testInfo.project.name === "desktop-chromium")
    await overview.screenshot({
      path: "submission/screenshots/14-e2-utilization.png",
    });
});
