// ─── Username rules ───────────────────────────────────────────────────────────
// Single source of truth for username validation, shared by CreateProfileDto and
// the availability endpoint. Duplicating the regex or the reserved list is how
// the two drift apart and start disagreeing about what is claimable — which is
// exactly the bug the availability endpoint exists to prevent.
//
// This list MUST also mirror the frontend's RESERVED_USERNAMES and contain every
// top-level frontend route: a username that shadows a route yields a profile the
// router can never resolve to.

/** 3–30 chars, lowercase alphanumerics and hyphens, no leading/trailing hyphen. */
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export const USERNAME_RULE_MESSAGE =
  'username must be 3-30 characters, contain only lowercase letters, numbers, and hyphens, ' +
  'and cannot start or end with a hyphen.';

export const RESERVED_USERNAMES = new Set<string>([
  // Backend + generic reserved words
  'admin',
  'api',
  'auth',
  'app',
  'me',
  'health',
  'static',
  'public',
  'private',
  'user',
  'users',
  'profile',
  'settings',
  'support',
  'help',
  'about',
  'contact',
  'terms',
  'privacy',
  // Frontend routes (must match ROUTES in the LE app). Missing any of these
  // lets a user claim a slug that the router resolves to its own page instead
  // of the profile.
  'login',
  'signup',
  'register',
  'logout',
  'dashboard',
  'onboarding',
  'forgot-password',
  'reset-password',
  'verify-email',
]);

export type UsernameRejection = 'invalid' | 'reserved';

/**
 * Returns null when the username is claimable in principle (format ok, not
 * reserved), or a reason otherwise. Does NOT check the database — callers add
 * the taken check separately, so this stays pure and testable.
 */
export function checkUsernameRule(raw: string): UsernameRejection | null {
  const slug = raw.trim().toLowerCase();
  if (!USERNAME_REGEX.test(slug)) return 'invalid';
  if (RESERVED_USERNAMES.has(slug)) return 'reserved';
  return null;
}
