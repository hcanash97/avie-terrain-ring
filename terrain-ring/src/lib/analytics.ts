/** Placeholder analytics hook — swap for PostHog/GA in a later phase. */
export function track(event: string, properties: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) console.debug("[analytics]", event, properties);
}
