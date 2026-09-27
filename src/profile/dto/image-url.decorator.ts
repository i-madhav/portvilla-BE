import { IsUrl } from 'class-validator';

/**
 * The validator shared by every image field on the profile: identity
 * `primaryImage` / `coverImage`, work `coverImage` and `screenshots[].url`,
 * timeline `organizationLogoUrl`, testimonial and team `avatarUrl`, content
 * `thumbnailUrl` and media `url`.
 *
 * Why not plain `@IsUrl()`: it requires a top-level domain, and in local
 * development the asset module's `resolvedUrl` is
 * `http://localhost:3000/api/v1/assets/local/objects/…` — so an uploaded image
 * could never be saved. The relaxation widens nothing on the server: the API
 * never fetches these URLs, a visitor's browser does. Only http(s) is accepted,
 * which is all an `<img>` can use anyway.
 */
export function IsImageUrl(): PropertyDecorator {
  return IsUrl({ require_tld: false, protocols: ['http', 'https'] });
}
