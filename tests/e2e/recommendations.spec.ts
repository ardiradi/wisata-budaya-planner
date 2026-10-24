import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

const test = base.extend<{ localRecommendationBoundary: void }>({
  localRecommendationBoundary: [
    async ({ context, page }, use, testInfo) => {
      const offOrigin: string[] = [];
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await context.route("**/*", async (route) => {
        const origin = new URL(route.request().url()).origin;
        if (["http://127.0.0.1:3000", "http://localhost:3000"].includes(origin))
          await route.continue();
        else {
          offOrigin.push(origin);
          await route.abort("blockedbyclient");
        }
      });
      await use();
      await testInfo.attach("b3-local-boundary", {
        body: JSON.stringify({ offOrigin, pageErrors }, null, 2),
        contentType: "application/json",
      });
      expect(offOrigin).toEqual([]);
      expect(pageErrors).toEqual([]);
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

async function profile(page: Page, name: string, scenario = "normal") {
  await page.goto("/rencana");
  await page
    .getByRole("combobox", {
      name: "Skenario rekomendasi sintetis",
      exact: true,
    })
    .selectOption(scenario);
  await page
    .getByRole("button", { name: new RegExp(`Profil sintetis.*${name}`) })
    .click();
  await expect(
    page.getByRole("region", { name: "Ringkasan hasil sintetis" }),
  ).toBeVisible();
}

async function axe(
  page: Page,
  name: string,
  attach: (
    name: string,
    options: { body: string; contentType: string },
  ) => Promise<void>,
) {
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await attach(name, {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  expect(report.violations).toEqual([]);
}

test("simulation controls wait for hydration and retain the first scenario selection", async ({
  page,
  context,
}) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route(/\/_next\/static\/.*\.js(?:\?|$)/, async (route) => {
    await ready;
    await route.fallback();
  });
  try {
    await page.goto("/rencana", { waitUntil: "commit" });
    await expect(
      page.getByRole("combobox", {
        name: "Skenario rekomendasi sintetis",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /Profil sintetis.*Jejak sejarah/ }),
    ).toBeDisabled();
  } finally {
    release();
  }
  const mode = page.getByRole("combobox", {
    name: "Skenario rekomendasi sintetis",
    exact: true,
  });
  await expect(mode).toBeEnabled();
  await mode.selectOption("invalid");
  await expect(mode).toHaveValue("invalid");
  await page
    .getByRole("button", { name: /Profil sintetis.*Jejak sejarah/ })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Rekomendasi fallback deterministik",
      exact: true,
    }),
  ).toBeVisible();
});

test("three contrasting profiles produce different eligible cultural visits and grounded synthetic explanations", async ({
  page,
}) => {
  const cases = [
    {
      profile: "Jejak sejarah",
      place: "Galeri Sejarah Contoh",
      mandatory: "Jejak sejarah",
    },
    {
      profile: "Kriya santai",
      place: "Studio Kriya Contoh",
      mandatory: "Kriya & tradisi",
    },
    {
      profile: "Ruang & rasa",
      place: "Ruang Arsitektur Contoh",
      mandatory: "Arsitektur",
    },
  ];
  const selected: string[] = [];
  for (const input of cases) {
    await profile(page, input.profile);
    await expect(
      page.getByRole("heading", {
        name: "Rekomendasi berbantuan AI · simulasi",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Valid dalam simulasi sintetis", { exact: true }),
    ).toBeVisible();
    const timeline = page.getByRole("list", {
      name: "Linimasa hasil hari 1",
      exact: true,
    });
    await expect(timeline).toContainText(input.place);
    selected.push(await timeline.locator("article h3").first().innerText());
    const coverage = page.getByRole("region", {
      name: "Minat wajib sepanjang perjalanan",
    });
    await expect(coverage).toContainText(input.mandatory);
    await expect(coverage).toContainText("Tercakup dalam simulasi");
    const panel = page.getByTestId("recommendation-panel");
    await expect(panel).toContainText("USD 0");
    await expect(panel).toContainText("kategori budaya wajib");
    await expect(panel).toContainText("belum ada fakta budaya nyata");
    await page
      .getByRole("button", { name: "Hapus hasil dari memori", exact: true })
      .click();
  }
  expect(new Set(selected).size).toBe(3);
});

test("invalid mock output is rejected and deterministic fallback preserves hard requirements", async ({
  page,
}, testInfo) => {
  await profile(page, "Jejak sejarah", "invalid");
  await expect(
    page.getByRole("heading", {
      name: "Rekomendasi fallback deterministik",
      exact: true,
    }),
  ).toBeVisible();
  const panel = page.getByTestId("recommendation-panel");
  await expect(panel.getByRole("status")).toContainText("ditolak");
  await expect(panel).toContainText("Pilihan tidak dilonggarkan");
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  await expect(
    page.getByRole("region", { name: "Semua kebutuhan makan hari ini" }),
  ).toContainText("2 dibeli");
  await expect(
    page.getByRole("region", { name: "Minat wajib sepanjang perjalanan" }),
  ).toContainText("Tercakup dalam simulasi");
  await axe(page, "b3-invalid-fallback-axe", (name, options) =>
    testInfo.attach(name, options),
  );
});

test("provider failure, timeout and denied simulated cost recover locally with no real API cost", async ({
  page,
}) => {
  for (const scenario of ["failure", "timeout", "cost-denied"]) {
    await profile(page, "Jejak sejarah", scenario);
    await expect(
      page.getByRole("heading", {
        name: "Rekomendasi fallback deterministik",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByTestId("recommendation-panel").getByRole("status"),
    ).toBeVisible();
    await expect(page.getByTestId("recommendation-panel")).toContainText(
      "USD 0",
    );
    await expect(
      page.getByText("Valid dalam simulasi sintetis", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Hapus hasil dari memori", exact: true })
      .click();
  }
});

test("one bounded mock repair is explained and never exceeds two attempts", async ({
  page,
}) => {
  await profile(page, "Jejak sejarah", "repair");
  await expect(
    page.getByRole("heading", {
      name: "Rekomendasi berbantuan AI · simulasi",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("recommendation-panel")).toContainText("2 / 2");
  await expect(
    page.getByTestId("recommendation-panel").getByRole("status"),
  ).toContainText("ditolak");
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
});

test("AI-ranked initial plan retains B2 lock, explicit preview and immutable history behavior", async ({
  page,
}) => {
  await profile(page, "Jejak sejarah");
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
  await expect(
    editor.getByText("Versi aktif 1 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Terapkan sebagai versi baru", exact: true })
    .click();
  await expect(
    editor.getByText("Versi aktif 2 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", {
      name: "Ganti Galeri Sejarah Contoh · sintetis",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    editor.getByRole("button", {
      name: "Hapus Galeri Sejarah Contoh · sintetis",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", {
      name: "Perubahan diperiksa secara deterministik.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Tinjau kembali versi 1", exact: true }),
  ).toBeEnabled();
  await expect(
    editor.getByText("2 versi immutable", { exact: true }),
  ).toBeVisible();
  await editor
    .getByRole("button", {
      name: "Hapus Dapur Cerita Contoh · sintetis",
      exact: true,
    })
    .click();
  await expect(
    editor.getByText("Usulan terblokir", { exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByText("Versi aktif 2 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", {
      name: "Simpan usulan terblokir secara eksplisit",
      exact: true,
    }),
  ).toBeDisabled();
});

test("keyboard profiles and recommendation states remain accessible at 320px with explicit recovery", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/rencana");
  const start = page.getByRole("button", {
    name: /Profil sintetis.*Kriya santai/,
  });
  await expect(start).toBeEnabled();
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Rekomendasi berbantuan AI · simulasi",
      exact: true,
    }),
  ).toBeVisible();
  await axe(page, "b3-ranked-result-320px-axe", (name, options) =>
    testInfo.attach(name, options),
  );
  await testInfo.attach("b3-ranked-result-320px", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page
    .getByRole("button", { name: "Hapus hasil dari memori", exact: true })
    .click();
  await page
    .getByRole("combobox", {
      name: "Skenario rekomendasi sintetis",
      exact: true,
    })
    .selectOption("failure");
  await page
    .getByRole("button", { name: /Profil sintetis.*Jejak sejarah/ })
    .click();
  await expect(
    page.getByTestId("recommendation-panel").getByRole("status"),
  ).toContainText("Untuk mencoba skenario lain");
  await axe(page, "b3-recovery-320px-axe", (name, options) =>
    testInfo.attach(name, options),
  );
});
