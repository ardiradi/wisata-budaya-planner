import { afterEach, describe, expect, it, vi } from "vitest";
import { liveProvidersDisabled } from "./demo";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("deployment guard", () => {
  it("fails closed on Vercel independently of client configuration and any provider flags", () => {
    expect(
      liveProvidersDisabled({
        VERCEL: "1",
        NEXT_PUBLIC_COMPETITION_DEMO: "false",
        GEMINI_DEMO_SMOKE_ENABLED: "true",
      }),
    ).toBe(true);
    expect(
      liveProvidersDisabled({ NEXT_PUBLIC_COMPETITION_DEMO: "true" }),
    ).toBe(true);
    expect(liveProvidersDisabled({})).toBe(false);
  });
  it("retains the build-time competition denial on any host without runtime flags", async () => {
    vi.stubEnv("NEXT_PUBLIC_COMPETITION_DEMO", "true");
    vi.resetModules();
    const competitionBuild = await import("./demo");
    expect(competitionBuild.COMPETITION_DEMO).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_COMPETITION_DEMO", undefined);
    vi.stubEnv("VERCEL", undefined);
    expect(competitionBuild.liveProvidersDisabled({})).toBe(true);
    expect(
      competitionBuild.liveProvidersDisabled({
        NEXT_PUBLIC_COMPETITION_DEMO: "false",
        GEMINI_DEMO_SMOKE_ENABLED: "true",
      }),
    ).toBe(true);
  });
});
