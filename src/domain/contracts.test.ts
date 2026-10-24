import { describe, expect, it } from "vitest";
import {
  SyntheticPlaceSchema,
  RouteRequestSchema,
  RangeSchema,
} from "./contracts";
import { SYNTHETIC_PLACES } from "@/infrastructure/synthetic/catalogue";

describe("domain runtime contracts", () => {
  it("rejects malformed, fractional and inverted numeric ranges", () => {
    for (const range of [
      { lower: 2, upper: 1 },
      { lower: -1, upper: 2 },
      { lower: 1.1, upper: 2 },
      { lower: 1, upper: Infinity },
    ])
      expect(RangeSchema.safeParse(range).success).toBe(false);
    expect(RangeSchema.safeParse({ lower: 0, upper: 0 }).success).toBe(true);
  });
  it("distinguishes a known closure from an explicit replacement window", () => {
    const place = SYNTHETIC_PLACES[0];
    expect(
      SyntheticPlaceSchema.safeParse({
        ...place,
        exceptions: [{ date: "2026-11-01", closed: true, windows: [] }],
      }).success,
    ).toBe(true);
    expect(
      SyntheticPlaceSchema.safeParse({
        ...place,
        exceptions: [{ date: "2026-11-01", closed: false, windows: [] }],
      }).success,
    ).toBe(false);
    expect(
      SyntheticPlaceSchema.safeParse({
        ...place,
        exceptions: [
          { date: "2026-11-01", closed: true, windows: place.windows },
        ],
      }).success,
    ).toBe(false);
  });
  it("rejects duplicate date exceptions and any real-verification flag", () => {
    const place = SYNTHETIC_PLACES[0];
    const exception = { date: "2026-11-01", closed: true, windows: [] };
    expect(
      SyntheticPlaceSchema.safeParse({
        ...place,
        exceptions: [exception, exception],
      }).success,
    ).toBe(false);
    expect(
      SyntheticPlaceSchema.safeParse({ ...place, independentlyReviewed: true })
        .success,
    ).toBe(false);
  });
  it("binds route requests to a valid date, same-day departure, mode and party", () => {
    const request = {
      fromId: "anchor-a",
      toId: "syn-history-01",
      mode: "walk",
      date: "2026-10-30",
      departureMinute: 480,
      party: 2,
    };
    expect(RouteRequestSchema.safeParse(request).success).toBe(true);
    for (const patch of [
      { date: "2026-02-30" },
      { departureMinute: 1440 },
      { mode: "boat" },
      { party: 9 },
      { arbitraryCacheKey: true },
    ])
      expect(
        RouteRequestSchema.safeParse({ ...request, ...patch }).success,
      ).toBe(false);
  });
});
