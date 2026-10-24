import type { CostLine, PlanResult } from "./types";

/** BigInt intermediates prevent silent rounded/overflowed IDR arithmetic. */
export function safeAmount(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("IDR_OVERFLOW");
  return Number(value);
}
export function charge(amount: number, quantity: number): number {
  return safeAmount(BigInt(amount) * BigInt(quantity));
}
export function summarizeCost(
  lines: CostLine[],
  budgetIdr: number | null,
): PlanResult["cost"] {
  if (lines.some((line) => line.lowerIdr === null || line.upperIdr === null))
    return {
      lines,
      budgetIdr,
      lowerSubtotalIdr: null,
      upperSubtotalIdr: null,
      contingencyIdr: null,
      totalUpperIdr: null,
    };
  const lower = lines.reduce((sum, line) => sum + BigInt(line.lowerIdr!), 0n);
  const upper = lines.reduce((sum, line) => sum + BigInt(line.upperIdr!), 0n);
  const contingency = (upper + 9n) / 10n;
  return {
    lines,
    budgetIdr,
    lowerSubtotalIdr: safeAmount(lower),
    upperSubtotalIdr: safeAmount(upper),
    contingencyIdr: safeAmount(contingency),
    totalUpperIdr: safeAmount(upper + contingency),
  };
}
