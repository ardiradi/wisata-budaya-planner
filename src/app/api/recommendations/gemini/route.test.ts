import { afterEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  loaded: vi.fn(),
  status: vi.fn(() => Response.json({ local: true })),
  recommendation: vi.fn(() => Response.json({ local: true })),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/gemini/service", () => {
  service.loaded();
  return {
    handleGeminiStatus: service.status,
    handleGeminiRecommendation: service.recommendation,
  };
});
import { GET, POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("public competition endpoint boundary", () => {
  it.each(["flag", "vercel"])(
    "rejects GET and POST before loading private service with %s guard, even with accidental live credentials",
    async (guard) => {
      vi.stubEnv(
        "NEXT_PUBLIC_COMPETITION_DEMO",
        guard === "flag" ? "true" : "false",
      );
      vi.stubEnv("VERCEL", guard === "vercel" ? "1" : "0");
      vi.stubEnv("GEMINI_API_KEY", "synthetic-test-value-never-a-real-key");
      vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
      vi.stubEnv("GEMINI_DEMO_SMOKE_ENABLED", "true");
      vi.stubEnv("GEMINI_FREE_TIER_CONFIRMED", "true");
      const request = new Request(
        "http://127.0.0.1:3000/api/recommendations/gemini",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-wisata-gemini-confirm": "one-free-tier-smoke",
          },
          body: "not parsed by the disabled endpoint",
        },
      );
      for (const response of [await GET(request), await POST(request)]) {
        expect(response.status).toBe(403);
        expect(response.headers.get("cache-control")).toBe("no-store, private");
        expect(await response.json()).toEqual({
          code: "LIVE_DISABLED",
          ready: false,
          retryable: false,
        });
      }
      expect(service.loaded).not.toHaveBeenCalled();
      expect(service.status).not.toHaveBeenCalled();
      expect(service.recommendation).not.toHaveBeenCalled();
    },
  );
});
