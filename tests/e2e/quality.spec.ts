import fs from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("short itinerary clarity, keyboard navigation and explicit current-revision download", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.context().route("**/*", async (route) => {
    if (
      ["http://127.0.0.1:3000", "http://localhost:3000"].includes(
        new URL(route.request().url()).origin,
      )
    )
      await route.continue();
    else {
      external.push(route.request().url());
      await route.abort();
    }
  });
  await page.goto("/rencana");
  await page
    .getByRole("button", { name: /Profil sintetis.*Jejak sejarah/ })
    .click();
  const overview = page.getByRole("region", {
    name: "Cakupan waktu dan makan",
  });
  await expect(overview).toContainText("158 dari 600 menit");
  await expect(overview).toContainText("442 menit");
  await expect(overview).toContainText("10:38");
  await expect(overview).toContainText("jam & tempat makan belum ditetapkan");
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  const navigation = page.getByRole("navigation", { name: "Bagian rencana" });
  await navigation
    .getByRole("link", { name: "Biaya grup", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#cost-heading$/);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Unduh rencana sintetis (.txt)", exact: true })
    .click();
  const file = await download;
  const filePath = testInfo.outputPath(file.suggestedFilename());
  await file.saveAs(filePath);
  const text = await fs.readFile(filePath, "utf8");
  expect(text).toContain("ITINERARI SINTETIS");
  expect(text).toMatch(/Revisi: .*:rev-1/);
  expect(text).toContain("Status: VALID DALAM SIMULASI");
  expect(text).toContain("Rp 280.500");
  expect(text).toContain("Makan malam: 2 perlu");
  expect(text).toContain("Jam/tempat belum ditetapkan");
  expect(text).toMatch(/Diekspor: \d{4}-/);
  await expect(page.getByText(/Salinan sintetis diunduh/)).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await testInfo.attach("e1-export-axe", {
    body: JSON.stringify(axe),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("multiday shortcut preserves meal inventory and requires each date to be confirmed", async ({
  page,
}) => {
  await page.goto("/rencanakan");
  await page.getByRole("button", { name: /^Lanjutkan/ }).click();
  await page.getByRole("button", { name: /^Lanjutkan/ }).click();
  await page.getByLabel("Mulai aktivitas", { exact: true }).fill("13:00");
  await page.getByLabel("Selesai aktivitas", { exact: true }).fill("16:00");
  const confirm = page.getByRole("checkbox", {
    name: /Saya mengonfirmasi inventaris contoh hari ini lengkap/,
  });
  await confirm.check();
  await page
    .getByRole("button", { name: "Periksa Hari 2", exact: true })
    .click();
  await page
    .getByRole("spinbutton", {
      name: "Makan siang: dibawa (porsi)",
      exact: true,
    })
    .fill("1");
  await confirm.check();
  await page.getByRole("button", { name: "Hari 1", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Salin waktu & titik ke 1 hari lain",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Hari 2", exact: true }).click();
  await expect(page.getByLabel("Mulai aktivitas", { exact: true })).toHaveValue(
    "13:00",
  );
  await expect(
    page.getByRole("spinbutton", {
      name: "Makan siang: dibawa (porsi)",
      exact: true,
    }),
  ).toHaveValue("1");
  await expect(confirm).not.toBeChecked();
  await page.getByRole("button", { name: /^Lanjutkan/ }).click();
  const errors = page.getByRole("main").getByRole("alert");
  await expect(errors).toBeFocused();
  await expect(errors).toContainText(
    "Hari 2: konfirmasi seluruh inventaris makan",
  );
});

test("withdrawn current evidence disables export while immutable history remains available", async ({
  page,
}) => {
  await page.goto("/rencana");
  await page
    .getByRole("button", { name: /Profil sintetis.*Jejak sejarah/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Unduh rencana sintetis (.txt)" }),
  ).toBeEnabled();
  await page
    .getByRole("link", { name: "Studio katalog sintetis", exact: true })
    .click();
  await page.getByText("Penarikan darurat", { exact: true }).click();
  await page
    .getByRole("button", { name: "Tarik entri dari demo", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Lihat rencana sintetis", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unduh rencana sintetis (.txt)" }),
  ).toBeDisabled();
  await expect(page.getByTestId("total-upper")).toHaveText("Belum diketahui");
  await expect(
    page.getByText("1 versi immutable", { exact: true }),
  ).toBeVisible();
});
