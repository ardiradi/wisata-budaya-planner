import { describe, expect, it, vi } from "vitest";
import {
  allowedReasons,
  buildRankingRequest,
  fallbackResponse,
  validateRecommendationOutput,
} from "@/domain/recommendations/ranking";
import {
  RankingRequestSchema,
  REASON_CODES,
} from "@/domain/recommendations/contracts";
import {
  buildGeminiParameters,
  createGeminiRecommendationProvider,
} from "./provider";
import { createMemorySmokePermit } from "./permit";
import { approvedRequest, compactResponse, sdkResponse } from "./test-fixtures";
import { addCalendarDays } from "@/domain/normalization";
import { rankCandidates } from "@/domain/recommendations/orchestrator";
import { WorkBudget } from "@/domain/planner/work";
import {
  getLocalRepository,
  SYNTHETIC_PLACES,
} from "@/infrastructure/synthetic/catalogue";
import { TEST_AS_OF } from "@/domain/recommendations/adversarial.fixtures";

const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

describe("lossless local Gemini capacity and unchanged complete-permutation contract", () => {
  it("rejects an otherwise allowlisted bounded top-k response with missing candidates", () => {
    const request = approvedRequest();
    const compact = compactResponse(request);
    compact.rankings = compact.rankings.slice(0, 5);
    const hydrated = {
      schemaVersion: "ranking-response-v1",
      snapshotId: request.snapshotId,
      cityId: request.cityId,
      rankings: compact.rankings.map((row) => {
        const candidate = request.candidates.find(
          (entry) => entry.placeId === row.placeId,
        )!;
        return {
          ...row,
          categoryIds: candidate.categoryIds,
          assertionIds: candidate.assertionIds,
        };
      }),
    };
    expect(validateRecommendationOutput(hydrated, request)).toMatchObject({
      ok: false,
      code: "INCOMPLETE_RANKING",
    });
  });

  it("measures 17/30/60 synthetic shapes and admits only through an injected mock transport", async () => {
    const baseline = approvedRequest();
    const measurements = [];
    for (const count of [17, 30, 60]) {
      const request = RankingRequestSchema.parse({
        ...baseline,
        candidates: Array.from({ length: count }, (_, index) => ({
          ...baseline.candidates[index % baseline.candidates.length],
          placeId: `syn-capacity-${String(index + 1).padStart(2, "0")}`,
        })),
      });
      const v1 = buildGeminiParameters(request, "gemini-2.5-flash", "v1");
      const v2 = buildGeminiParameters(request, "gemini-2.5-flash");
      const rankings = request.candidates.map((candidate) => ({
        placeId: candidate.placeId,
        reasonCodes: ["AVAILABLE_WINDOW"],
      }));
      const outputBytes = (rows: typeof rankings) =>
        bytes({
          schemaVersion: "gemini-ranking-v1",
          snapshotId: request.snapshotId,
          rankings: rows,
        });
      const minimumFullOutputBytes = outputBytes(rankings);
      const suggestedTwoReasonOutputBytes = bytes(compactResponse(request));
      const semanticMaximumOutputBytes = outputBytes(
        request.candidates.map((candidate) => ({
          placeId: candidate.placeId,
          reasonCodes: allowedReasons(candidate, request),
        })),
      );
      const maximumReasonOutputBytes = outputBytes(
        rankings.map((row) => ({ ...row, reasonCodes: [...REASON_CODES] })),
      );
      const consume = vi.fn(createMemorySmokePermit());
      const generate = vi.fn(async () => sdkResponse(request));
      const provider = createGeminiRecommendationProvider({
        model: "gemini-2.5-flash",
        generateContent: generate,
        consumePermit: consume,
      });
      const outcome = await provider.rank(request, {
        signal: new AbortController().signal,
        attempt: 1,
      });
      const admitted = v2.inputBoundTokens <= 12000;
      expect(outcome).toMatchObject({ status: admitted ? "ok" : "error" });
      expect(generate).toHaveBeenCalledTimes(admitted ? 1 : 0);
      expect(consume).toHaveBeenCalledTimes(admitted ? 1 : 0);
      expect(v2.inputBoundTokens).toBeLessThan(v1.inputBoundTokens);
      measurements.push({
        candidates: count,
        v1ContentBytes: new TextEncoder().encode(String(v1.parameters.contents))
          .length,
        v2ContentBytes: new TextEncoder().encode(String(v2.parameters.contents))
          .length,
        v1EnvelopeBytes: bytes(v1.parameters),
        v2EnvelopeBytes: bytes(v2.parameters),
        v1ByteAdmissionBound: v1.inputBoundTokens,
        v2ByteAdmissionBound: v2.inputBoundTokens,
        b3OriginalRequestProxyUnits: Math.ceil(bytes(request) / 4),
        mockAdmitted: admitted,
        minimumFullOutputBytes,
        minimumFullOutputProxyUnits: Math.ceil(minimumFullOutputBytes / 4),
        suggestedTwoReasonOutputBytes,
        suggestedTwoReasonOutputProxyUnits: Math.ceil(
          suggestedTwoReasonOutputBytes / 4,
        ),
        semanticMaximumOutputBytes,
        semanticMaximumOutputProxyUnits: Math.ceil(
          semanticMaximumOutputBytes / 4,
        ),
        maximumReasonOutputBytes,
        maximumReasonOutputProxyUnits: Math.ceil(maximumReasonOutputBytes / 4),
      });
    }
    // Actual encoded bytes / local proxies only; no tokenizer, billing or live provider evidence.
    console.info("E2 synthetic Gemini capacity:", JSON.stringify(measurements));
    expect(measurements.map((row) => row.mockAdmitted)).toEqual([
      true,
      true,
      true,
    ]);
    expect(measurements[2].maximumReasonOutputProxyUnits).toBeGreaterThan(2000);
  });

  it("measures seven-day fully specified meal requests and rejects oversized inputs before any reservation", async () => {
    const baseline = approvedRequest();
    const dates = Array.from({ length: 7 }, (_, index) =>
      addCalendarDays(baseline.preferences.startDate, index),
    );
    const measurements = [];
    for (const mealsPerDay of [3, 13]) {
      for (const count of [17, 30, 60]) {
        const request = RankingRequestSchema.parse({
          ...baseline,
          preferences: {
            ...baseline.preferences,
            endDate: dates[6],
            dates,
            days: dates.map((date) => ({
              ...baseline.preferences.days[0],
              date,
              meals: Array.from({ length: mealsPerDay }, (_, index) => ({
                ...baseline.preferences.days[0].meals[index % 3],
                id:
                  index < 3
                    ? ["breakfast", "lunch", "dinner"][index]
                    : `extra-${index - 2}`,
                label:
                  index < 3
                    ? ["breakfast", "lunch", "dinner"][index]
                    : "Extra meal",
                scheduling: {
                  mode: "scheduled",
                  serviceId: "syn-meal-service-capacity-fixture",
                  window: { startMinute: 480, endMinute: 1080 },
                  windowConfirmed: true,
                },
              })),
            })),
          },
          candidates: Array.from({ length: count }, (_, index) => ({
            ...baseline.candidates[index % baseline.candidates.length],
            placeId: `syn-capacity-${String(index + 1).padStart(2, "0")}`,
            eligibleDates: dates,
          })),
        });
        const projected = buildGeminiParameters(request, "gemini-2.5-flash");
        const admitted = projected.inputBoundTokens <= 12000;
        const consume = vi.fn(createMemorySmokePermit());
        const generate = vi.fn(async () => sdkResponse(request));
        const outcome = await createGeminiRecommendationProvider({
          model: "gemini-2.5-flash",
          generateContent: generate,
          consumePermit: consume,
        }).rank(request, { signal: new AbortController().signal, attempt: 1 });
        expect(outcome).toMatchObject(
          admitted
            ? { status: "ok" }
            : {
                status: "error",
                code: "TOKEN_LIMIT",
                usage: { modelCalls: 0 },
              },
        );
        expect(consume).toHaveBeenCalledTimes(admitted ? 1 : 0);
        expect(generate).toHaveBeenCalledTimes(admitted ? 1 : 0);
        measurements.push({
          days: 7,
          mealsPerDay,
          candidates: count,
          contentBytes: new TextEncoder().encode(
            String(projected.parameters.contents),
          ).length,
          envelopeBytes: bytes(projected.parameters),
          byteAdmissionBound: projected.inputBoundTokens,
          mockAdmitted: admitted,
          b3OriginalRequestProxyUnits: Math.ceil(bytes(request) / 4),
        });
      }
    }
    console.info("E2 seven-day Gemini capacity:", JSON.stringify(measurements));
    expect(
      measurements.find(
        (row) => row.candidates === 60 && row.mealsPerDay === 13,
      )?.mockAdmitted,
    ).toBe(false);
  });

  it("preserves the original complete deterministic fallback when expanded meal preferences exceed admission", async () => {
    const baseline = approvedRequest();
    const dates = Array.from({ length: 7 }, (_, index) =>
      addCalendarDays(baseline.preferences.startDate, index),
    );
    const input = RankingRequestSchema.parse({
      ...baseline,
      preferences: {
        ...baseline.preferences,
        dates,
        endDate: dates[6],
        days: dates.map((date) => ({
          ...baseline.preferences.days[0],
          date,
          meals: baseline.preferences.days[0].meals.map((meal) => ({
            ...meal,
            scheduling: {
              mode: "scheduled",
              serviceId: "syn-meal-service-capacity-fixture",
              window: { startMinute: 480, endMinute: 1080 },
              windowConfirmed: true,
            },
          })),
        })),
      },
    }).preferences;
    const repository = getLocalRepository();
    const original = buildRankingRequest(
      input,
      SYNTHETIC_PLACES,
      TEST_AS_OF,
      repository.isCurrent.bind(repository),
    ).request;
    const consume = vi.fn(createMemorySmokePermit());
    const generate = vi.fn(async () => sdkResponse(original));
    const report = await rankCandidates(input, SYNTHETIC_PLACES, {
      repository,
      provider: createGeminiRecommendationProvider({
        model: "gemini-2.5-flash",
        generateContent: generate,
        consumePermit: consume,
      }),
      evaluatedAt: TEST_AS_OF,
      work: new WorkBudget(() => 0),
    });
    expect(report).toMatchObject({
      source: "deterministic_fallback",
      snapshotId: original.snapshotId,
      liveModelCalls: 0,
      rankings: fallbackResponse(original).rankings,
    });
    expect(report.rejectionCodes).toContain("TOKEN_LIMIT");
    expect(report.rankings).toHaveLength(original.candidates.length);
    expect(consume).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
});
