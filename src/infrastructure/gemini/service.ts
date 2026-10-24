import { RankingRequestSchema } from "@/domain/recommendations/contracts";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildRankingRequest } from "@/domain/recommendations/ranking";
import { getLocalRepository } from "@/infrastructure/synthetic/catalogue";
import {
  createFileSmokePermit,
  isFileSmokeConsumed,
  type SmokePermit,
} from "./permit";
import {
  GEMINI_MODELS,
  createGeminiRecommendationProvider,
  type GeminiGenerate,
  type GeminiDiagnostic,
  type GeminiModel,
  type GeminiOutcome,
} from "./provider";

type Environment = Record<string, string | undefined>;
export type GeminiServiceOptions = {
  env?: Environment;
  generateContent?: GeminiGenerate;
  consumePermit?: SmokePermit;
  isConsumed?: () => Promise<boolean>;
  now?: () => string;
  timeoutMs?: number;
};
const HEADERS = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
};
function result(body: unknown, status = 200) {
  return Response.json(body, { status, headers: HEADERS });
}
function denied(
  code: "LIVE_DISABLED" | "INPUT_NOT_APPROVED" | "TOKEN_LIMIT",
  status: number,
) {
  return result(
    {
      status: "error",
      code,
      retryable: false,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        simulatedCostMicroUsd: 0,
        modelCalls: 0,
      },
    },
    status,
  );
}
export function isSameOriginLoopback(request: Request): boolean {
  try {
    const url = new URL(request.url);
    const local = (value: URL) =>
      value.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(value.hostname) &&
      !value.username &&
      !value.password;
    if (!local(url)) return false;
    // Next normalizes the internal URL to localhost even when the browser used 127.0.0.1.
    // Permit only equivalent loopback aliases on this exact port, never external origins.
    const origin = request.headers.get("origin");
    if (origin) {
      const parsed = new URL(origin);
      if (
        !local(parsed) ||
        parsed.port !== url.port ||
        origin !== parsed.origin
      )
        return false;
    }
    const host = request.headers.get("host");
    if (host) {
      const parsed = new URL(`http://${host}`);
      if (!local(parsed) || parsed.port !== url.port) return false;
    }
    return true;
  } catch {
    return false;
  }
}
function configuration(env: Environment) {
  // A key and enabled gate never imply authorization for a default model.
  const modelId = env.GEMINI_MODEL ?? "";
  const modelAllowed = GEMINI_MODELS.includes(modelId as GeminiModel);
  const keyConfigured = Boolean(env.GEMINI_API_KEY?.trim());
  const freeTierConfirmed = env.GEMINI_FREE_TIER_CONFIRMED === "true";
  const smokeEnabled = env.GEMINI_DEMO_SMOKE_ENABLED === "true";
  return {
    modelId,
    modelAllowed,
    keyConfigured,
    freeTierConfirmed,
    smokeEnabled,
  };
}
export async function handleGeminiStatus(
  request: Request,
  options: GeminiServiceOptions = {},
): Promise<Response> {
  if (request.method !== "GET" || !isSameOriginLoopback(request))
    return result({ ready: false }, 403);
  const config = configuration(options.env ?? process.env);
  let consumed = true;
  try {
    consumed = await (options.isConsumed ?? isFileSmokeConsumed)();
  } catch {
    /* fail closed */
  }
  return result({
    modelId: config.modelAllowed ? config.modelId : "unsupported",
    keyConfigured: config.keyConfigured,
    freeTierConfirmed: config.freeTierConfirmed,
    smokeEnabled: config.smokeEnabled,
    consumed,
    ready:
      config.modelAllowed &&
      config.keyConfigured &&
      config.freeTierConfirmed &&
      config.smokeEnabled &&
      !consumed,
  });
}
async function readBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > 65536 || !request.body) throw new Error("BODY_INVALID");
  const reader = request.body.getReader();
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 65536) {
        await reader.cancel();
        throw new Error("BODY_INVALID");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
export async function handleGeminiRecommendation(
  request: Request,
  options: GeminiServiceOptions = {},
): Promise<Response> {
  if (
    request.method !== "POST" ||
    !isSameOriginLoopback(request) ||
    request.headers.get("x-wisata-gemini-confirm") !== "one-free-tier-smoke" ||
    request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
  )
    return denied("INPUT_NOT_APPROVED", 403);
  const env = options.env ?? process.env;
  const config = configuration(env);
  if (
    !config.modelAllowed ||
    !config.keyConfigured ||
    !config.freeTierConfirmed ||
    !config.smokeEnabled
  )
    return denied("LIVE_DISABLED", 503);
  let body: unknown;
  try {
    body = await readBody(request);
  } catch {
    return denied("INPUT_NOT_APPROVED", 400);
  }
  const parsed = RankingRequestSchema.safeParse(body);
  if (!parsed.success) return denied("INPUT_NOT_APPROVED", 422);
  const repository = getLocalRepository();
  const evaluatedAt = (options.now ?? (() => new Date().toISOString()))();
  const expected = buildRankingRequest(
    parsed.data.preferences,
    await repository.list(parsed.data.cityId),
    evaluatedAt,
    repository.isCurrent.bind(repository),
  );
  // Exact original synthetic baseline, not arbitrary browser input or client editorial assertions.
  if (JSON.stringify(parsed.data) !== JSON.stringify(expected.request))
    return denied("INPUT_NOT_APPROVED", 422);
  let providerMetadata:
    { modelVersion?: string; usageMetadata?: unknown } | undefined;
  let diagnostic: GeminiDiagnostic | undefined;
  let sdkStage:
    | "not-started"
    | "importing-sdk"
    | "creating-client"
    | "calling-sdk"
    | "response-received" = "not-started";
  const generateContent: GeminiGenerate =
    options.generateContent ??
    (async (parameters) => {
      sdkStage = "importing-sdk";
      const sdk = await import("./server-sdk");
      sdkStage = "creating-client";
      const generate = sdk.createServerGeminiGenerate(
        env.GEMINI_API_KEY!.trim(),
      );
      sdkStage = "calling-sdk";
      const response = await generate(parameters);
      sdkStage = "response-received";
      providerMetadata = {
        modelVersion:
          "modelVersion" in response &&
          typeof response.modelVersion === "string" &&
          /^[A-Za-z0-9._-]{1,120}$/.test(response.modelVersion)
            ? response.modelVersion
            : undefined,
        usageMetadata: response.usageMetadata
          ? {
              promptTokenCount: response.usageMetadata.promptTokenCount,
              candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
              thoughtsTokenCount: response.usageMetadata.thoughtsTokenCount,
              totalTokenCount: response.usageMetadata.totalTokenCount,
              cachedContentTokenCount:
                response.usageMetadata.cachedContentTokenCount,
              toolUsePromptTokenCount:
                response.usageMetadata.toolUsePromptTokenCount,
            }
          : undefined,
      };
      return response;
    });
  const provider = createGeminiRecommendationProvider({
    generateContent,
    model: config.modelId as GeminiModel,
    consumePermit: options.consumePermit ?? createFileSmokePermit(),
    timeoutMs: options.timeoutMs,
    onDiagnostic: (value) => {
      diagnostic = value;
    },
  });
  const outcome = (await provider.rank(parsed.data, {
    signal: request.signal,
    attempt: 1,
  })) as GeminiOutcome;
  const status =
    outcome.status === "ok"
      ? 200
      : outcome.code === "RATE_LIMITED"
        ? 429
        : outcome.code === "LIVE_ALREADY_USED"
          ? 409
          : outcome.code === "TIMEOUT"
            ? 504
            : outcome.code === "TOKEN_LIMIT"
              ? 422
              : 502;
  // This isolated smoke-test receipt contains no key, request, place claims or model prose.
  // Injected test transports never write an apparent live-evidence receipt.
  if (!options.generateContent && outcome.usage.modelCalls === 1) {
    try {
      await writeFile(
        path.join(process.cwd(), ".local-demo/gemini-smoke-result.json"),
        JSON.stringify(
          {
            schemaVersion: "gemini-smoke-result-v1",
            modelId: config.modelId,
            completedAt: new Date().toISOString(),
            responseStatus: status,
            outcome: outcome.status,
            validated: outcome.status === "ok",
            usage: outcome.usage,
            providerMetadata,
            diagnostic: diagnostic ? { ...diagnostic, sdkStage } : undefined,
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
    } catch {
      /* Receipt failure cannot reset the consumed permit or trigger a second request. */
    }
  }
  return result(outcome, status);
}
