import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

import { ENTRY_KEY_MESSAGE, ENTRY_KEY_REGEX } from '../domain/entry-key';

/**
 * The `key` property shared by every array-entry DTO.
 *
 * Optional on the wire: an entry sent without a key is a new entry and the
 * repository mints one. Clients must round-trip the keys they were given —
 * dropping them re-keys the entry, and anything addressing it by key (a slide
 * id, an agent tool call) stops resolving.
 */
export function IsEntryKey() {
  return applyDecorators(
    ApiPropertyOptional({
      example: 'a7f21c9d',
      description:
        'Stable id for this entry. Omit when creating; round-trip it otherwise.',
    }),
    IsString(),
    Matches(ENTRY_KEY_REGEX, { message: ENTRY_KEY_MESSAGE }),
    IsOptional(),
  );
}
