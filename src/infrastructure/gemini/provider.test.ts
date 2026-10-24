import { describe, expect, it, vi } from "vitest";
import { validateRecommendationOutput } from "@/domain/recommendations/ranking";
import type { RankingRequest } from "@/domain/recommendations/contracts";
import { createMemorySmokePermit } from "./permit";
import {
  buildGeminiParameters,
  createGeminiRecommendationProvider,
  type GeminiGenerate,
  type GeminiResponse,
} from "./provider";
import { approvedRequest, compactResponse, sdkResponse } from "./test-fixtures";
const context = (attempt = 1) => ({
  signal: new AbortController().signal,
  attempt,
});
const make = (
  generateContent: GeminiGenerate,
  options: Partial<
    Parameters<typeof createGeminiRecommendationProvider>[0]
  > = {},
) =>
  createGeminiRecommendationProvider({
    generateContent,
    model: "gemini-3.8-flash",
    consumePermit: createMemorySmokePermit(),
    ...options,
  });

describe("guarded genuine Gemini adapter with mocked SDK dispatch", () => {
  it("uses one explicit model, no tools, no retries and strict compact output; hydrates only original evidence", async () => {
    const request = approvedRequest();
    const generate = vi.fn<GeminiGenerate>(async () => sdkResponse(request));
    const provider = make(generate);
    const result = (await provider.rank(request, context())) as {
      status: string;
      output: unknown;
      usage: { modelCalls: number };
    };
    expect(provider).toMatchObject({
      kind: "live",
      modelId: "gemini-3.8-flash",
      maxAttempts: 1,
      timeoutMs: 12000,
    });
    expect(result.status).toBe("ok");
    expect(result.usage.modelCalls).toBe(1);
    expect(validateRecommendationOutput(result.output, request).ok).toBe(true);
    const parameters = generate.mock
      .calls[0]?.[0] as Parameters<GeminiGenerate>[0];
    expect(parameters.model).toBe("gemini-3.8-flash");
    expect(parameters.config).toMatchObject({
      maxOutputTokens: 2000,
      candidateCount: 1,
      responseMimeType: "application/json",
      httpOptions: { retryOptions: { attempts: 1 }, timeout: 12000 },
      thinkingConfig: { thinkingLevel: "LOW", includeThoughts: false },
    });
    expect(parameters.config?.tools).toBeUndefined();
    expect(parameters.config?.cachedContent).toBeUndefined();
    const sent = String(parameters.contents);
    expect(JSON.parse(sent)).toMatchObject({
      schemaVersion: "gemini-ranking-input-v2",
      snapshotId: request.snapshotId,
      cityId: request.cityId,
      preferences: request.preferences,
      rows: expect.any(Array),
    });
    expect(sent).not.toContain("assertionIds");
    expect(sent).not.toContain("Galeri");
    expect(sent).not.toContain("sourceId");
    expect(sent).not.toContain("historical");
  });

  it("uses disabled thinking only for explicitly configured Gemini 2.5 and never switches model", async () => {
    const request = approvedRequest();
    const generate = vi.fn<GeminiGenerate>(async () => sdkResponse(request));
    await make(generate, { model: "gemini-2.5-flash" }).rank(
      request,
      context(),
    );
    expect(generate.mock.calls[0]?.[0]).toMatchObject({
      model: "gemini-2.5-flash",
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
  });

  it("bounds complete serialized configuration before consuming any permit", async () => {
    const request = approvedRequest();
    const { inputBoundTokens, parameters } = buildGeminiParameters(
      request,
      "gemini-3.8-flash",
    );
    expect(inputBoundTokens).toBe(
      new TextEncoder().encode(JSON.stringify(parameters)).byteLength + 2048,
    );
    expect(inputBoundTokens).toBeLessThanOrEqual(12000);
    const oversized = structuredClone(request);
    oversized.candidates = Array.from({ length: 60 }, (_, i) => ({
      ...request.candidates[i % request.candidates.length],
      // Lossless compaction admits ordinary 60-row inputs; maximally long IDs
      // still exceed the unchanged byte admission and must fail before reserve.
      placeId: `syn-overflow-${i}`.padEnd(180, "x"),
    }));
    const consume = vi.fn(createMemorySmokePermit());
    const generate = vi.fn<GeminiGenerate>(async () => sdkResponse(request));
    expect(
      await make(generate, { consumePermit: consume }).rank(
        oversized,
        context(),
      ),
    ).toMatchObject({
      status: "error",
      code: "TOKEN_LIMIT",
      usage: { modelCalls: 0 },
    });
    expect(consume).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    "unknown",
    "cross-city",
    "duplicate",
    "facts",
    "evidence",
    "category",
    "invalid-reason",
    "missing",
    "binding",
    "malformed",
  ])(
    "rejects %s output without exposing model text or retrying",
    async (attack) => {
      const request = approvedRequest();
      const compact = compactResponse(request);
      const row = compact.rankings[0] as (typeof compact.rankings)[number] &
        Record<string, unknown>;
      if (attack === "unknown") row.placeId = "syn-not-in-approved-set";
      if (attack === "cross-city") row.placeId = "jakarta-cross-city";
      if (attack === "duplicate")
        compact.rankings[1] = structuredClone(compact.rankings[0]);
      if (attack === "facts") row.fact = "Injected historical claim";
      if (attack === "evidence") row.assertionIds = ["fake-reviewed-assertion"];
      if (attack === "category") row.categoryIds = ["invented-category"];
      if (attack === "invalid-reason")
        row.reasonCodes = ["INJECTED_REASON" as never];
      if (attack === "missing") compact.rankings.pop();
      if (attack === "binding") compact.snapshotId = "old-snapshot";
      const generate = vi.fn<GeminiGenerate>(async () =>
        attack === "malformed"
          ? { ...sdkResponse(request), text: "```json untrusted prose" }
          : sdkResponse(request, compact),
      );
      const outcome = await make(generate).rank(request, context());
      expect(outcome).toMatchObject({
        status: "error",
        retryable: false,
        usage: { modelCalls: 1 },
      });
      expect(JSON.stringify(outcome)).not.toContain(
        "Injected historical claim",
      );
      expect(generate).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects syntactically valid but semantically unsupported reason codes", async () => {
    const request = approvedRequest();
    const compact = compactResponse(request);
    compact.rankings.find((row) => row.placeId === "syn-food-01")!.reasonCodes =
      ["MANDATORY_INTEREST"];
    expect(
      await make(async () => sdkResponse(request, compact)).rank(
        request,
        context(),
      ),
    ).toMatchObject({ status: "error", code: "SCHEMA_INVALID" });
  });

  it.each(["prompt", "output", "thoughts", "missing", "tools"])(
    "fails closed on %s usage metadata",
    async (kind) => {
      const request = approvedRequest();
      const response = sdkResponse(request);
      if (kind === "prompt") response.usageMetadata!.promptTokenCount = 12001;
      if (kind === "output")
        response.usageMetadata!.candidatesTokenCount = 2001;
      if (kind === "thoughts")
        response.usageMetadata!.thoughtsTokenCount = 1800;
      if (kind === "missing") response.usageMetadata = undefined;
      if (kind === "tools") response.usageMetadata!.toolUsePromptTokenCount = 1;
      expect(
        await make(async () => response).rank(request, context()),
      ).toMatchObject({
        status: "error",
        retryable: false,
        usage: { modelCalls: 1 },
      });
    },
  );

  it("reports safety refusal rather than using partial text", async () => {
    const response = sdkResponse();
    response.candidates = [{ finishReason: "SAFETY" as never }];
    expect(
      await make(async () => response).rank(approvedRequest(), context()),
    ).toMatchObject({ status: "error", code: "REFUSAL", retryable: false });
  });

  it("handles 429 without retry, model switching or secret/error leakage", async () => {
    const generate = vi.fn(async () => {
      throw Object.assign(new Error("secret-provider-error-value"), {
        status: 429,
      });
    });
    const outcome = await make(generate).rank(approvedRequest(), context());
    expect(outcome).toMatchObject({
      status: "error",
      code: "RATE_LIMITED",
      retryable: false,
      usage: { modelCalls: 1 },
    });
    expect(JSON.stringify(outcome)).not.toContain(
      "secret-provider-error-value",
    );
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("bounds never-settling requests, aborts transport and consumes the one permit even on timeout", async () => {
    const generate = vi.fn<GeminiGenerate>(
      () => new Promise<GeminiResponse>(() => {}),
    );
    const provider = make(generate, { timeoutMs: 15 });
    expect(await provider.rank(approvedRequest(), context())).toMatchObject({
      status: "error",
      code: "TIMEOUT",
      usage: { modelCalls: 1 },
    });
    expect(generate.mock.calls[0]?.[0].config?.abortSignal?.aborted).toBe(true);
    expect(await provider.rank(approvedRequest(), context())).toMatchObject({
      status: "error",
      code: "LIVE_ALREADY_USED",
      usage: { modelCalls: 0 },
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("settles parent cancellation promptly even when transport ignores abort and never resolves", async () => {
    vi.useFakeTimers();
    try {
      const abort = new AbortController();
      const diagnostic = vi.fn();
      const generate = vi.fn<GeminiGenerate>(
        () => new Promise<GeminiResponse>(() => {}),
      );
      const pending = make(generate, { onDiagnostic: diagnostic }).rank(
        approvedRequest(),
        { signal: abort.signal, attempt: 1 },
      );
      await vi.advanceTimersByTimeAsync(1);
      expect(generate).toHaveBeenCalledTimes(1);
      abort.abort();
      expect(await pending).toMatchObject({
        status: "error",
        code: "TIMEOUT",
        usage: { modelCalls: 1 },
      });
      expect(diagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          cancellation: "parent",
          responseReceived: false,
          elapsedMs: 1,
        }),
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never accepts a valid response resolved concurrently with parent cancellation", async () => {
    const abort = new AbortController();
    const request = approvedRequest();
    const outcome = await make(async () => {
      abort.abort();
      return sdkResponse(request);
    }).rank(request, { signal: abort.signal, attempt: 1 });
    expect(outcome).toMatchObject({ status: "error", code: "TIMEOUT" });
  });

  it.each([400, 401, 403, 404, 429, 500, 503])(
    "retains only a safe private upstream %s status while public output stays controlled",
    async (status) => {
      const diagnostic = vi.fn();
      const outcome = await make(
        async () => {
          throw Object.assign(new Error("secret message and raw model text"), {
            status,
            cause: { code: "ECONNRESET", key: "secret" },
            request: { headers: { key: "secret" } },
          });
        },
        { onDiagnostic: diagnostic },
      ).rank(approvedRequest(), context());
      expect(outcome).toMatchObject({
        status: "error",
        code: status === 429 ? "RATE_LIMITED" : "UNAVAILABLE",
      });
      expect(diagnostic).toHaveBeenCalledWith({
        schemaVersion: "gemini-diagnostic-v1",
        outcome: status === 429 ? "RATE_LIMITED" : "UNAVAILABLE",
        upstreamStatus: status,
        transportCode: "ECONNRESET",
        responseReceived: false,
        elapsedMs: expect.any(Number),
      });
      expect(JSON.stringify(outcome)).not.toContain("upstreamStatus");
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("secret");
    },
  );

  it("ignores arbitrary diagnostic error fields and a failing diagnostic sink", async () => {
    const diagnostic = vi.fn(() => {
      throw new Error("receipt unavailable");
    });
    const outcome = await make(
      async () => {
        throw {
          status: "403-secret",
          code: "untrusted key value",
          message: "secret",
        };
      },
      { onDiagnostic: diagnostic },
    ).rank(approvedRequest(), context());
    expect(outcome).toMatchObject({ status: "error", code: "UNAVAILABLE" });
    expect(diagnostic).toHaveBeenCalledWith({
      schemaVersion: "gemini-diagnostic-v1",
      outcome: "UNAVAILABLE",
      responseReceived: false,
      elapsedMs: expect.any(Number),
    });
  });

  it("distinguishes a received invalid response from a transport failure in private diagnostics", async () => {
    const diagnostic = vi.fn();
    const outcome = await make(async () => ({ text: "secret model prose" }), {
      onDiagnostic: diagnostic,
    }).rank(approvedRequest(), context());
    expect(outcome).toMatchObject({ status: "error", code: "UNAVAILABLE" });
    expect(diagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        responseReceived: true,
        outcome: "UNAVAILABLE",
      }),
    );
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("secret");
  });

  it("allows only one concurrent dispatch across provider instances sharing a permit", async () => {
    const consumePermit = createMemorySmokePermit();
    const generate = vi.fn(async () => sdkResponse());
    const request = approvedRequest();
    const [first, second] = await Promise.all([
      make(generate, { consumePermit }).rank(request, context()),
      make(generate, { consumePermit }).rank(request, context()),
    ]);
    expect(
      [first, second].filter(
        (entry) => (entry as { status: string }).status === "ok",
      ),
    ).toHaveLength(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch for denied/failed permits, cancelled input, malformed input or repair attempts", async () => {
    const generate = vi.fn(async () => sdkResponse());
    for (const consumePermit of [
      async () => false,
      async () => {
        throw new Error("filesystem uncertain");
      },
    ]) {
      expect(
        await make(generate, { consumePermit }).rank(
          approvedRequest(),
          context(),
        ),
      ).toMatchObject({ status: "error", usage: { modelCalls: 0 } });
    }
    const abort = new AbortController();
    abort.abort();
    await make(generate).rank(approvedRequest(), {
      signal: abort.signal,
      attempt: 1,
    });
    await make(generate).rank({} as RankingRequest, context());
    await make(generate).rank(approvedRequest(), context(2));
    expect(generate).not.toHaveBeenCalled();
  });
});
