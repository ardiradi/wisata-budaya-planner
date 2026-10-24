import type { NormalizedPreferences } from "../contracts";
import type { PlanResult } from "../planner/types";

/** One explicit B2 control fixes all four baseline lock dimensions and the date. */
export type StopLock = {
  placeId: string;
  date: string;
  index: number;
  startMinute: number;
  durationMinutes: number;
};
export type StopIntent = { id: string; placeId: string; lock: StopLock | null };
export type EditIntent = { days: { date: string; stops: StopIntent[] }[] };
export type EditOperation =
  | { type: "swap"; stopId: string; placeId: string }
  | { type: "remove"; stopId: string }
  | { type: "reorder"; date: string; stopIds: string[] }
  | { type: "lock"; stopId: string; locked: boolean }
  | { type: "preferences"; input: NormalizedPreferences }
  | { type: "revert"; revisionId: string };
export type ItineraryRevision = {
  id: string;
  number: number;
  parentId: string | null;
  origin: "generated" | "edit" | "revert";
  revertedFromId: string | null;
  createdAt: string;
  input: NormalizedPreferences;
  intent: EditIntent;
  result: PlanResult;
  availability: "available" | "withdrawn";
};
export type EditPreview = {
  id: string;
  baseRevisionId: string;
  operation: EditOperation;
  sourceRevisionId: string | null;
  before: ItineraryRevision;
  proposed: {
    input: NormalizedPreferences;
    intent: EditIntent;
    result: PlanResult;
  };
  createdAt: string;
};
export type EditingSnapshot = {
  current: ItineraryRevision;
  history: ItineraryRevision[];
  lastValidRevisionId: string | null;
  preview: EditPreview | null;
  busy: boolean;
  message: { kind: "success" | "conflict" | "error"; text: string } | null;
};
