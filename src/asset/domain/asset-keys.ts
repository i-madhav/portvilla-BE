/**
 * Object keys are entirely server-generated from ids we minted. The client's
 * filename never appears in a key, which removes path traversal, cross-user
 * overwrite, collisions and unicode-normalisation tricks as a class.
 *
 * Derived rather than read back from the record, so the service never needs
 * storage internals on `IAssetRecord`.
 */
export function quarantineKeyFor(userId: string, assetId: string): string {
  return `q/${userId}/${assetId}`;
}

/**
 * No extension: the content type lives in object metadata (set from the
 * sniffed bytes), so the delivery Worker can map `assetId` → key without a
 * database lookup.
 */
export function objectKeyFor(assetId: string): string {
  return `a/${assetId}/o`;
}
