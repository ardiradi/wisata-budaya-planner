import { afterEach, describe, expect, it, vi } from "vitest";
import { getMockRankingProvider } from "@/infrastructure/synthetic/mock-ranking";
import { fixtureEvidence } from "@/infrastructure/synthetic/evidence-fixture";
import type { RecommendationProvider, RankingRequest } from "./contracts";
import { WorkBudget } from "../planner/work";
import { addCalendarDays } from "../normalization";
import {
  TEST_AS_OF,
  instrumentedRepository,
  testCatalogue,
  testPreferences,
} from "./adversarial.fixtures";
import { rankCandidates, simulatedTokens } from "./orchestrator";
import { buildRankingRequest, fallbackResponse } from "./ranking";

afterEach(() => vi.useRealTimers());

const outcome = (request: RankingRequest) => {
  const output = fallbackResponse(request);
  return {
    status: "ok" as const,
    output,
    usage: {
      inputTokens: simulatedTokens(request),
      outputTokens: simulatedTokens(output),
      simulatedCostMicroUsd: 1000,
    },
  };
};
function setup() {
  const places = testCatalogue();
  return {
    places,
    input: testPreferences(),
    repository: instrumentedRepository({ places }),
  };
}
async function run(
  provider: RecommendationProvider,
  work = new WorkBudget(() => 0),
) {
  const { input, places, repository } = setup();
  const report = await rankCandidates(input, places, {
    repository,
    provider,
    evaluatedAt: TEST_AS_OF,
    work,
  });
  return { report, work };
}

describe("bounded synthetic recommendation orchestration", () => {
  it.each([
    ["normal", "mock_ai", 1, []],
    ["invalid", "deterministic_fallback", 2, ["UNKNOWN_ID"]],
    ["failure", "deterministic_fallback", 1, ["PROVIDER_FAILURE"]],
    ["timeout", "deterministic_fallback", 2, ["TIMEOUT"]],
    ["cost-denied", "deterministic_fallback", 0, ["COST_DENIED"]],
    ["repair", "mock_ai", 2, ["UNKNOWN_ID"]],
  ] as const)(
    "handles %s using %s with %i admitted attempt(s)",
    async (scenario, source, attempts, codes) => {
      const { report, work } = await run(getMockRankingProvider(scenario));
      expect(report.source).toBe(source);
      expect(report.attempts).toBe(attempts);
      expect(work.modelAttempts).toBe(attempts);
      expect(report.rejectionCodes).toEqual([...codes]);
      expect(report.rankings).toHaveLength(report.candidateCount);
      expect(report.synthetic).toBe(true);
      expect(report.independentlyReviewed).toBe(false);
      expect(report.actualApiCostMicroUsd).toBe(0);
      expect(report.inputTokens).toBeLessThanOrEqual(24000);
      expect(report.outputTokens).toBeLessThanOrEqual(4000);
      expect(report.simulatedCostMicroUsd).toBeLessThanOrEqual(1000000);
      expect(work.routeAttempts).toBe(0);
    },
  );

  it("counts thrown provider attempts and caps them at two before deterministic fallback", async () => {
    const rank = vi.fn(async () => {
      throw new Error("synthetic failure");
    });
    const { report, work } = await run({ id: "throwing-fixture", rank });
    expect(rank).toHaveBeenCalledTimes(2);
    expect(report.attempts).toBe(2);
    expect(work.modelAttempts).toBe(2);
    expect(report.source).toBe("deterministic_fallback");
    expect(report.rejectionCodes).toContain("PROVIDER_FAILURE");
  });

  it("rejects malformed provider envelopes without promoting raw output or exceeding attempts", async () => {
    const rank = vi.fn(async () => ({
      status: "ok",
      output: "unstructured facts",
      usage: null,
    }));
    const { report } = await run({ id: "malformed-fixture", rank });
    expect(rank).toHaveBeenCalledTimes(2);
    expect(report.source).toBe("deterministic_fallback");
    expect(report.rejectionCodes).toContain("SCHEMA_INVALID");
    expect(JSON.stringify(report)).not.toContain("unstructured facts");
  });

  it("does not retry a provider refusal", async () => {
    const rank = vi.fn(async () => ({
      status: "error",
      code: "REFUSAL",
      retryable: true,
      usage: { inputTokens: 1, outputTokens: 1, simulatedCostMicroUsd: 1000 },
    }));
    const { report } = await run({ id: "refusal-fixture", rank });
    expect(rank).toHaveBeenCalledTimes(1);
    expect(report.source).toBe("deterministic_fallback");
    expect(report.rejectionCodes).toContain("REFUSAL");
  });

  it("times out and aborts an adapter that never settles, with bounded retry headroom", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const rank = vi.fn(
      (_request: RankingRequest, context: { signal: AbortSignal }) => {
        signals.push(context.signal);
        return new Promise<never>(() => undefined);
      },
    );
    const pending = run({ id: "never-settles-fixture", rank });
    await vi.advanceTimersByTimeAsync(1000);
    const { report, work } = await pending;
    expect(rank).toHaveBeenCalledTimes(2);
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(work.modelAttempts).toBe(2);
    expect(report.source).toBe("deterministic_fallback");
    expect(report.rejectionCodes).toContain("TIMEOUT");
  });

  it("withdraws all recommendations when current evidence is revoked while awaiting a ranking", async () => {
    const { input, places } = setup();
    let current = true;
    const repository = instrumentedRepository({
      places,
      current: () => current,
    });
    const rank = vi.fn(async (request: RankingRequest) => {
      current = false;
      return outcome(request);
    });
    const report = await rankCandidates(input, places, {
      repository,
      provider: { id: "revocation-fixture", rank },
      evaluatedAt: TEST_AS_OF,
      work: new WorkBudget(() => 0),
    });
    expect(rank).toHaveBeenCalledTimes(1);
    expect(report.source).toBe("unavailable");
    expect(report.rankings).toEqual([]);
    expect(report.rejectionCodes).toContain("EVIDENCE_CHANGED");
  });

  it("runs no model attempt when hard filtering leaves no current candidates", async () => {
    const { input, places } = setup();
    const rank = vi.fn();
    const report = await rankCandidates(input, places, {
      repository: instrumentedRepository({ places, current: () => false }),
      provider: { id: "empty-fixture", rank },
      evaluatedAt: TEST_AS_OF,
      work: new WorkBudget(() => 0),
    });
    expect(rank).not.toHaveBeenCalled();
    expect(report.attempts).toBe(0);
    expect(report.source).toBe("unavailable");
    expect(report.rankings).toEqual([]);
    expect(report.rejectionCodes).toContain("NO_CANDIDATES");
  });

  it("respects attempts already consumed by the same operation", async () => {
    const work = new WorkBudget(() => 0);
    work.reserveModel(1, 2000, 500000);
    work.reserveModel(1, 2000, 500000);
    const rank = vi.fn();
    const { report } = await run(
      { id: "already-consumed-fixture", rank },
      work,
    );
    expect(rank).not.toHaveBeenCalled();
    expect(report.attempts).toBe(0);
    expect(work.modelAttempts).toBe(2);
    expect(report.source).toBe("deterministic_fallback");
    expect(report.rejectionCodes).toContain("ATTEMPT_LIMIT");
  });

  it.each([
    [
      "input",
      { inputTokens: 12001, outputTokens: 1, simulatedCostMicroUsd: 1000 },
      "TOKEN_LIMIT",
    ],
    [
      "output",
      { inputTokens: 1, outputTokens: 2001, simulatedCostMicroUsd: 1000 },
      "TOKEN_LIMIT",
    ],
    [
      "cost",
      { inputTokens: 1, outputTokens: 1, simulatedCostMicroUsd: 500001 },
      "SPEND_LIMIT",
    ],
  ] as const)(
    "rejects per-attempt %s overrun before accepting a response",
    async (_, usage, code) => {
      const rank = vi.fn(async (request: RankingRequest) => ({
        ...outcome(request),
        usage,
      }));
      const { report, work } = await run({ id: "usage-overrun-fixture", rank });
      expect(rank).toHaveBeenCalledTimes(1);
      expect(report.attempts).toBe(1);
      expect(work.modelAttempts).toBe(1);
      expect(report.source).toBe("deterministic_fallback");
      expect(report.rejectionCodes).toContain(code);
      expect(report.actualApiCostMicroUsd).toBe(0);
    },
  );

  it("rejects serialized overlong model content even when reported output usage undercounts it", async () => {
    const rank = vi.fn(async (request: RankingRequest) => ({
      ...outcome(request),
      output: { ...fallbackResponse(request), story: "x".repeat(9000) },
      usage: { inputTokens: 1, outputTokens: 1, simulatedCostMicroUsd: 1000 },
    }));
    const { report } = await run({ id: "underreported-output-fixture", rank });
    expect(rank).toHaveBeenCalledTimes(1);
    expect(report.source).toBe("deterministic_fallback");
    expect(report.rejectionCodes).toContain("TOKEN_LIMIT");
  });

  it("fails preflight before dispatch when sixty valid candidates exceed the simulated 12,000-input-token ceiling", async () => {
    const input = testPreferences();
    input.endDate = addCalendarDays(input.startDate, 6);
    input.dates = Array.from({ length: 7 }, (_, index) =>
      addCalendarDays(input.startDate, index),
    );
    input.days = input.dates.map((date) => ({
      ...structuredClone(input.days[0]),
      date,
      meals: [
        ...structuredClone(input.days[0].meals),
        ...Array.from({ length: 10 }, (_, index) => ({
          id: `extra-${index + 1}`,
          label: "Extra synthetic meal",
          necessary: 0,
          provided: 0,
          prepaid: 0,
          purchased: 0,
          confirmedZero: true,
        })),
      ],
    }));
    const base = testCatalogue()[0];
    const places = Array.from({ length: 60 }, (_, index) => {
      const place = structuredClone(base);
      place.id = `syn-${String(index).padStart(2, "0")}-${"x".repeat(145)}`;
      for (const field of Object.keys(
        place.evidence,
      ) as (keyof typeof place.evidence)[])
        place.evidence[field] = fixtureEvidence(place.id, field);
      return place;
    });
    const rank = vi.fn();
    const work = new WorkBudget(() => 0);
    const repository = instrumentedRepository({ places });
    const request = buildRankingRequest(
      input,
      places,
      TEST_AS_OF,
      repository.isCurrent.bind(repository),
    ).request;
    expect(simulatedTokens(request)).toBeGreaterThan(12000);
    const report = await rankCandidates(input, places, {
      repository,
      provider: { id: "long-valid-request-fixture", rank },
      evaluatedAt: TEST_AS_OF,
      work,
    });
    expect(report.candidateCount).toBe(60);
    expect(report.rejectionCodes).toContain("TOKEN_LIMIT");
    expect(report.source).toBe("deterministic_fallback");
    expect(report.rankings).toHaveLength(60);
    expect(report.attempts).toBe(0);
    expect(work.modelAttempts).toBe(0);
    expect(rank).not.toHaveBeenCalled();
  });

  it("shares the operation deadline and rejects a response arriving at 45 seconds", async () => {
    let elapsed = 0;
    const work = new WorkBudget(() => elapsed);
    const rank = vi.fn(async (request: RankingRequest) => {
      elapsed = 45000;
      return outcome(request);
    });
    const { report } = await run({ id: "deadline-fixture", rank }, work);
    expect(rank).toHaveBeenCalledTimes(1);
    expect(report.source).toBe("unavailable");
    expect(report.rankings).toEqual([]);
    expect(report.rejectionCodes).toContain("DEADLINE");
    expect(report.attempts).toBe(1);
    expect(work.elapsedMs).toBe(45000);
  });

  it("does not invoke a provider after cancellation of the shared operation", async () => {
    const controller = new AbortController();
    const work = new WorkBudget(() => 0, controller.signal);
    controller.abort();
    const rank = vi.fn();
    const { report } = await run({ id: "cancelled-fixture", rank }, work);
    expect(rank).not.toHaveBeenCalled();
    expect(report.source).toBe("unavailable");
    expect(report.rankings).toEqual([]);
    expect(report.rejectionCodes).toContain("CANCELLED");
  });

  it("honors an already cancelled signal even when the shared work budget has no bound signal", async () => {
    const { input, places, repository } = setup();
    const controller = new AbortController();
    controller.abort();
    const rank = vi.fn();
    const work = new WorkBudget(() => 0);
    const report = await rankCandidates(input, places, {
      repository,
      provider: { id: "independently-cancelled-fixture", rank },
      evaluatedAt: TEST_AS_OF,
      work,
      signal: controller.signal,
    });
    expect(rank).not.toHaveBeenCalled();
    expect(work.modelAttempts).toBe(0);
    expect(report.attempts).toBe(0);
    expect(report.source).toBe("unavailable");
    expect(report.rankings).toEqual([]);
    expect(report.rejectionCodes).toContain("CANCELLED");
    expect(report.rejectionCodes).not.toContain("DEADLINE");
  });

  it("discards a successful response and does not retry or fall back after its parent signal aborts", async () => {
    const { input, places, repository } = setup();
    const controller = new AbortController();
    const childSignals: AbortSignal[] = [];
    const rank = vi.fn(
      async (request: RankingRequest, context: { signal: AbortSignal }) => {
        childSignals.push(context.signal);
        controller.abort();
        return outcome(request);
      },
    );
    const work = new WorkBudget(() => 0);
    const report = await rankCandidates(input, places, {
      repository,
      provider: { id: "abort-during-success-fixture", rank },
      evaluatedAt: TEST_AS_OF,
      work,
      signal: controller.signal,
    });
    expect(rank).toHaveBeenCalledTimes(1);
    expect(childSignals).toHaveLength(1);
    expect(childSignals[0].aborted).toBe(true);
    expect(work.modelAttempts).toBe(1);
    expect(report.attempts).toBe(1);
    expect(report.source).toBe("unavailable");
    expect(report.rankings).toEqual([]);
    expect(report.rejectionCodes).toContain("CANCELLED");
    expect(report.rejectionCodes).not.toContain("DEADLINE");
  });

  it("isolates malicious provider mutation from the approved candidate snapshot and preferences", async () => {
    const { input, places, repository } = setup();
    const before = JSON.stringify({ input, places });
    const rank = vi.fn(async (request: RankingRequest) => {
      request.preferences.budgetIdr = Number.MAX_SAFE_INTEGER;
      request.candidates[0].categoryIds = ["craft-example"];
      return outcome(request);
    });
    const report = await rankCandidates(input, places, {
      repository,
      provider: { id: "mutating-fixture", rank },
      evaluatedAt: TEST_AS_OF,
      work: new WorkBudget(() => 0),
    });
    expect(JSON.stringify({ input, places })).toBe(before);
    expect(report.source).toBe("deterministic_fallback");
    expect(report.rejectionCodes).toContain("CATEGORY_INVALID");
    expect(
      report.rankings.find((entry) => entry.placeId === "syn-history-01")
        ?.categoryIds,
    ).toEqual(["history-example"]);
  });
});
