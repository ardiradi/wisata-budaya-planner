import { z } from "zod";
import {
  DateSchema,
  IntegerSchema,
  NormalizedPreferencesSchema,
} from "../contracts";

const id = z.string().min(1).max(120);
export const StopLockSchema = z.strictObject({
  placeId: id,
  date: DateSchema,
  index: IntegerSchema.max(4),
  startMinute: IntegerSchema.max(1439),
  durationMinutes: IntegerSchema.positive().max(480),
});
export const EditIntentSchema = z
  .strictObject({
    days: z
      .array(
        z.strictObject({
          date: DateSchema,
          stops: z
            .array(
              z.strictObject({
                id,
                placeId: id,
                lock: StopLockSchema.nullable(),
              }),
            )
            .max(5),
        }),
      )
      .min(1)
      .max(7),
  })
  .superRefine((intent, context) => {
    const ids = intent.days.flatMap((day) => day.stops.map((stop) => stop.id));
    if (
      new Set(ids).size !== ids.length ||
      new Set(intent.days.map((day) => day.date)).size !== intent.days.length
    )
      context.addIssue({
        code: "custom",
        message: "Logical stops and daily dates must be unique.",
      });
  });
export const EditOperationSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("swap"), stopId: id, placeId: id }),
  z.strictObject({ type: z.literal("remove"), stopId: id }),
  z.strictObject({
    type: z.literal("reorder"),
    date: DateSchema,
    stopIds: z.array(id).max(5),
  }),
  z.strictObject({ type: z.literal("lock"), stopId: id, locked: z.boolean() }),
  z.strictObject({
    type: z.literal("preferences"),
    input: NormalizedPreferencesSchema,
  }),
  z.strictObject({ type: z.literal("revert"), revisionId: id }),
]);
