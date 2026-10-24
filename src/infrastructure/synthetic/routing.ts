import {
  RouteOutcomeSchema,
  RouteRequestSchema,
  type RouteOutcome,
  type RouteRequest,
  type RoutingProvider,
} from "@/domain/contracts";
import { fixtureEvidence } from "./evidence-fixture";

export const FIXTURE_ENDPOINTS = [
  "anchor-a",
  "anchor-b",
  "syn-history-01",
  "syn-craft-01",
  "syn-architecture-01",
  "syn-food-01",
  "syn-food-02",
  "syn-culture-02",
  "syn-history-02",
  "syn-history-03",
  "syn-history-04",
  "syn-history-05",
  "syn-history-06",
  "syn-history-07",
  "syn-food-03",
  "syn-food-04",
  "syn-food-05",
  "syn-food-06",
  "syn-food-07",
] as const;
// Explicit directed fixture table. Values are synthetic walking meters between access points.
// They are not straight-line calculations, map data or measurements of real streets.
const DIRECTED_METERS = [
  [0, 1600, 350, 450, 600, 250, 700, 800],
  [1800, 0, 1100, 900, 850, 1000, -1, 950],
  [400, 1200, 0, 220, 300, 180, 450, 500],
  [500, 1000, 250, 0, 210, 300, 420, 350],
  [650, 900, 330, 240, 0, 350, 280, 190],
  [300, 1100, 200, 320, 370, 0, 380, 500],
  [750, -1, 470, 440, 310, 400, 0, 260],
  [850, 1050, 530, 380, 220, 540, 290, 0],
] as const;

export function routeFixtureKey(
  request: Pick<RouteRequest, "mode" | "fromId" | "toId">,
): string {
  return `${request.mode}:${request.fromId}>${request.toId}`;
}
export type SyntheticRoutingOptions = {
  /** Each invocation consumes the next explicit result; useful for real retry-accounting tests. */
  outcomes?: Readonly<Record<string, readonly RouteOutcome[]>>;
};

export function getSyntheticRouting(
  options: SyntheticRoutingOptions = {},
): RoutingProvider {
  const scripted = structuredClone(options.outcomes ?? {});
  const cursors = new Map<string, number>();
  return {
    id: "synthetic-directed-routes-v1",
    async resolve(raw) {
      const parsed = RouteRequestSchema.safeParse(raw);
      if (!parsed.success)
        return {
          status: "unknown",
          reason: "The route request is malformed.",
          retryable: false,
        };
      const request = parsed.data;
      const key = routeFixtureKey(request);
      const cursor = cursors.get(key) ?? 0;
      cursors.set(key, cursor + 1);
      if (scripted[key]?.[cursor])
        return RouteOutcomeSchema.parse(structuredClone(scripted[key][cursor]));
      const from = FIXTURE_ENDPOINTS.indexOf(
        request.fromId as (typeof FIXTURE_ENDPOINTS)[number],
      );
      const to = FIXTURE_ENDPOINTS.indexOf(
        request.toId as (typeof FIXTURE_ENDPOINTS)[number],
      );
      if (
        from < 0 ||
        to < 0 ||
        request.date < "2000-01-01" ||
        request.date > "2100-12-31"
      )
        return {
          status: "unknown",
          reason:
            "No directed fixture exists for these exact endpoints and date.",
          retryable: false,
        };
      // Preserve the original eight-endpoint fixture table, including its barrier.
      // Added endpoints use this declared synthetic fixture formula only. These
      // invented test values are neither real routing nor geographic calculations.
      const meters =
        from < DIRECTED_METERS.length && to < DIRECTED_METERS.length
          ? DIRECTED_METERS[from][to]
          : from === to
            ? 0
            : 400 + from * 15 + to * 20;
      if (meters < 0 && request.mode === "walk")
        return {
          status: "unreachable",
          reason:
            "The synthetic barrier has no supported walking crossing for this directed leg.",
          retryable: false,
        };
      const distance = meters < 0 ? 2400 : meters;
      const vehicleCount = Math.ceil(request.party / 4);
      const walking = request.mode === "walk";
      const duration = walking
        ? Math.ceil(distance / 65)
        : Math.ceil(distance / 200) + (request.mode === "taxi" ? 5 : 3);
      const groupLower = walking
        ? 0
        : (request.mode === "taxi" ? 20000 : 10000) * vehicleCount;
      const groupUpper = walking
        ? 0
        : (request.mode === "taxi" ? 25000 : 15000) * vehicleCount;
      return RouteOutcomeSchema.parse({
        status: "ok",
        data: {
          binding: request,
          durationMinutes: {
            lower: duration,
            upper: duration + (distance === 0 ? 0 : 3),
          },
          distanceMeters: {
            lower: distance,
            upper: distance + (distance === 0 ? 0 : 50),
          },
          // Vehicle-mode walking covers pickup/parking only; venue access/interior
          // walking is disjoint and supplied by the catalogue. Never infer it from driving meters.
          walkingMeters: walking
            ? { lower: distance, upper: distance + (distance === 0 ? 0 : 50) }
            : { lower: 60, upper: 100 },
          costIdr: { lower: groupLower, upper: groupUpper, unit: "group" },
          evidence: fixtureEvidence(
            `route:${key}:${request.date}:${request.departureMinute}:party-${request.party}`,
            "duration-distance-walking-group-cost",
          ),
          synthetic: true,
        },
      });
    },
  };
}

export const createSyntheticRoutingProvider = getSyntheticRouting;
