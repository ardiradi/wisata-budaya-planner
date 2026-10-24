import { expect, test } from "@playwright/test";

// All responses in this file are intercepted locally. These tests never prove live inference.
test("one-shot Gemini UI shows the live label only after a validated mocked server response", async ({
  page,
  context,
}) => {
  let posts = 0;
  const offOrigin: string[] = [];
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:3000")
      await route.continue();
    else {
      offOrigin.push(route.request().url());
      await route.abort();
    }
  });
  await page.route("**/api/recommendations/gemini", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          modelId: "gemini-2.5-flash",
          keyConfigured: true,
          freeTierConfirmed: true,
          smokeEnabled: true,
          consumed: false,
          ready: true,
        },
      });
    posts++;
    const input = route.request().postDataJSON();
    return route.fulfill({
      json: {
        status: "ok",
        output: {
          schemaVersion: "ranking-response-v1",
          snapshotId: input.snapshotId,
          cityId: input.cityId,
          rankings: input.candidates.map(
            (c: {
              placeId: string;
              categoryIds: string[];
              assertionIds: string[];
            }) => ({
              placeId: c.placeId,
              categoryIds: c.categoryIds,
              assertionIds: c.assertionIds,
              reasonCodes: ["AVAILABLE_WINDOW"],
            }),
          ),
        },
        usage: {
          inputTokens: 3000,
          outputTokens: 500,
          inputBoundTokens: 10000,
          simulatedCostMicroUsd: 0,
          modelCalls: 1,
        },
      },
    });
  });
  await page.goto("/rencana");
  await page.getByText("Status uji Gemini · opsional", { exact: true }).click();
  await expect(
    page.getByText(/Siap untuk satu uji gemini-2.5-flash/),
  ).toBeVisible();
  const button = page.getByRole("button", {
    name: "Jalankan satu inferensi Gemini",
  });
  await expect(button).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Saya mengonfirmasi izin satu permintaan/ })
    .check();
  await button.click();
  await expect(
    page.getByRole("heading", { name: "Gemini AI — Live", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("recommendation-panel")).toContainText(
    "gemini-2.5-flash",
  );
  await expect(page.getByTestId("recommendation-panel")).toContainText(
    "Rekonsiliasi biaya provider",
  );
  await expect(page.getByTestId("recommendation-panel")).not.toContainText(
    "USD 0",
  );
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  expect(posts).toBe(1);
  expect(offOrigin).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});

test("a mocked quota response falls back without a live-success claim or another request", async ({
  page,
}) => {
  let posts = 0;
  await page.route("**/api/recommendations/gemini", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          modelId: "gemini-2.5-flash",
          keyConfigured: true,
          freeTierConfirmed: true,
          smokeEnabled: true,
          consumed: false,
          ready: true,
        },
      });
    posts++;
    return route.fulfill({
      status: 429,
      json: {
        status: "error",
        code: "RATE_LIMITED",
        retryable: false,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          simulatedCostMicroUsd: 0,
          modelCalls: 1,
        },
      },
    });
  });
  await page.goto("/rencana");
  await page.getByText("Status uji Gemini · opsional", { exact: true }).click();
  await expect(page.getByText(/Siap untuk satu uji/)).toBeVisible();
  await page
    .getByRole("checkbox", { name: /Saya mengonfirmasi izin satu permintaan/ })
    .check();
  await page
    .getByRole("button", { name: "Jalankan satu inferensi Gemini" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Rekomendasi fallback deterministik",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Gemini AI — Live", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("recommendation-panel")).toContainText(
    "Kuota Gemini dibatasi",
  );
  await expect(page.getByTestId("recommendation-panel")).toContainText(
    "Belum terverifikasi",
  );
  await expect(page.getByTestId("recommendation-panel")).not.toContainText(
    "USD 0",
  );
  await expect(page.getByTestId("total-upper")).toHaveText(/280\.500/);
  expect(posts).toBe(1);
});
