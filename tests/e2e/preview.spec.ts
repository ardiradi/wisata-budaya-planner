import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

const localOrigins = new Set([
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);

/** These checks establish local UI behavior only, never real itinerary feasibility. */
const test = base.extend<{ localPreviewBoundary: void }>({
  localPreviewBoundary: [
    async ({ context, page }, use, testInfo) => {
      const offOriginRequests: string[] = [];
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (localOrigins.has(url.origin)) await route.continue();
        else {
          offOriginRequests.push(`${url.origin}${url.pathname}`);
          await route.abort("blockedbyclient");
        }
      });

      await use();

      await testInfo.attach("off-origin-request-audit", {
        body: JSON.stringify(offOriginRequests, null, 2),
        contentType: "application/json",
      });
      expect(
        offOriginRequests,
        "The local preview must not attempt external provider, analytics, font, or map requests",
      ).toEqual([]);
      expect(
        await context.cookies(),
        "The preview must not create browser cookies",
      ).toEqual([]);
      // Depending on page keeps this audit ahead of Playwright's page teardown.
      for (const openPage of new Set([page, ...context.pages()])) {
        if (openPage.isClosed()) continue;
        if (!localOrigins.has(new URL(openPage.url()).origin)) continue;
        expect(
          await openPage.evaluate(() => Object.keys(localStorage)),
          "The preview must not write localStorage",
        ).toEqual([]);
        expect(
          await openPage.evaluate(() => Object.keys(sessionStorage)),
          "The preview must not write sessionStorage",
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
});

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(
    dimensions.documentWidth,
    `Document overflow at ${dimensions.viewport}px`,
  ).toBeLessThanOrEqual(dimensions.viewport);
  expect(
    dimensions.bodyWidth,
    `Body overflow at ${dimensions.viewport}px`,
  ).toBeLessThanOrEqual(dimensions.viewport);
}

async function generateScenario(page: Page, label: string) {
  await page.goto("/rencana");
  await page
    .getByRole("button", { name: new RegExp(`Jalankan: ${label}`) })
    .click();
  await expect(
    page.getByRole("region", { name: "Ringkasan hasil sintetis" }),
  ).toBeVisible();
}

test("intake keeps controls disabled until hydration and retains the first one-day date change", async ({
  page,
  context,
}) => {
  let release!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route(/\/_next\/static\/.*\.js(?:\?|$)/, async (route) => {
    await scriptsReady;
    await route.fallback();
  });
  try {
    await page.goto("/rencanakan", { waitUntil: "commit" });
    await expect(
      page.getByLabel("Tanggal mulai contoh", { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("Menyiapkan formulir lokal…", { exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
  const start = page.getByLabel("Tanggal mulai contoh", { exact: true });
  await expect(start).toBeEnabled();
  const date = await start.inputValue();
  await page.getByLabel("Tanggal selesai contoh", { exact: true }).fill(date);
  await expect(
    page.getByRole("complementary", { name: "Ringkasan skenario contoh" }),
  ).toContainText("1 hari");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Pilih hari untuk dilengkapi" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Pilih hari untuk dilengkapi" })
      .getByRole("button"),
  ).toHaveCount(1);
});

test("submitted preferences generate an actual result, survive client navigation, and disappear on reload", async ({
  page,
}) => {
  await page.goto("/rencanakan");
  const start = await page
    .getByLabel("Tanggal mulai contoh", { exact: true })
    .inputValue();
  await page.getByLabel("Tanggal selesai contoh", { exact: true }).fill(start);
  await page.getByLabel("Jumlah peserta contoh", { exact: true }).fill("3");
  const budget = page.getByRole("textbox", {
    name: "Total anggaran grup (IDR)",
  });
  await budget.fill("0");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  const validationAlert = page
    .getByRole("alert")
    .filter({ hasText: "Ada yang perlu dilengkapi." });
  await expect(validationAlert).toContainText(
    "rupiah bulat yang lebih besar dari nol",
  );
  await expect(validationAlert).toBeFocused();
  await budget.fill("2000000");
  await page
    .getByRole("radio", { name: "Taksi / ride-hail", exact: true })
    .check();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "Wajib tercakup sepanjang perjalanan",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Kembali", exact: true }).click();
  await expect(budget).toHaveValue("2000000");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(
    page.getByRole("checkbox", {
      name: "Wajib tercakup sepanjang perjalanan",
      exact: true,
    }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page.getByLabel("Sarapan: dibawa (porsi)", { exact: true }).fill("1");
  await page.getByLabel("Sarapan: prabayar (porsi)", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Tambah waktu makan contoh", exact: true })
    .click();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(validationAlert).toContainText(
    "konfirmasi seluruh inventaris makan",
  );
  await page
    .getByRole("checkbox", {
      name: /Saya mengonfirmasi inventaris contoh hari ini lengkap/,
    })
    .check();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(
    page.getByText("Jejak sejarah (wajib)", { exact: true }),
  ).toBeVisible();
  const generate = page.getByRole("button", {
    name: "Hitung rencana sintetis",
    exact: true,
  });
  await expect(generate).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Saya memahami bahwa hasil dihitung/ })
    .check();
  await generate.click();
  await expect(page).toHaveURL(/\/rencana$/);
  const summary = page.getByRole("region", {
    name: "Ringkasan hasil sintetis",
  });
  await expect(summary).toContainText("3 orang · Taksi / ride-hail");
  await expect(summary).toContainText("1 hari");
  await expect(summary).toContainText(/Rp\s*2\.000\.000/);
  const meals = page.getByRole("region", {
    name: "Semua kebutuhan makan hari ini",
  });
  await expect(meals).toContainText(
    "3 diperlukan · 1 dibawa · 1 prabayar · 1 dibeli",
  );
  await expect(meals).toContainText("Makan tambahan 1");
  await expect(
    page.getByRole("region", { name: "Minat wajib sepanjang perjalanan" }),
  ).toContainText("Jejak sejarah");
  await page
    .getByRole("link", { name: "Kembali ke preferensi sintetis", exact: true })
    .click();
  await expect(budget).toHaveValue("2000000");
  await expect(
    page.getByLabel("Jumlah peserta contoh", { exact: true }),
  ).toHaveValue("3");
  await page.getByRole("link", { name: "Buka ruang hasil sintetis" }).click();
  await expect(summary).toContainText("3 orang");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Belum ada hasil di sesi ini.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Ringkasan hasil sintetis" }),
  ).toHaveCount(0);
});

test("mandatory step-free access stays draft when route and anchor evidence is absent", async ({
  page,
}) => {
  await page.goto("/rencanakan");
  const start = await page
    .getByLabel("Tanggal mulai contoh", { exact: true })
    .inputValue();
  await page.getByLabel("Tanggal selesai contoh", { exact: true }).fill(start);
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByLabel("Kebutuhan akses contoh", { exact: true })
    .selectOption("step-free");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
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
    page.getByText("Draf · bukti simulasi belum lengkap", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Yang masih perlu diselesaikan" }),
  ).toContainText("seluruh rute, titik awal dan titik akhir belum dimodelkan");
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Kembali ke preferensi sintetis", exact: true })
    .click();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(
    page.getByLabel("Kebutuhan akses contoh", { exact: true }),
  ).toHaveValue("step-free");
});

test("provided and prepaid portions do not waive a mandatory dietary requirement", async ({
  page,
}) => {
  await page.goto("/rencanakan");
  const start = await page
    .getByLabel("Tanggal mulai contoh", { exact: true })
    .inputValue();
  await page.getByLabel("Tanggal selesai contoh", { exact: true }).fill(start);
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByLabel("Persyaratan makanan contoh", { exact: true })
    .selectOption("halal");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page.getByLabel("Sarapan: dibawa (porsi)", { exact: true }).fill("1");
  await page.getByLabel("Sarapan: prabayar (porsi)", { exact: true }).fill("1");
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
    page.getByText("Draf · bukti simulasi belum lengkap", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Yang masih perlu diselesaikan" }),
  ).toContainText("persyaratan makanan wajib tidak dikecualikan");
  await expect(
    page.getByRole("region", { name: "Semua kebutuhan makan hari ini" }),
  ).toContainText("2 diperlukan · 1 dibawa · 1 prabayar · 0 dibeli");
  await page
    .getByRole("link", { name: "Kembali ke preferensi sintetis", exact: true })
    .click();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(
    page.getByLabel("Persyaratan makanan contoh", { exact: true }),
  ).toHaveValue("halal");
});

test("seven-day intake generates distinct venues, all days and keyboard-operable day tabs", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto("/rencanakan");
  const start = await page
    .getByLabel("Tanggal mulai contoh", { exact: true })
    .inputValue();
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  await page
    .getByLabel("Tanggal selesai contoh", { exact: true })
    .fill(end.toISOString().slice(0, 10));
  await page
    .getByRole("textbox", { name: "Total anggaran grup (IDR)" })
    .fill("5000000");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  const days = page.getByRole("group", { name: "Pilih hari untuk dilengkapi" });
  for (let index = 1; index <= 7; index++) {
    await days
      .getByRole("button", { name: `Hari ${index}`, exact: true })
      .click();
    await page.getByLabel("Sarapan: dibawa (porsi)", { exact: true }).fill("2");
    await page
      .getByRole("checkbox", {
        name: /Saya mengonfirmasi inventaris contoh hari ini lengkap/,
      })
      .check();
  }
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /Saya memahami bahwa hasil dihitung/ })
    .check();
  await page
    .getByRole("button", { name: "Hitung rencana sintetis", exact: true })
    .click();
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Ringkasan hasil sintetis" }),
  ).toContainText("7 hari");
  await expect(page.getByTestId("total-upper")).toHaveText(/Rp\s*1\.963\.500/);
  const tabs = page
    .getByRole("tablist", { name: "Hari perjalanan sintetis" })
    .getByRole("tab");
  await expect(tabs).toHaveCount(7);
  const names: string[] = [];
  for (let index = 0; index < 7; index++) {
    await tabs.nth(index).click();
    const timeline = page.getByRole("list", {
      name: `Linimasa hasil hari ${index + 1}`,
      exact: true,
    });
    await expect(timeline.locator("article")).toHaveCount(2);
    names.push(...(await timeline.locator("article h3").allTextContents()));
  }
  expect(new Set(names).size).toBe(14);
  await tabs.nth(6).focus();
  await page.keyboard.press("Home");
  await expect(tabs.first()).toBeFocused();
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(tabs.last()).toBeFocused();
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
});

test("feasible synthetic scenario shows schedule, route continuity, cost arithmetic and immutable fixture references", async ({
  page,
}) => {
  await generateScenario(page, "Layak dalam simulasi");
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
  const timeline = page.getByRole("list", {
    name: "Linimasa hasil hari 1",
    exact: true,
  });
  await expect(timeline.locator("article")).not.toHaveCount(0);
  await expect(timeline).toContainText("anchor-a");
  await expect(timeline).toContainText("menit · buka");
  const evidence = timeline.locator("article").first().locator("details");
  await evidence.locator("summary").click();
  await expect(evidence).toContainText("Tidak ada persetujuan independen");
  await expect(evidence.locator("code").first()).toContainText("fixture");
  await expect(
    page.getByRole("region", { name: "Seluruh jalan kaki, per orang" }),
  ).toContainText("batas atas");
  const costs = page.getByRole("region", {
    name: "Anggaran, dengan jelas.",
    exact: true,
  });
  await expect(costs).toContainText("Cadangan 10%");
  await expect(costs.getByTestId("total-upper")).not.toContainText(
    "Belum diketahui",
  );
  await costs.locator("summary").first().click();
  await expect(costs).toContainText("porsi");
  const calculationSummary = page.getByRole("complementary", {
    name: "Biaya dan batas perhitungan",
    exact: true,
  });
  await expect(
    calculationSummary.getByText("Biaya API nyata", { exact: true }),
  ).toBeVisible();
  await expect(
    calculationSummary.getByText("USD 0", { exact: true }),
  ).toBeVisible();
});

test("insufficient budget blocks without dropping necessary meals or increasing budget", async ({
  page,
}) => {
  await generateScenario(page, "Anggaran tidak cukup");
  await expect(
    page.getByText("Terblokir · batas wajib belum terpenuhi", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Yang masih perlu diselesaikan" }),
  ).toContainText("Batas belum terpenuhi");
  await expect(
    page.getByRole("region", { name: "Semua kebutuhan makan hari ini" }),
  ).toContainText("dibeli");
  await expect(
    page.getByRole("region", { name: "Anggaran, dengan jelas.", exact: true }),
  ).toContainText("Anggaran Anda");
});

test("missing route evidence creates a draft with unknown total rather than fabricated zero", async ({
  page,
}) => {
  await generateScenario(page, "Bukti rute hilang");
  await expect(
    page.getByText("Draf · bukti simulasi belum lengkap", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Yang masih perlu diselesaikan" }),
  ).toContainText("Belum diketahui");
  await expect(page.getByTestId("total-upper")).toHaveText("Belum diketahui");
  await expect(
    page
      .getByText(
        "Rute belum terbukti; tidak diganti dengan waktu atau biaya nol.",
      )
      .first(),
  ).toBeVisible();
});

test("result deletion removes the local result and restores the empty state", async ({
  page,
}) => {
  await generateScenario(page, "Layak dalam simulasi");
  await page
    .getByRole("button", { name: "Hapus hasil dari memori", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Belum ada hasil di sesi ini.",
      exact: true,
    }),
  ).toBeVisible();
});

test("discovery filters and source disclosures remain explicitly synthetic", async ({
  page,
}) => {
  await page.goto("/");
  const discovery = page.locator("#jelajahi");
  await expect(discovery.locator("article")).toHaveCount(3);
  await discovery.getByRole("button", { name: "Budaya", exact: true }).click();
  await expect(discovery.locator("article")).toHaveCount(2);
  await discovery
    .getByRole("searchbox", { name: "Cari contoh pengalaman", exact: true })
    .fill("tidak-ada-konsep-xyz");
  await expect(discovery.getByRole("status")).toContainText(
    "Belum ada contoh yang cocok.",
  );
  await discovery
    .getByRole("button", { name: "Reset pencarian", exact: true })
    .click();
  await expect(discovery.locator("article")).toHaveCount(3);
  const example = discovery.locator("article").first();
  await example.getByText("Tentang contoh ini", { exact: true }).click();
  await expect(
    example.getByText(/Tidak ada persetujuan peninjau manusia/),
  ).toBeVisible();
});

test("skip link and mobile navigation work at a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Lewati ke konten utama", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#konten-utama")).toBeFocused();
  await page
    .getByRole("button", { name: "Buka navigasi", exact: true })
    .click();
  const menu = page.getByRole("navigation", {
    name: "Navigasi seluler",
    exact: true,
  });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Contoh rencana", exact: true }).click();
  await expect(page).toHaveURL(/\/rencana$/);
  await expect(
    page.getByRole("button", { name: "Buka navigasi", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("landing, intake, empty and generated results fit 390px and 320px", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/", "/rencanakan", "/rencana"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await assertNoHorizontalOverflow(page);
    }
    await page
      .getByRole("button", { name: /Jalankan: Layak dalam simulasi/ })
      .click();
    await expect(
      page.getByRole("region", { name: "Ringkasan hasil sintetis" }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
});

for (const [name, path, scenario] of [
  ["landing", "/", null],
  ["intake", "/rencanakan", null],
  ["empty-result", "/rencana", null],
  ["validated-result", "/rencana", "Layak dalam simulasi"],
  ["draft-result", "/rencana", "Bukti rute hilang"],
  ["blocked-result", "/rencana", "Anggaran tidak cukup"],
] as const) {
  test(`${name} has no automated axe violations in its rendered state`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (scenario) await generateScenario(page, scenario);
    else await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    await testInfo.attach(`${name}-axe-results`, {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });
    await testInfo.attach(`${name}-rendered-preview`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    expect(
      results.violations,
      "Automated rendered-state check; competent accessibility review remains separate",
    ).toEqual([]);
  });
}
