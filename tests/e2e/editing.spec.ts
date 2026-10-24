import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

const test = base.extend<{ localEditBoundary: void }>({
  localEditBoundary: [
    async ({ context, page }, use) => {
      const external: string[] = [];
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (
          ["http://127.0.0.1:3000", "http://localhost:3000"].includes(
            url.origin,
          )
        )
          await route.continue();
        else {
          external.push(url.origin);
          await route.abort("blockedbyclient");
        }
      });
      await use();
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

async function start(page: Page) {
  await page.goto("/rencana");
  await page
    .getByRole("button", { name: /Jalankan: Layak dalam simulasi/ })
    .click();
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Buka editor rencana", exact: true })
    .click();
}
function editor(page: Page) {
  return page.getByRole("region", {
    name: "Ubah, lihat, lalu terapkan.",
    exact: true,
  });
}
async function checkAxe(
  page: Page,
  name: string,
  attach: (
    name: string,
    options: { body: string; contentType: string },
  ) => Promise<void>,
) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await attach(name, {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(result.violations).toEqual([]);
}

test("swap preview shows before and after without replacing version one, then explicitly commits and reverts", async ({
  page,
}, testInfo) => {
  await start(page);
  const room = editor(page);
  await room
    .getByRole("button", {
      name: /Ganti Galeri Sejarah Contoh · sintetis/,
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
    room.getByRole("heading", { name: "Pratinjau perubahan", exact: true }),
  ).toBeFocused();
  await expect(
    room.getByText("Usulan valid dalam simulasi", { exact: true }),
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
  const active = page.getByRole("list", {
    name: "Linimasa hasil hari 1",
    exact: true,
  });
  await expect(active.locator("article h3").first()).toHaveText(
    "Galeri Sejarah Contoh · sintetis",
  );
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  await checkAxe(page, "b2-valid-swap-preview-axe", (name, options) =>
    testInfo.attach(name, options),
  );
  await testInfo.attach("b2-swap-preview", {
    body: await room.screenshot(),
    contentType: "image/png",
  });
  await room
    .getByRole("button", { name: "Terapkan sebagai versi baru", exact: true })
    .click();
  await expect(
    room.getByText("Versi aktif 2 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await expect(active.locator("article h3").first()).toHaveText(
    "Paviliun Contoh · sintetis",
  );
  await expect(page.getByTestId("total-upper")).toHaveText(/302\.500/);
  await room
    .getByRole("button", { name: "Tinjau kembali versi 1", exact: true })
    .click();
  await expect(
    room.getByText("Usulan valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await room
    .getByRole("button", { name: "Terapkan sebagai versi baru", exact: true })
    .click();
  await expect(
    room.getByText("Versi aktif 3 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await expect(active.locator("article h3").first()).toHaveText(
    "Galeri Sejarah Contoh · sintetis",
  );
  await expect(
    room.getByRole("button", { name: "Tinjau kembali versi 2", exact: true }),
  ).toBeEnabled();
  await expect(
    room.getByText("3 versi immutable", { exact: true }),
  ).toBeVisible();
  await checkAxe(page, "b2-committed-history-axe", (name, options) =>
    testInfo.attach(name, options),
  );
  await testInfo.attach("b2-reverted-history", {
    body: await room.screenshot(),
    contentType: "image/png",
  });
});

test("removal cannot waive daily culinary coverage or meals and preserves the previous valid version", async ({
  page,
}) => {
  await start(page);
  const room = editor(page);
  await room
    .getByRole("button", {
      name: "Hapus Dapur Cerita Contoh · sintetis",
      exact: true,
    })
    .click();
  await expect(
    room.getByText("Usulan terblokir", { exact: true }),
  ).toBeVisible();
  await expect(
    room.getByRole("list", {
      name: "Konsekuensi dan bukti yang belum lengkap",
    }),
  ).toContainText(/kuliner/i);
  const keep = room.getByRole("button", {
    name: "Simpan usulan terblokir secara eksplisit",
    exact: true,
  });
  await expect(keep).toBeDisabled();
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  await expect(
    page.getByRole("region", { name: "Semua kebutuhan makan hari ini" }),
  ).toContainText("2 dibeli");
  await room
    .getByRole("checkbox", {
      name: /Saya memilih menyimpan usulan terblokir ini secara eksplisit/,
    })
    .check();
  await keep.click();
  await expect(
    room.getByText("Versi aktif 2 · terblokir", { exact: true }),
  ).toBeVisible();
  await expect(
    room.getByText("Versi valid terakhir: 1", { exact: true }),
  ).toBeVisible();
  await expect(
    room.getByRole("button", { name: "Tinjau kembali versi 1", exact: true }),
  ).toBeEnabled();
});

test("budget edit recalculates all costs without replacing the committed plan and can be cancelled", async ({
  page,
}) => {
  await start(page);
  const room = editor(page);
  await room
    .getByText("Edit preferensi, waktu & inventaris makan", { exact: true })
    .click();
  await room.getByLabel("Anggaran edit (IDR)", { exact: true }).fill("10000");
  await room
    .getByRole("button", {
      name: "Pratinjau perubahan preferensi",
      exact: true,
    })
    .click();
  await expect(
    room.getByText("Usulan terblokir", { exact: true }),
  ).toBeVisible();
  await expect(
    room.getByRole("list", {
      name: "Konsekuensi dan bukti yang belum lengkap",
    }),
  ).toContainText(/anggaran/i);
  await expect(
    room.getByRole("region", {
      name: "Usulan setelah dihitung ulang",
      exact: true,
    }),
  ).toContainText(/280\.500/);
  await expect(
    room.getByText("Versi aktif 1 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await room
    .getByRole("button", { name: "Batalkan usulan", exact: true })
    .click();
  await expect(
    room.getByRole("heading", { name: "Pratinjau perubahan", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Valid dalam simulasi sintetis", { exact: true }),
  ).toBeVisible();
});

test("locked stop controls and a changed time expose a conflict until an explicit unlock", async ({
  page,
}) => {
  await start(page);
  const room = editor(page);
  await room
    .getByRole("button", {
      name: "Kunci Galeri Sejarah Contoh · sintetis",
      exact: true,
    })
    .click();
  await room
    .getByRole("button", { name: "Terapkan sebagai versi baru", exact: true })
    .click();
  await expect(
    room.getByRole("button", {
      name: "Hapus Galeri Sejarah Contoh · sintetis",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    room.getByRole("button", {
      name: "Ganti Galeri Sejarah Contoh · sintetis",
      exact: true,
    }),
  ).toBeDisabled();
  await room
    .getByText("Edit preferensi, waktu & inventaris makan", { exact: true })
    .click();
  await room.getByLabel("Mulai hari 1", { exact: true }).fill("10:00");
  await room
    .getByRole("button", {
      name: "Pratinjau perubahan preferensi",
      exact: true,
    })
    .click();
  await expect(
    room.getByText("Usulan terblokir", { exact: true }),
  ).toBeVisible();
  await expect(
    room.getByRole("list", {
      name: "Konsekuensi dan bukti yang belum lengkap",
    }),
  ).toContainText(/kunci/i);
  await room
    .getByRole("button", { name: "Batalkan usulan", exact: true })
    .click();
  await room
    .getByRole("button", {
      name: "Buka kunci Galeri Sejarah Contoh · sintetis",
      exact: true,
    })
    .click();
  await room
    .getByRole("button", { name: "Terapkan sebagai versi baru", exact: true })
    .click();
  await expect(
    room.getByRole("button", {
      name: "Hapus Galeri Sejarah Contoh · sintetis",
      exact: true,
    }),
  ).toBeEnabled();
});

test("keyboard reordering creates a reviewed preview and rapid edit attempts do not commit automatically", async ({
  page,
}) => {
  await start(page);
  const room = editor(page);
  const down = room.getByRole("button", {
    name: "Turunkan Galeri Sejarah Contoh · sintetis",
    exact: true,
  });
  await down.focus();
  await page.keyboard.press("Enter");
  await expect(
    room.getByRole("heading", { name: "Pratinjau perubahan", exact: true }),
  ).toBeFocused();
  const proposed = room.getByRole("region", {
    name: "Usulan setelah dihitung ulang",
    exact: true,
  });
  await expect(proposed).toContainText("1. Dapur Cerita Contoh");
  await expect(
    room.getByText("Versi aktif 1 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await expect(
    room.getByText("1 versi immutable", { exact: true }),
  ).toBeVisible();
  await room
    .getByRole("button", { name: "Batalkan usulan", exact: true })
    .click();
  await room
    .getByRole("button", {
      name: "Hapus Dapur Cerita Contoh · sintetis",
      exact: true,
    })
    .dblclick();
  await expect(
    room.getByText("Versi aktif 1 · valid dalam simulasi", { exact: true }),
  ).toBeVisible();
  await expect(
    room.getByText("1 versi immutable", { exact: true }),
  ).toBeVisible();
});

test("editor and blocked comparison have no configured axe violations and fit a 320px viewport", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 844 });
  await start(page);
  await checkAxe(page, "b2-edit-controls-axe", (name, options) =>
    testInfo.attach(name, options),
  );
  await editor(page)
    .getByRole("button", {
      name: "Hapus Dapur Cerita Contoh · sintetis",
      exact: true,
    })
    .click();
  await expect(
    editor(page).getByText("Usulan terblokir", { exact: true }),
  ).toBeVisible();
  await checkAxe(page, "b2-blocked-preview-axe", (name, options) =>
    testInfo.attach(name, options),
  );
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
