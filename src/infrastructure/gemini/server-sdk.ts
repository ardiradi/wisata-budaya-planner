import "server-only";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_TIMEOUT_MS, type GeminiGenerate } from "./provider";

/** Called only after explicit free-tier guards and irreversible local reservation. */
export function createServerGeminiGenerate(
  apiKey: string,
  /** Injectable transport for offline SDK serialization/retry tests; never browser-configurable. */
  transport?: typeof fetch,
): GeminiGenerate {
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: GEMINI_TIMEOUT_MS,
      retryOptions: { attempts: 1 },
      ...(transport ? { fetch: transport } : {}),
    },
  });
  return (parameters) => client.models.generateContent(parameters);
}
