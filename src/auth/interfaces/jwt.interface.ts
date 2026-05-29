import { UserRole } from './user.interface';

// ─── JWT Payload ──────────────────────────────────────────────────────────────
// Shape of the data encoded inside every JWT (access and refresh alike).

export interface JwtPayload {
  /** Subject — the user's database id. */
  sub: string;
  email: string;
  role: UserRole;
}

// ─── Token Pair ───────────────────────────────────────────────────────────────
// Returned to the client after a successful login or token refresh.

export interface JwtTokenPair {
  accessToken: string;
  refreshToken: string;
}
