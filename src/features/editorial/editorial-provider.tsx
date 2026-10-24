"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createEditorialSession,
  type EditorialSession,
  type EditorialSnapshot,
} from "@/application/editorial/session";

const EditorialContext = createContext<{
  session: EditorialSession;
  snapshot: EditorialSnapshot;
} | null>(null);

/** Shared only within this React tree. Reload disposes every synthetic edit/event. */
export function EditorialProvider({ children }: { children: ReactNode }) {
  const [session] = useState(() => createEditorialSession());
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return (
    <EditorialContext value={{ session, snapshot }}>
      {children}
    </EditorialContext>
  );
}

export function useEditorialOptional() {
  return useContext(EditorialContext);
}
export function useEditorial() {
  const context = useEditorialOptional();
  if (!context)
    throw new Error("EditorialProvider is required for this local simulation.");
  return context;
}
