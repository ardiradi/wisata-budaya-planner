"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  generateSyntheticPlan,
  type SyntheticSubmission,
} from "@/application/planning/preview-planner";
import {
  createLocalEditingSession,
  submissionFromRevision,
  type EditingSnapshot,
  type LocalEditingSession,
} from "@/application/editing/local-session";
import type { MockRankingScenario } from "@/infrastructure/synthetic/mock-ranking";
import { useEditorialOptional } from "@/features/editorial/editorial-provider";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import { getGeminiProxy } from "@/infrastructure/browser/gemini-proxy";

type PlanningResult = Awaited<ReturnType<typeof generateSyntheticPlan>>;
type Phase = "idle" | "loading" | "ready" | "error";
type PlanningContextValue = {
  submission: SyntheticSubmission | null;
  result: PlanningResult | null;
  phase: Phase;
  error: string | null;
  editingSession: LocalEditingSession | null;
  editingSnapshot: EditingSnapshot | null;
  recommendationScenario: MockRankingScenario;
  setRecommendationScenario: (scenario: MockRankingScenario) => void;
  generate: (
    submission: SyntheticSubmission,
    scenario?: "normal" | "missing-route",
    recommendationScenario?: MockRankingScenario,
    liveModel?: "gemini-3.8-flash" | "gemini-2.5-flash",
  ) => Promise<void>;
  clear: () => void;
};

const PlanningContext = createContext<PlanningContextValue | null>(null);

/** React memory only. Navigation retains the preview; reload discards it. */
export function PlanningProvider({ children }: { children: ReactNode }) {
  const editorial = useEditorialOptional();
  const [submission, setSubmission] = useState<SyntheticSubmission | null>(
    null,
  );
  const [result, setResult] = useState<PlanningResult | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recommendationScenario, setRecommendationScenario] =
    useState<MockRankingScenario>("normal");
  const [editingSession, setEditingSession] =
    useState<LocalEditingSession | null>(null);
  const [editingSnapshot, setEditingSnapshot] =
    useState<EditingSnapshot | null>(null);
  const sessionRef = useRef<LocalEditingSession | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const operation = useRef(0);
  // A live repository projection invalidates current claims without mutating frozen history.
  useEffect(() => {
    sessionRef.current?.refreshEvidence();
  }, [editorial?.snapshot.revision]);
  useEffect(
    () => () => {
      operation.current += 1;
      unsubscribe.current?.();
      sessionRef.current?.dispose();
    },
    [],
  );

  async function generate(
    next: SyntheticSubmission,
    scenario: "normal" | "missing-route" = "normal",
    rankingScenario: MockRankingScenario = recommendationScenario,
    liveModel?: "gemini-3.8-flash" | "gemini-2.5-flash",
  ) {
    const id = ++operation.current;
    setSubmission(structuredClone(next));
    if (sessionRef.current) {
      // A second intake submission is an edit preview, never a silent replacement.
      const session = sessionRef.current;
      setError(null);
      await session.previewPreferences(session.getSnapshot().current.id, next);
      return;
    }
    setResult(null);
    setError(null);
    setPhase("loading");
    // Allow React to paint the acknowledgement before synchronous local work.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    try {
      const generated = await generateSyntheticPlan(
        next,
        scenario,
        rankingScenario,
        editorial?.session.getRepository(),
        liveModel ? getGeminiProxy(liveModel) : undefined,
      );
      if (operation.current !== id) return;
      setResult(generated);
      if (generated.input) {
        const session = createLocalEditingSession(
          generated,
          editorial
            ? {
                repository: editorial.session.getRepository(),
                routing: getSyntheticRouting(),
                evaluatedAt: new Date().toISOString(),
              }
            : undefined,
          () => new Date().toISOString(),
        );
        sessionRef.current = session;
        setEditingSession(session);
        setEditingSnapshot(session.getSnapshot());
        let revisionId = session.getSnapshot().current.id;
        unsubscribe.current = session.subscribe(() => {
          const snapshot = session.getSnapshot();
          setEditingSnapshot(snapshot);
          if (snapshot.current.id !== revisionId) {
            revisionId = snapshot.current.id;
            setSubmission(submissionFromRevision(snapshot.current));
          }
        });
      }
      setPhase("ready");
    } catch {
      if (operation.current !== id) return;
      setError(
        "Perhitungan lokal belum berhasil. Isian sintetis tetap tersedia; kembali ke preferensi untuk mencoba lagi.",
      );
      setPhase("error");
    }
  }

  function clear() {
    operation.current += 1;
    unsubscribe.current?.();
    sessionRef.current?.dispose();
    unsubscribe.current = null;
    sessionRef.current = null;
    setEditingSession(null);
    setEditingSnapshot(null);
    setSubmission(null);
    setResult(null);
    setPhase("idle");
    setError(null);
  }

  return (
    <PlanningContext
      value={{
        submission,
        result: editingSnapshot?.current.result ?? result,
        phase,
        error,
        generate,
        clear,
        editingSession,
        editingSnapshot,
        recommendationScenario,
        setRecommendationScenario,
      }}
    >
      {children}
    </PlanningContext>
  );
}

export function usePlanning() {
  const value = useContext(PlanningContext);
  if (!value)
    throw new Error("PlanningProvider is required for local planning.");
  return value;
}
