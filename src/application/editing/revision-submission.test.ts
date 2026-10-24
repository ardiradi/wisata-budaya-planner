import { describe, expect, it } from "vitest";
import {
  buildSyntheticScenario,
  generateSyntheticPlan,
} from "@/application/planning/preview-planner";
import { getLocalRepository } from "@/infrastructure/synthetic/catalogue";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import {
  createLocalEditingSession,
  submissionFromRevision,
} from "./local-session";

describe("meal scheduling survives immutable revision form roundtrips", () => {
  it("retains confirmed windows, exact portion exemptions and planning style across an explicit budget edit", async () => {
    const input = buildSyntheticScenario("feasible", "2026-10-23");
    input.input.planningStyle = "pace";
    input.days[0].meals.lunch = {
      ...input.days[0].meals.lunch,
      provided: 1,
      prepaid: 1,
      scheduling: {
        mode: "scheduled",
        serviceId: "syn-meal-service-food-01",
        window: { start: "12:00", end: "13:00" },
        windowConfirmed: true,
      },
    };
    const initial = await generateSyntheticPlan(input);
    expect(initial.status).toBe("validated");
    const session = createLocalEditingSession(initial, {
      repository: getLocalRepository(),
      routing: getSyntheticRouting(),
      evaluatedAt: initial.evaluatedAt,
    });
    const original = session.getSnapshot().current;
    const originalBody = JSON.stringify(original.result);
    const submission = submissionFromRevision(original);
    expect(submission.input.planningStyle).toBe("pace");
    expect(submission.days[0].meals.lunch).toEqual(input.days[0].meals.lunch);
    submission.input.budget = "1600000";
    await session.previewPreferences(original.id, submission);
    const preview = session.getSnapshot().preview!;
    expect(preview.proposed.result.status).toBe("validated");
    expect(
      preview.proposed.result.days[0].meals.find((meal) => meal.id === "lunch"),
    ).toMatchObject({
      schedulingStatus: "scheduled",
      necessary: 2,
      provided: 1,
      prepaid: 1,
      purchased: 0,
    });
    await session.commit(preview.id);
    expect(session.getSnapshot().current.number).toBe(2);
    expect(JSON.stringify(session.getSnapshot().history[0].result)).toBe(
      originalBody,
    );
    expect(
      submissionFromRevision(session.getSnapshot().current).days[0].meals.lunch
        .scheduling,
    ).toEqual(input.days[0].meals.lunch.scheduling);
  });
});
