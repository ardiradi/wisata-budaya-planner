import { z } from "zod";
import type { SyntheticPlace } from "../contracts";

export const EDITORIAL_FIELDS = [
  "identity",
  "location",
  "hours",
  "exceptions",
  "categories",
  "admission",
  "walking",
  "dietary",
  "accessibility",
] as const;
export type EditorialField = (typeof EDITORIAL_FIELDS)[number];
export const EditorialFieldSchema = z.enum(EDITORIAL_FIELDS);
export const EditorialActorSchema = z.union([
  z.strictObject({
    id: z.literal("sim-curator"),
    role: z.literal("curator"),
    label: z.literal("Kurator simulasi"),
  }),
  z.strictObject({
    id: z.literal("sim-reviewer"),
    role: z.literal("reviewer"),
    label: z.literal("Peninjau simulasi"),
  }),
]);
export type EditorialActor = z.infer<typeof EditorialActorSchema>;
export const SIMULATED_CURATOR: EditorialActor = Object.freeze({
  id: "sim-curator",
  role: "curator",
  label: "Kurator simulasi",
});
export const SIMULATED_REVIEWER: EditorialActor = Object.freeze({
  id: "sim-reviewer",
  role: "reviewer",
  label: "Peninjau simulasi",
});
export type EditorialStatus =
  | "baseline_fixture"
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "withdrawn";
export type EditorialEvent = {
  id: string;
  sequence: number;
  at: string;
  placeId: string;
  action:
    | "baseline_fixture"
    | "created"
    | "edited"
    | "submitted"
    | "approved"
    | "rejected"
    | "withdrawn"
    | "evidence_revoked";
  actorId: "system-fixture" | EditorialActor["id"];
  actorRole: "system" | EditorialActor["role"];
  note: string;
  synthetic: true;
  independentlyReviewed: false;
};
export type EditorialRecord = {
  id: string;
  status: EditorialStatus;
  active: SyntheticPlace | null;
  draft: SyntheticPlace | null;
  contributorId: EditorialActor["id"] | null;
  events: EditorialEvent[];
  eligibilityIssues: string[];
};
export type EditorialSnapshot = {
  revision: number;
  records: EditorialRecord[];
  events: EditorialEvent[];
  synthetic: true;
  independentlyReviewed: false;
};
export type EditorialActionResult =
  { ok: true } | { ok: false; code: string; message: string };
