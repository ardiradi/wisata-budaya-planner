// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { buildGeminiParameters } from "./provider";
import { approvedRequest, compactResponse } from "./test-fixtures";

vi.mock("server-only", () => ({}));
import { createServerGeminiGenerate } from "./server-sdk";

describe("official SDK serialization with an entirely injected offline transport", () => {
  it("serializes the actual compact schema and Gemini 2.5 generation config without any tools", async () => {
    const request = approvedRequest();
    const transport = vi.fn<typeof fetch>(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(compactResponse(request)) }],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 400 },
      }),
    );
    const { parameters } = buildGeminiParameters(request, "gemini-2.5-flash");
    const response = await createServerGeminiGenerate(
      "synthetic-placeholder-never-valid",
      transport,
    )(parameters);
    expect(JSON.parse(response.text!)).toEqual(compactResponse(request));
    expect(transport).toHaveBeenCalledTimes(1);
    const [url, init] = transport.mock.calls[0]!;
    expect(String(url)).toContain("/models/gemini-2.5-flash:generateContent");
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["schemaVersion", "snapshotId", "rankings"],
      },
      thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
      maxOutputTokens: 2000,
      candidateCount: 1,
    });
    expect(body.tools).toBeUndefined();
    expect(body.cachedContent).toBeUndefined();
    expect(body.generationConfig.abortSignal).toBeUndefined();
  });

  it.each([429, 503])(
    "makes exactly one transport attempt on upstream %s",
    async (status) => {
      const transport = vi.fn<typeof fetch>(async () =>
        Response.json(
          { error: { code: status, message: "synthetic refusal" } },
          { status },
        ),
      );
      const { parameters } = buildGeminiParameters(
        approvedRequest(),
        "gemini-2.5-flash",
      );
      await expect(
        createServerGeminiGenerate(
          "synthetic-placeholder-never-valid",
          transport,
        )(parameters),
      ).rejects.toMatchObject({ status });
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );

  it("propagates cancellation into the SDK transport signal", async () => {
    const abort = new AbortController();
    const transport = vi.fn<typeof fetch>(async (_url, init) => {
      abort.abort();
      expect(init?.signal?.aborted).toBe(true);
      throw new DOMException("synthetic cancellation", "AbortError");
    });
    const { parameters } = buildGeminiParameters(
      approvedRequest(),
      "gemini-2.5-flash",
    );
    parameters.config!.abortSignal = abort.signal;
    await expect(
      createServerGeminiGenerate(
        "synthetic-placeholder-never-valid",
        transport,
      )(parameters),
    ).rejects.toBeDefined();
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
