import { defineConfig, devices } from "@playwright/test";

const target = process.env.DEMO_BASE_URL;
if (!target)
  throw new Error("Set DEMO_BASE_URL to the competition deployment URL.");
const url = new URL(target);
const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
if (
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  url.pathname !== "/"
)
  throw new Error("DEMO_BASE_URL must be a credential-free origin.");
if (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))
  throw new Error(
    "Only HTTPS deployment or HTTP loopback verification is supported.",
  );

/** Independent smoke evidence: never starts, provisions or authenticates a server. */
export default defineConfig({
  testDir: "./tests/deployment",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  outputDir: "test-results/deployment",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/deployment", open: "never" }],
  ],
  use: {
    baseURL: url.origin,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    { name: "deployed-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "deployed-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
