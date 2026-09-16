/**
 * The monthly minute budget — the one cost guard the backend owns.
 *
 * Pure on purpose: parsing the env value, finding the month window, deciding
 * "exhausted", and shaping the refusal are all things a test can pin down
 * without Mongo or Nest. The service does the I/O and calls in here.
 *
 * Decision: docs/decisions/2026-09-13-session-cost-guards.md
 */

export const MONTHLY_MINUTES_ENV = 'MONTHLY_MINUTES_PER_PROFILE';
export const DEFAULT_MONTHLY_MINUTES_PER_PROFILE = 120;

/** Stable code the frontend branches on — a throttler 429 has no `code`. */
export const MINUTE_BUDGET_EXHAUSTED = 'MINUTE_BUDGET_EXHAUSTED';

/** `null` means unlimited. */
export type MinuteBudget = number | null;

/**
 * Unset → the default. `0` → unlimited (the documented escape hatch for the
 * owner's own environment). Anything else that is not a positive integer is a
 * misconfiguration and must fail boot rather than silently run unguarded.
 */
export function parseMonthlyMinuteBudget(
  raw: string | undefined,
): MinuteBudget {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === '') {
    return DEFAULT_MONTHLY_MINUTES_PER_PROFILE;
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `${MONTHLY_MINUTES_ENV} must be a non-negative integer (0 = unlimited); got "${raw}".`,
    );
  }
  const minutes = Number(trimmed);
  return minutes === 0 ? null : minutes;
}

/** Budgets reset on the first of the month, UTC — one clock for every profile. */
export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextMonthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Whole minutes consumed, rounded up — a 30-second session costs a minute. */
export function minutesUsed(totalDurationSec: number): number {
  return Math.ceil(Math.max(0, totalDurationSec) / 60);
}

export function isBudgetExhausted(
  totalDurationSec: number,
  budget: MinuteBudget,
): boolean {
  if (budget === null) return false;
  return minutesUsed(totalDurationSec) >= budget;
}

export interface MinuteBudgetExhaustedBody {
  statusCode: 429;
  code: typeof MINUTE_BUDGET_EXHAUSTED;
  message: string;
  /** ISO timestamp of the next UTC month start, when the budget refills. */
  resetsAt: string;
}

export function minuteBudgetExhaustedBody(
  now: Date,
): MinuteBudgetExhaustedBody {
  return {
    statusCode: 429,
    code: MINUTE_BUDGET_EXHAUSTED,
    message: 'This agent has used its conversation time for the month.',
    resetsAt: nextMonthStartUtc(now).toISOString(),
  };
}
