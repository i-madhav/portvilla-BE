import type { IUserRecord, UserRole } from '../interfaces/user.interface';

// ─── Injection Token ──────────────────────────────────────────────────────────
// Used with @Inject() so the service depends on the abstraction, not the
// concrete Mongoose implementation. Swap the binding in auth.module.ts to
// change the persistence layer without touching any other file.

export const USER_REPOSITORY = Symbol('IUserRepository');

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CreateUserData {
  email: string;
  passwordHash: string;
  role?: UserRole;
}

// ─── Repository Interface ─────────────────────────────────────────────────────
// Defines the contract the service layer relies on. The concrete implementation
// lives in infrastructure/repository/ and is opaque to everything above it.

export interface IUserRepository {
  create(data: CreateUserData): Promise<IUserRecord>;
  findByEmail(email: string): Promise<IUserRecord | null>;
  findById(id: string): Promise<IUserRecord | null>;
  existsByEmail(email: string): Promise<boolean>;
  markEmailVerified(id: string): Promise<void>;
  setRefreshTokenHash(id: string, hash: string | null): Promise<void>;
}
