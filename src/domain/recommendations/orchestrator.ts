import type {
  CatalogueRepository,
  NormalizedPreferences,
  SyntheticPlace,
} from "../contracts";
import { evaluateEvidence } from "../evidence";
import { WorkBudget, WorkLimitError } from "../planner/work";
import {
  buildRankingRequest,
  fallbackResponse,
  validateRecommendationOutput,
} from "./ranking";
import {
  RankingOutcomeSchema,
  RecommendationReportSchema,
  type RecommendationProvider,
  type RecommendationReport,
  type RejectionCode,
} from "./contracts";

export const MOCK_ATTEMPT_TIMEOUT_MS = 250;
export const simulatedTokens = (value: unknown) =>
  Math.ceil(new TextEncoder().encode(JSON.stringify(value)).length / 4);
export async function rankCandidates(
  input: NormalizedPreferences,
  places: readonly SyntheticPlace[],
  dependencies: {
    repository: CatalogueRepository;
    provider: RecommendationProvider;
    evaluatedAt: string;
    work: WorkBudget;
    signal?: AbortSignal;
  },
): Promise<RecommendationReport> {
  const { repository, provider, evaluatedAt, work } = dependencies;
  const { request, evidenceRefs } = buildRankingRequest(
    input,
    places,
    evaluatedAt,
    (refs) => repository.isCurrent(refs),
  );
  const report: RecommendationReport = {
    schemaVersion: "recommendation-report-v1",
    source: "deterministic_fallback",
    synthetic: true,
    independentlyReviewed: false,
    providerId: provider.id,
    snapshotId: request.snapshotId,
    candidateCount: request.candidates.length,
    attempts: 0,
    inputTokens: 0,
    outputTokens: 0,
    simulatedCostMicroUsd: 0,
    actualApiCostMicroUsd: provider.kind === "live" ? null : 0,
    rejectionCodes: [],
    rankings: [],
    ...(provider.kind === "live"
      ? { modelId: provider.modelId, liveModelCalls: 0 }
      : {}),
  };
  const reject = (code: RejectionCode) => {
    if (!report.rejectionCodes.includes(code)) report.rejectionCodes.push(code);
  };
  const checkWork = () => {
    if (dependencies.signal?.aborted) throw new WorkLimitError("CANCELLED");
    work.check();
  };
  const current = () =>
    repository.isCurrent(evidenceRefs) &&
    request.candidates.every((c) =>
      evidenceRefs
        .filter((ref) => c.assertionIds.includes(ref.assertionId))
        .every((ref) =>
          c.eligibleDates.every(
            (date) => evaluateEvidence(ref, date, evaluatedAt).usable,
          ),
        ),
    );
  if (!request.candidates.length) {
    report.source = "unavailable";
    reject("NO_CANDIDATES");
    return RecommendationReportSchema.parse(report);
  }
  for (let index = 0; index < (provider.maxAttempts ?? 2); index++) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => controller.abort();
    dependencies.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      checkWork();
      if (!current()) {
        reject("EVIDENCE_CHANGED");
        break;
      }
      const tokens = simulatedTokens(request);
      if (tokens > 12000) {
        reject("TOKEN_LIMIT");
        break;
      }
      if (
        provider.admit &&
        provider.admit({
          attempt: work.modelAttempts + 1,
          reservationMicroUsd: 500000,
        }) !== true
      ) {
        reject("COST_DENIED");
        break;
      }
      work.reserveModel(tokens, 2000, 500000);
      report.attempts++;
      report.inputTokens += tokens;
      const raw = await work.run(() =>
        Promise.race([
          provider.rank(structuredClone(request), {
            signal: controller.signal,
            attempt: report.attempts,
            ...(index ? { repairCode: report.rejectionCodes.at(-1) } : {}),
          }),
          new Promise<never>((_, rejectTimeout) => {
            timer = setTimeout(
              () => {
                controller.abort();
                rejectTimeout(new Error("MOCK_TIMEOUT"));
              },
              Math.min(provider.timeoutMs ?? MOCK_ATTEMPT_TIMEOUT_MS, 45000),
            );
          }),
        ]),
      );
      checkWork();
      if (!current()) {
        reject("EVIDENCE_CHANGED");
        break;
      }
      const parsed = RankingOutcomeSchema.safeParse(raw);
      if (!parsed.success) {
        reject("SCHEMA_INVALID");
        continue;
      }
      const outcome = parsed.data;
      if (
        provider.kind === "live" &&
        outcome.status === "ok" &&
        outcome.usage.modelCalls !== 1
      ) {
        reject("SCHEMA_INVALID");
        break;
      }
      if (provider.kind === "live")
        report.liveModelCalls =
          (report.liveModelCalls ?? 0) + (outcome.usage.modelCalls ?? 0);
      if (
        outcome.usage.inputTokens > 12000 ||
        outcome.usage.outputTokens > 2000 ||
        (outcome.usage.inputBoundTokens ?? 0) > 12000 ||
        (provider.kind !== "live" &&
          outcome.status === "ok" &&
          simulatedTokens(outcome.output) > 2000)
      ) {
        reject("TOKEN_LIMIT");
        break;
      }
      if (
        outcome.usage.simulatedCostMicroUsd > 500000 ||
        report.simulatedCostMicroUsd + outcome.usage.simulatedCostMicroUsd >
          1000000
      ) {
        reject("SPEND_LIMIT");
        break;
      }
      report.outputTokens += outcome.usage.outputTokens;
      report.inputTokens +=
        Math.max(tokens, outcome.usage.inputTokens) - tokens;
      report.simulatedCostMicroUsd += outcome.usage.simulatedCostMicroUsd;
      if (outcome.status !== "ok") {
        reject(
          outcome.code === "REFUSAL"
            ? "REFUSAL"
            : outcome.code === "TIMEOUT"
              ? "TIMEOUT"
              : outcome.code === "UNAVAILABLE"
                ? "PROVIDER_FAILURE"
                : outcome.code,
        );
        if (outcome.retryable && outcome.code !== "REFUSAL") continue;
        break;
      }
      const validated = validateRecommendationOutput(outcome.output, request);
      if (!validated.ok) {
        reject(validated.code);
        continue;
      }
      report.source = provider.kind === "live" ? "gemini_live" : "mock_ai";
      report.rankings = validated.value.rankings;
      return RecommendationReportSchema.parse(report);
    } catch (error) {
      const code: RejectionCode = dependencies.signal?.aborted
        ? "CANCELLED"
        : error instanceof WorkLimitError
          ? error.message === "DEADLINE"
            ? "DEADLINE"
            : error.message === "CANCELLED"
              ? "CANCELLED"
              : error.message === "MODEL_ATTEMPT_LIMIT"
                ? "ATTEMPT_LIMIT"
                : "SPEND_LIMIT"
          : error instanceof Error && error.message === "MOCK_TIMEOUT"
            ? "TIMEOUT"
            : "PROVIDER_FAILURE";
      reject(code);
      if (code !== "TIMEOUT" && code !== "PROVIDER_FAILURE") break;
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      dependencies.signal?.removeEventListener("abort", onAbort);
    }
  }
  if (!current()) {
    report.source = "unavailable";
    reject("EVIDENCE_CHANGED");
  } else {
    try {
      checkWork();
      report.rankings = fallbackResponse(request).rankings;
    } catch (error) {
      report.source = "unavailable";
      reject(
        error instanceof WorkLimitError && error.message === "CANCELLED"
          ? "CANCELLED"
          : "DEADLINE",
      );
    }
  }
  return RecommendationReportSchema.parse(report);
}
