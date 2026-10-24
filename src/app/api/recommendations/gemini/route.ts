import "server-only";
import { liveProvidersDisabled } from "@/config/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function disabledResponse() {
  return Response.json(
    { code: "LIVE_DISABLED", ready: false, retryable: false },
    {
      status: 403,
      headers: {
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
export async function GET(request: Request) {
  if (liveProvidersDisabled()) return disabledResponse();
  const { handleGeminiStatus } =
    await import("@/infrastructure/gemini/service");
  return handleGeminiStatus(request);
}
export async function POST(request: Request) {
  if (liveProvidersDisabled()) return disabledResponse();
  const { handleGeminiRecommendation } =
    await import("@/infrastructure/gemini/service");
  return handleGeminiRecommendation(request);
}
