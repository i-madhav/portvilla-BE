import { randomInt } from 'crypto';

import type { IProfile } from './profile.interface';

/**
 * Stable identifiers for array-section entries.
 *
 * `PATCH /profiles/me` replaces whole arrays, so an entry's array index is not
 * stable across edits and cannot be used to address content. Every entry
 * therefore carries a `key` that the client round-trips: an entry arriving
 * without one is a new entry, and gets a fresh key.
 *
 * Keys are opaque ids, not secrets — they only need to be collision-free within
 * their own array.
 */

export const ENTRY_KEY_LENGTH = 8;

/** Lowercase alphanumerics only: readable in a slide id such as `work:a7f2c19d`. */
export const ENTRY_KEY_REGEX = /^[a-z0-9]{8}$/;

export const ENTRY_KEY_MESSAGE =
  'key must be exactly 8 lowercase letters or digits';

/**
 * The sections whose entries are keyed.
 *
 * Arrays nested *inside* an entry (`screenshots`, `codeSnippets`, `links`, …)
 * are not addressable on their own and are deliberately left unkeyed. The one
 * exception is `works[].stages[]`, which is keyed by the repository alongside
 * its parent work.
 */
export const KEYED_ARRAY_SECTIONS = [
  'works',
  'timeline',
  'capabilities',
  'offerings',
  'metrics',
  'testimonials',
  'team',
  'media',
  'content',
] as const satisfies readonly (keyof IProfile)[];

/** An entry as it arrives from a client — `key` may be missing or malformed. */
export interface KeyableEntry {
  key?: string | null;
}

export function generateEntryKey(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < ENTRY_KEY_LENGTH; i += 1) {
    key += alphabet[randomInt(alphabet.length)];
  }
  return key;
}

/**
 * Returns a copy of `entries` in which every entry carries a well-formed key
 * that is unique within this array.
 *
 * A supplied key is preserved whenever it is valid and not already taken;
 * anything else — absent, malformed, or a duplicate of an earlier entry — is
 * replaced with a fresh key rather than rejected. A client that drops keys on
 * PATCH therefore re-keys its entries silently; that is the documented contract.
 */
export function withUniqueKeys<T extends KeyableEntry>(
  entries: readonly T[],
): (T & { key: string })[] {
  const taken = new Set<string>();

  return entries.map((entry) => {
    const key = isReusable(entry.key, taken) ? entry.key : freshKey(taken);
    taken.add(key);
    return { ...entry, key };
  });
}

function isReusable(
  key: string | null | undefined,
  taken: ReadonlySet<string>,
): key is string {
  return (
    typeof key === 'string' && ENTRY_KEY_REGEX.test(key) && !taken.has(key)
  );
}

function freshKey(taken: ReadonlySet<string>): string {
  let key = generateEntryKey();
  while (taken.has(key)) key = generateEntryKey();
  return key;
}
