import { describe, expect, it } from "vitest";
import { getLocalRepository, SYNTHETIC_PLACES } from "./catalogue";
import {
  FIXTURE_ENDPOINTS,
  getSyntheticRouting,
  routeFixtureKey,
} from "./routing";
import type { RouteRequest } from "@/domain/contracts";

const request: RouteRequest = {
  fromId: "anchor-a",
  toId: "syn-history-01",
  mode: "walk",
  date: "2026-10-30",
  departureMinute: 480,
  party: 2,
};
describe("request-scoped local catalogue", () => {
  it("provides seven distinct history and food fixtures with separate immutable evidence", async () => {
    const places = await getLocalRepository().list("palembang");
    expect(places).toHaveLength(17);
    expect(new Set(places.map((place) => place.id)).size).toBe(17);
    expect(
      places.filter((place) => place.id.startsWith("syn-history-")),
    ).toHaveLength(7);
    expect(places.filter((place) => place.kind === "food")).toHaveLength(7);
    const fields = places.flatMap((place) => Object.values(place.evidence));
    expect(new Set(fields.map((field) => field.assertionId)).size).toBe(
      fields.length,
    );
    expect(new Set(fields.map((field) => field.fieldHeadId)).size).toBe(
      fields.length,
    );
    expect(places.every((place) => !place.independentlyReviewed)).toBe(true);
    expect(Object.isFrozen(SYNTHETIC_PLACES[16].evidence.hours)).toBe(true);
  });
  it("returns independent copies without exposing a cross-city catalogue", async () => {
    const repository = getLocalRepository();
    const first = await repository.list("palembang");
    first[0].name = "mutated";
    first[0].evidence.hours.state = "revoked";
    const next = await repository.list("palembang");
    expect(next[0].name).toBe(SYNTHETIC_PLACES[0].name);
    expect(next[0].evidence.hours.state).toBe("fixture");
    expect(await repository.list("unsupported")).toEqual([]);
    expect(
      next.every((place) => place.synthetic && !place.independentlyReviewed),
    ).toBe(true);
  });
  it("pins exact publication heads and rejects an injected head race", async () => {
    const ref = SYNTHETIC_PLACES[0].evidence.hours;
    expect(getLocalRepository().isCurrent([ref])).toBe(true);
    const raced = getLocalRepository({
      headOverrides: { [ref.fieldHeadId]: { revision: 2 } },
    });
    expect(raced.isCurrent([ref])).toBe(false);
    expect(
      getLocalRepository().isCurrent([{ ...ref, publicationRevision: 2 }]),
    ).toBe(false);
    expect(Object.isFrozen(SYNTHETIC_PLACES[0].evidence.hours)).toBe(true);
  });
  it("does not infer real dietary/access evidence from a generic allowance name", async () => {
    const repository = getLocalRepository();
    const allowance = await repository.getMealAllowance();
    expect(allowance.price).toEqual({
      lower: 30000,
      upper: 40000,
      unit: "portion",
    });
    expect(allowance.dietaryEvidence.independentlyReviewed).toBe(false);
    expect(allowance.accessibilityEvidence.independentlyReviewed).toBe(false);
    allowance.price.upper = 0;
    expect((await repository.getMealAllowance()).price.upper).toBe(40000);
  });
});
describe("directed synthetic routing adapter", () => {
  it("binds added endpoints to the declared synthetic fixture formula", async () => {
    expect(FIXTURE_ENDPOINTS).toHaveLength(19);
    const provider = getSyntheticRouting();
    const addedRequest = {
      ...request,
      fromId: "syn-history-07",
      toId: "syn-food-07",
      mode: "car" as const,
    };
    const route = await provider.resolve(addedRequest);
    if (route.status !== "ok") throw new Error("Expected added fixture route.");
    expect(route.data.binding).toEqual(addedRequest);
    const meters = 400 + 13 * 15 + 18 * 20;
    expect(route.data.distanceMeters).toEqual({
      lower: meters,
      upper: meters + 50,
    });
    expect(route.data.walkingMeters).toEqual({ lower: 60, upper: 100 });
    expect(route.data.costIdr).toEqual({
      lower: 10000,
      upper: 15000,
      unit: "group",
    });
    expect(route.data.evidence.independentlyReviewed).toBe(false);
    expect(
      await provider.resolve({ ...addedRequest, toId: "syn-food-08" }),
    ).toMatchObject({
      status: "unknown",
      retryable: false,
    });
  });
  it("keeps direction, mode, date, departure and party bound to each output", async () => {
    const provider = getSyntheticRouting();
    const forward = await provider.resolve(request);
    const reversed = await provider.resolve({
      ...request,
      fromId: request.toId,
      toId: request.fromId,
    });
    expect(forward.status).toBe("ok");
    expect(reversed.status).toBe("ok");
    if (forward.status !== "ok" || reversed.status !== "ok") return;
    expect(forward.data.binding).toEqual(request);
    expect(forward.data.distanceMeters).not.toEqual(
      reversed.data.distanceMeters,
    );
    expect(forward.data.costIdr).toEqual({ lower: 0, upper: 0, unit: "group" });
    expect(forward.data.evidence.independentlyReviewed).toBe(false);
  });
  it("includes pickup walking in driving trips and quantities group prices by vehicle capacity", async () => {
    const provider = getSyntheticRouting();
    const small = await provider.resolve({
      ...request,
      mode: "taxi",
      party: 4,
    });
    const large = await provider.resolve({
      ...request,
      mode: "taxi",
      party: 5,
    });
    if (small.status !== "ok" || large.status !== "ok")
      throw new Error("Expected fixture routes.");
    expect(large.data.costIdr.upper).toBe(2 * small.data.costIdr.upper);
    expect(large.data.walkingMeters.upper).toBeGreaterThan(0);
    expect(large.data.walkingMeters.upper).toBeLessThan(
      large.data.distanceMeters.lower,
    );
  });
  it("returns unknown endpoints and a known walking barrier without inventing routes", async () => {
    const provider = getSyntheticRouting();
    expect(
      await provider.resolve({ ...request, fromId: "unlisted-entrance" }),
    ).toMatchObject({ status: "unknown", retryable: false });
    expect(
      await provider.resolve({
        ...request,
        fromId: "anchor-b",
        toId: "syn-food-02",
      }),
    ).toMatchObject({ status: "unreachable", retryable: false });
    expect(
      (
        await provider.resolve({
          ...request,
          fromId: "anchor-b",
          toId: "syn-food-02",
          mode: "car",
        })
      ).status,
    ).toBe("ok");
  });
  it("supports explicit error sequences without hidden retries or shared counters", async () => {
    const options = {
      outcomes: {
        [routeFixtureKey(request)]: [
          {
            status: "error" as const,
            reason: "Synthetic timeout",
            retryable: true,
          },
        ],
      },
    };
    const provider = getSyntheticRouting(options);
    expect(await provider.resolve(request)).toMatchObject({
      status: "error",
      retryable: true,
    });
    expect((await provider.resolve(request)).status).toBe("ok");
    expect((await getSyntheticRouting(options).resolve(request)).status).toBe(
      "error",
    );
  });
});
