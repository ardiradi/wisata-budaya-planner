/** This flag is fixed at build time for public browser bundles. */
export const COMPETITION_DEMO =
  process.env.NEXT_PUBLIC_COMPETITION_DEMO === "true";

export const DEMO_LABEL = "Demo Kompetisi — Data Sintetis";

/** A competition build stays closed even when runtime environment flags are absent. */
export function liveProvidersDisabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    COMPETITION_DEMO ||
    env.NEXT_PUBLIC_COMPETITION_DEMO === "true" ||
    env.VERCEL === "1"
  );
}
