import { describe, expect, it, vi } from "vitest";
import { createMemorySmokePermit } from "./permit";
import {
  handleGeminiRecommendation,
  handleGeminiStatus,
  type GeminiServiceOptions,
} from "./service";
import { approvedRequest, sdkResponse } from "./test-fixtures";

const TEST_KEY = "synthetic-placeholder-never-used-as-a-real-key";
const environment = {
  GEMINI_API_KEY: TEST_KEY,
  GEMINI_MODEL: "gemini-2.5-flash",
  GEMINI_FREE_TIER_CONFIRMED: "true",
  GEMINI_DEMO_SMOKE_ENABLED: "true",
};
function request(
  body: unknown = approvedRequest(),
  init: RequestInit = {},
  url = "http://127.0.0.1:3000/api/recommendations/gemini",
) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-wisata-gemini-confirm": "one-free-tier-smoke",
      origin: new URL(url).origin,
    },
    body: JSON.stringify(body),
    ...init,
  });
}
const options = (
  overrides: GeminiServiceOptions = {},
): GeminiServiceOptions => ({
  env: environment,
  generateContent: vi.fn(async () => sdkResponse()),
  consumePermit: createMemorySmokePermit(),
  now: () => "2026-10-23T10:00:00.000Z",
  ...overrides,
});

describe("loopback-only genuine Gemini route service with injected SDK", () => {
  it("accepts only a rebuilt original baseline and emits no credentials, request logs or cacheable output", async () => {
    const generate = vi.fn(async () => sdkResponse());
    const response = await handleGeminiRecommendation(
      request(),
      options({ generateContent: generate }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", usage: { modelCalls: 1 } });
    expect(JSON.stringify(body)).not.toContain(TEST_KEY);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it.each(["key", "confirmed", "enabled", "model", "missing-model"])(
    "fails closed when %s configuration is absent or unsupported",
    async (missing) => {
      const env = { ...environment, GEMINI_MODEL: "gemini-3.8-flash" };
      if (missing === "key") env.GEMINI_API_KEY = "";
      if (missing === "confirmed") env.GEMINI_FREE_TIER_CONFIRMED = "false";
      if (missing === "enabled") env.GEMINI_DEMO_SMOKE_ENABLED = "false";
      if (missing === "model") env.GEMINI_MODEL = "unapproved-expensive-model";
      if (missing === "missing-model") env.GEMINI_MODEL = "";
      const generate = vi.fn(async () => sdkResponse());
      const consume = vi.fn(createMemorySmokePermit());
      const response = await handleGeminiRecommendation(
        request(),
        options({ env, generateContent: generate, consumePermit: consume }),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        status: "error",
        code: "LIVE_DISABLED",
        usage: { modelCalls: 0 },
      });
      expect(generate).not.toHaveBeenCalled();
      expect(consume).not.toHaveBeenCalled();
    },
  );

  it.each([
    "remote",
    "cross-origin",
    "missing-intent",
    "wrong-content-type",
    "wrong-method",
  ])("rejects %s requests before dispatch", async (kind) => {
    const generate = vi.fn(async () => sdkResponse());
    let req = request();
    if (kind === "remote")
      req = request(
        undefined,
        {},
        "https://public.example/api/recommendations/gemini",
      );
    if (kind === "cross-origin")
      req = request(undefined, {
        headers: {
          "content-type": "application/json",
          "x-wisata-gemini-confirm": "one-free-tier-smoke",
          origin: "https://evil.example",
        },
      });
    if (kind === "missing-intent")
      req = request(undefined, {
        headers: { "content-type": "application/json" },
      });
    if (kind === "wrong-content-type")
      req = request(undefined, {
        headers: {
          "content-type": "text/plain",
          "x-wisata-gemini-confirm": "one-free-tier-smoke",
        },
      });
    if (kind === "wrong-method")
      req = new Request("http://127.0.0.1:3000/api/recommendations/gemini");
    const response = await handleGeminiRecommendation(
      req,
      options({ generateContent: generate }),
    );
    expect(response.status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    "candidate-cost",
    "candidate-id",
    "assertion",
    "snapshot",
    "meal-label",
    "partial-pool",
    "extra-fact",
  ])(
    "rejects browser-modified %s while preserving the one permit",
    async (kind) => {
      const body = approvedRequest();
      if (kind === "candidate-cost") body.candidates[0].admissionUpperIdr++;
      if (kind === "candidate-id")
        body.candidates[0].placeId = "syn-edited-not-on-server";
      if (kind === "assertion")
        body.candidates[0].assertionIds[0] = "forged-source-authority";
      if (kind === "snapshot") body.snapshotId = "previous-snapshot";
      if (kind === "meal-label")
        body.preferences.days[0].meals[0].label = "untrusted free-text prompt";
      if (kind === "partial-pool") body.candidates.pop();
      if (kind === "extra-fact")
        Object.assign(body.candidates[0], { fact: "Invented assertion" });
      const generate = vi.fn(async () => sdkResponse());
      const consume = vi.fn(createMemorySmokePermit());
      const response = await handleGeminiRecommendation(
        request(body),
        options({ generateContent: generate, consumePermit: consume }),
      );
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: "INPUT_NOT_APPROVED",
        usage: { modelCalls: 0 },
      });
      expect(generate).not.toHaveBeenCalled();
      expect(consume).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed and oversized bodies without consuming the reservation", async () => {
    const generate = vi.fn(async () => sdkResponse());
    for (const body of [
      "{broken",
      JSON.stringify({ data: "x".repeat(65537) }),
    ]) {
      const response = await handleGeminiRecommendation(
        request(undefined, { body }),
        options({ generateContent: generate }),
      );
      expect(response.status).toBe(400);
    }
    expect(generate).not.toHaveBeenCalled();
  });

  it("persists one consumed permit across service handler instances and classifies quota refusal without retry", async () => {
    const consumePermit = createMemorySmokePermit();
    const generate = vi.fn(async () => {
      throw Object.assign(new Error("never return provider secret"), {
        status: 429,
      });
    });
    const first = await handleGeminiRecommendation(
      request(),
      options({ generateContent: generate, consumePermit }),
    );
    expect(first.status).toBe(429);
    expect(await first.json()).toMatchObject({
      code: "RATE_LIMITED",
      retryable: false,
      usage: { modelCalls: 1 },
    });
    const second = await handleGeminiRecommendation(
      request(),
      options({ generateContent: generate, consumePermit }),
    );
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({
      code: "LIVE_ALREADY_USED",
      usage: { modelCalls: 0 },
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("GET status is read-only and contains booleans/model metadata rather than credentials", async () => {
    const generate = vi.fn(async () => sdkResponse());
    const consume = vi.fn(createMemorySmokePermit());
    const response = await handleGeminiStatus(
      new Request("http://127.0.0.1:3000/api/recommendations/gemini"),
      options({
        generateContent: generate,
        consumePermit: consume,
        isConsumed: async () => false,
      }),
    );
    expect(await response.json()).toEqual({
      modelId: "gemini-2.5-flash",
      keyConfigured: true,
      freeTierConfirmed: true,
      smokeEnabled: true,
      consumed: false,
      ready: true,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
    const used = await handleGeminiStatus(
      new Request("http://localhost:3000/api/recommendations/gemini"),
      options({ isConsumed: async () => true }),
    );
    expect(await used.json()).toMatchObject({ consumed: true, ready: false });
  });

  it("status denies remote origins and unreadable receipt status fails closed", async () => {
    expect(
      (
        await handleGeminiStatus(
          new Request("https://remote.example/api/recommendations/gemini"),
          options(),
        )
      ).status,
    ).toBe(403);
    const response = await handleGeminiStatus(
      new Request("http://127.0.0.1:3000/api/recommendations/gemini"),
      options({
        isConsumed: async () => {
          throw new Error("unreadable receipt");
        },
      }),
    );
    expect(await response.json()).toMatchObject({
      consumed: true,
      ready: false,
    });
  });

  it("never chooses a default model when explicit configuration is omitted", async () => {
    const env: Record<string, string | undefined> = { ...environment };
    delete env.GEMINI_MODEL;
    const generate = vi.fn(async () => sdkResponse());
    const consume = vi.fn(createMemorySmokePermit());
    const response = await handleGeminiRecommendation(
      request(),
      options({ env, generateContent: generate, consumePermit: consume }),
    );
    expect(response.status).toBe(503);
    const status = await handleGeminiStatus(
      new Request("http://127.0.0.1:3000/api/recommendations/gemini"),
      options({ env, isConsumed: async () => false }),
    );
    expect(await status.json()).toMatchObject({
      modelId: "unsupported",
      ready: false,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
  });
});
