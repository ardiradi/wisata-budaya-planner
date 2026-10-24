import fs from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test as base,
  type Page,
  type TestInfo,
} from "@playwright/test";

const test = base.extend<{ anonymousBoundary: void }>({
  anonymousBoundary: [
    async ({ context, page, baseURL }, use, testInfo) => {
      const origin = new URL(baseURL!).origin;
      const external: string[] = [];
      const apiDispatch: string[] = [];
      const runtimeErrors: string[] = [];
      page.on("pageerror", (error) => runtimeErrors.push(error.name));
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) {
          external.push(`${url.origin}${url.pathname}`);
          await route.abort("blockedbyclient");
        } else if (
          request.method() !== "GET" &&
          request.method() !== "HEAD" &&
          url.pathname.startsWith("/api/")
        ) {
          apiDispatch.push(`${request.method()} ${url.pathname}`);
          await route.abort("blockedbyclient");
        } else await route.continue();
      });
      await use();
      await testInfo.attach("anonymous-network-boundary", {
        body: JSON.stringify({ external, apiDispatch, runtimeErrors }),
        contentType: "application/json",
      });
      expect(
        external,
        "No provider, analytics or authentication redirect requests",
      ).toEqual([]);
      expect(
        apiDispatch,
        "Traveler interactions must not invoke an API",
      ).toEqual([]);
      expect(runtimeErrors).toEqual([]);
      expect(
        await context.cookies(),
        "Anonymous demo creates no cookies",
      ).toEqual([]);
      for (const tab of new Set([page, ...context.pages()])) {
        if (tab.isClosed() || !tab.url().startsWith(origin)) continue;
        expect(
          await tab.evaluate(() => ({
            local: Object.keys(localStorage),
            session: Object.keys(sessionStorage),
            uploadInputs:
              document.querySelectorAll('input[type="file"]').length,
          })),
        ).toEqual({ local: [], session: [], uploadInputs: 0 });
      }
    },
    { auto: true },
  ],
});

async function publicPage(page: Page, path: string) {
  const response = await page.goto(path);
  expect(
    response?.status(),
    "Anonymous application route responds successfully",
  ).toBe(200);
  const headers = response!.headers();
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy"]).toContain("connect-src 'self';");
  expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
  expect(headers["x-powered-by"]).toBeUndefined();
  await expect(
    page.getByText(/^Demo Kompetisi — Data Sintetis/).first(),
  ).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Log in to Vercel|Continue with Vercel/i,
    }),
  ).toHaveCount(0);
}

async function history(page: Page, scenario = "normal") {
  await publicPage(page, "/rencana");
  await page
    .getByRole("combobox", {
      name: "Skenario rekomendasi sintetis",
      exact: true,
    })
    .selectOption(scenario);
  await page
    .getByRole("button", { name: /Profil sintetis.*Jejak sejarah/ })
    .click();
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
}

function editor(page: Page) {
  return page.getByRole("region", {
    name: "Ubah, lihat, lalu terapkan.",
    exact: true,
  });
}

async function accessible(page: Page, testInfo: TestInfo, name: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await testInfo.attach(name, {
    body: JSON.stringify(result),
    contentType: "application/json",
  });
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

test("anonymous landing, discovery and navigation expose an explicitly synthetic competition demo", async ({
  page,
}, testInfo) => {
  await publicPage(page, "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Temukan",
  );
  await page
    .getByRole("link", { name: "Mulai menjelajah", exact: true })
    .click();
  const filters = page.getByRole("group", {
    name: "Filter pengalaman",
    exact: true,
  });
  await filters.getByRole("button", { name: "Kuliner", exact: true }).click();
  await expect(
    page.getByText("1 konsep sintetis", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dapur Rasa Demo", exact: true }),
  ).toBeVisible();
  await accessible(page, testInfo, "deployed-landing-axe");
  await page
    .getByRole("link", { name: "Mulai rencanakan", exact: true })
    .click();
  await expect(page).toHaveURL(/\/rencanakan$/);
  await expect(
    page.getByLabel("Tanggal mulai contoh", { exact: true }),
  ).toBeEnabled();
});

test("four-step intake generates scheduled and costed-unscheduled meals, utilization, group costs and a current TXT download", async ({
  page,
}, testInfo) => {
  await publicPage(page, "/rencanakan");
  const start = await page
    .getByLabel("Tanggal mulai contoh", { exact: true })
    .inputValue();
  await page.getByLabel("Tanggal selesai contoh", { exact: true }).fill(start);
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByLabel("Seberapa banyak hari ingin direncanakan?", { exact: true })
    .selectOption("short");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page.getByLabel("Sarapan: dibawa (porsi)", { exact: true }).fill("2");
  await page
    .getByLabel("Makan siang: pengaturan waktu", { exact: true })
    .selectOption("scheduled");
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
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
  const meals = page.getByRole("region", {
    name: "Semua kebutuhan makan hari ini",
    exact: true,
  });
  await expect(meals).toContainText("12:00–12:30 WIB");
  await expect(meals).toContainText("Biaya tanpa jadwal makan");
  await expect(meals).toContainText(
    "2 diperlukan · 0 dibawa · 0 prabayar · 2 dibeli",
  );
  await expect(
    page.getByRole("region", { name: "Cakupan waktu dan makan", exact: true }),
  ).toContainText("2 porsi terjadwal");
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  await accessible(page, testInfo, "deployed-meal-result-axe");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Unduh rencana sintetis (.txt)", exact: true })
    .click();
  const download = await downloadPromise;
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const text = await fs.readFile(file, "utf8");
  expect(text).toContain("ITINERARI SINTETIS");
  expect(text).toContain("12:00–12:30 WIB");
  expect(text).toContain("Jam/tempat belum ditetapkan");
  expect(text).toContain("Rp 280.500");
  expect(text).toMatch(/Diekspor: \d{4}-/);
});

test("destination replacement requires preview and commit; immutable history and locks survive the edit", async ({
  page,
}, testInfo) => {
  await history(page);
  await page
    .getByRole("button", { name: "Buka editor rencana", exact: true })
    .click();
  const room = editor(page);
  await room
    .getByRole("button", {
      name: "Ganti Galeri Sejarah Contoh · sintetis",
      exact: true,
    })
    .click();
  await room
    .getByRole("combobox", {
      name: "Destinasi pengganti sintetis",
      exact: true,
    })
    .selectOption("syn-culture-02");
  await room
    .getByRole("button", { name: "Pratinjau penggantian", exact: true })
    .click();
  await expect(
    room.getByText("Versi aktif 1 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await expect(
    room.getByRole("region", { name: "Sebelum perubahan", exact: true }),
  ).toContainText("Galeri Sejarah Contoh");
  await expect(
    room.getByRole("region", {
      name: "Usulan setelah dihitung ulang",
      exact: true,
    }),
  ).toContainText("Paviliun Contoh");
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  await room
    .getByRole("button", { name: "Terapkan sebagai versi baru", exact: true })
    .click();
  await expect(
    room.getByText("Versi aktif 2 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("total-upper")).toHaveText(/302\.500/);
  await expect(
    room.getByRole("button", { name: "Tinjau kembali versi 1", exact: true }),
  ).toBeEnabled();
  await room
    .getByRole("button", {
      name: "Kunci Paviliun Contoh · sintetis",
      exact: true,
    })
    .click();
  await room
    .getByRole("button", { name: "Terapkan sebagai versi baru", exact: true })
    .click();
  await expect(
    room.getByText("3 versi immutable", { exact: true }),
  ).toBeVisible();
  await expect(
    room.getByRole("button", {
      name: "Ganti Paviliun Contoh · sintetis",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    room.getByRole("button", {
      name: "Hapus Paviliun Contoh · sintetis",
      exact: true,
    }),
  ).toBeDisabled();
  await accessible(page, testInfo, "deployed-edit-history-axe");
});

test("invalid simulated ranking produces deterministic fallback with mandatory interests and meal costs intact", async ({
  page,
}, testInfo) => {
  await history(page, "invalid");
  await expect(
    page.getByRole("heading", {
      name: "Rekomendasi fallback deterministik",
      exact: true,
    }),
  ).toBeVisible();
  const panel = page.getByTestId("recommendation-panel");
  await expect(panel.getByRole("status")).toContainText("ditolak");
  await expect(panel).toContainText("Pilihan tidak dilonggarkan");
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  await expect(
    page.getByRole("region", { name: "Minat wajib sepanjang perjalanan" }),
  ).toContainText("Tercakup dalam simulasi");
  await expect(
    page.getByRole("heading", { name: "Gemini AI — Live", exact: true }),
  ).toHaveCount(0);
  await accessible(page, testInfo, "deployed-fallback-axe");
});

test("simulated editorial roles enforce self-review separation and same-tab withdrawal hides current itinerary evidence", async ({
  page,
}) => {
  await history(page);
  await page
    .getByRole("link", { name: "Studio katalog sintetis", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Studio editorial.", exact: true }),
  ).toBeVisible();
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
  await page
    .getByRole("combobox", { name: "Aktor simulasi aktif", exact: true })
    .selectOption("sim-reviewer");
  await page
    .getByRole("button", { name: "Setujui dalam simulasi", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "bukan persetujuan manusia nyata",
  );
  await page.getByText("Penarikan darurat", { exact: true }).click();
  await page
    .getByRole("button", { name: "Tarik entri dari demo", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Lihat rencana sintetis", exact: true })
    .click();
  await expect(
    page.getByText(/Bukti versi ini sudah berubah, kedaluwarsa atau ditarik/),
  ).toBeVisible();
  await expect(page.getByTestId("total-upper")).toHaveText("Belum diketahui");
  await expect(
    page.getByRole("list", { name: "Linimasa hasil hari 1", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Unduh rencana sintetis (.txt)",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Buka editor rencana", exact: true })
    .click();
  await expect(
    page.getByText("1 versi immutable", { exact: true }),
  ).toBeVisible();
});

test("keyboard mobile recovery clears temporary memory and browser refresh cannot restore a traveler plan", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await publicPage(page, "/rencana");
  const start = page.getByRole("button", {
    name: /Profil sintetis.*Jejak sejarah/,
  });
  await expect(start).toBeEnabled();
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
  await accessible(page, testInfo, "deployed-keyboard-320px-axe");
  await page
    .getByRole("button", { name: "Hapus hasil dari memori", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Belum ada hasil di sesi ini.",
      exact: true,
    }),
  ).toBeVisible();
  await start.click();
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Belum ada hasil di sesi ini.",
      exact: true,
    }),
  ).toBeVisible();
});

test("unpublished research, environment files, source archives and local receipts are not publicly served", async ({
  request,
  page,
}) => {
  await publicPage(page, "/");
  const paths = [
    "/.env",
    "/.env.local",
    "/.git/config",
    "/.local-demo/gemini-smoke-consumed.json",
    "/docs/research/palembang-pilot.json",
    "/docs/m1/LIVE_TEST_PROPOSAL.md",
    "/submission/Wisata-Budaya-Planner-Source.zip",
    "/README.md",
  ];
  for (const path of paths) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([403, 404], `Private path must be inaccessible: ${path}`).toContain(
      response.status(),
    );
    const body = await response.text();
    expect(
      /GEMINI_API_KEY\s*=|"runtimeImportAllowed"|"smokeConsumedAt"/.test(body),
      `No private payload at ${path}`,
    ).toBe(false);
  }
});

test("Gemini status and malformed POST are server-disabled without configuration or private diagnostics", async ({
  request,
  page,
}) => {
  await publicPage(page, "/rencana");
  const status = await request.get("/api/recommendations/gemini", {
    maxRedirects: 0,
  });
  expect(status.status(), "Live endpoint is server-disabled").toBe(403);
  expect(await status.json()).toEqual({
    code: "LIVE_DISABLED",
    ready: false,
    retryable: false,
  });
  const statusBody = await status.text();
  expect(
    /keyConfigured|freeTierConfirmed|smokeEnabled|consumed|modelId|GEMINI_API_KEY|diagnostic|stack/i.test(
      statusBody,
    ),
  ).toBe(false);
  // A malformed, candidate-free negative probe cannot be admitted to inference.
  // It is sent only after GET has established the competition-mode server denial.
  const denied = await request.post("/api/recommendations/gemini", {
    headers: { "content-type": "application/json" },
    data: "{",
    maxRedirects: 0,
  });
  expect(denied.status()).toBe(403);
  expect(await denied.json()).toEqual({
    code: "LIVE_DISABLED",
    ready: false,
    retryable: false,
  });
  expect(denied.headers()["cache-control"]).toContain("no-store");
  const body = await denied.text();
  expect(
    /keyConfigured|freeTierConfirmed|smokeEnabled|consumed|modelId|GEMINI_API_KEY|diagnostic|stack/i.test(
      body,
    ),
  ).toBe(false);
  expect(/disabled|dinonaktifkan|competition|kompetisi/i.test(body)).toBe(true);
});
