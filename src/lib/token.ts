/**
 * Helpers for keeping the token Realtime holds from expiring. Clerk's session tokens
 * last 60 s, and the Realtime server closes a channel the moment the token it holds
 * expires. Realtime forwards a new token only at its 25 s heartbeat, so a token must
 * still have comfortably more than 25 s left when it is handed over.
 */

/** Seconds since the epoch at which the JWT expires, or null if it cannot be read. */
export function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/** Fetch a new token when the current one has less than `marginSeconds` left, or its expiry is unknown. */
export function needsRefresh(expSeconds: number | null, nowSeconds: number, marginSeconds: number): boolean {
  return expSeconds === null || expSeconds - nowSeconds < marginSeconds;
}

/**
 * Heartbeats are 25 s apart, so a token handed over with 40 s left is replaced at the
 * next heartbeat while it still has at least 15 s to run.
 */
export const REFRESH_MARGIN_SECONDS = 40;
