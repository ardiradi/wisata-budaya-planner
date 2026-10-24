import { OPERATING_LIMITS } from "../contracts";

export class WorkLimitError extends Error {}
/** One instance per operation; not a distributed admission/spend ledger. */
export class WorkBudget {
  routeAttempts = 0;
  modelAttempts = 0;
  private modelReservedMicroUsd = 0;
  reserveModel(
    inputTokens: number,
    outputTokens: number,
    costMicroUsd: number,
  ) {
    this.check();
    if (this.modelAttempts >= OPERATING_LIMITS.aiAttempts)
      throw new WorkLimitError("MODEL_ATTEMPT_LIMIT");
    if (
      !Number.isSafeInteger(inputTokens) ||
      inputTokens < 0 ||
      inputTokens > 12000 ||
      outputTokens !== 2000
    )
      throw new WorkLimitError("MODEL_TOKEN_LIMIT");
    if (
      !Number.isSafeInteger(costMicroUsd) ||
      costMicroUsd < 0 ||
      this.modelReservedMicroUsd + costMicroUsd > 1000000
    )
      throw new WorkLimitError("MODEL_SPEND_LIMIT");
    this.modelAttempts++;
    this.modelReservedMicroUsd += costMicroUsd;
  }
  private readonly started: number;
  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly signal?: AbortSignal,
  ) {
    this.started = now();
  }
  get elapsedMs() {
    return Math.max(0, Math.round(this.now() - this.started));
  }
  check() {
    if (this.signal?.aborted) throw new WorkLimitError("CANCELLED");
    if (this.elapsedMs >= OPERATING_LIMITS.deadlineMs)
      throw new WorkLimitError("DEADLINE");
  }
  async run<T>(task: () => Promise<T>): Promise<T> {
    this.check();
    const remaining = OPERATING_LIMITS.deadlineMs - this.elapsedMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    try {
      const result = await Promise.race([
        task(),
        new Promise<never>((_, reject) => {
          onAbort = () => reject(new WorkLimitError("CANCELLED"));
          this.signal?.addEventListener("abort", onAbort, { once: true });
          if (this.signal?.aborted) onAbort();
          timer = setTimeout(
            () => reject(new WorkLimitError("DEADLINE")),
            remaining,
          );
        }),
      ]);
      this.check();
      return result;
    } finally {
      if (timer) clearTimeout(timer);
      if (onAbort) this.signal?.removeEventListener("abort", onAbort);
    }
  }
  async route<T>(task: () => Promise<T>): Promise<T> {
    this.check();
    if (this.routeAttempts >= OPERATING_LIMITS.routeAttempts)
      throw new WorkLimitError("ROUTE_LIMIT");
    this.routeAttempts++;
    return this.run(task);
  }
}
