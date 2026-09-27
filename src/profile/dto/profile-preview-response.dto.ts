import { ApiProperty } from '@nestjs/swagger';

import {
  AgentTechnicalDepth,
  AgentTone,
  AgentVerbosity,
} from '../domain/profile.interface';
import type { IProfileRecord } from '../domain/profile.interface';
import { projectSlides } from '../domain/slide.projector';
import type { Slide } from '../domain/slide';

/**
 * How the agent will speak — the same allowlist as `AgentPersonaDto` in the
 * `agent` module. Duplicated deliberately rather than imported: that DTO is
 * pinned to the worker's wire contract, this one is owner-facing and free to
 * grow independently. See `docs/decisions/2026-09-16-mandatory-work-date-and-owner-slide-preview.md`.
 */
export class ProfilePreviewPersonaDto {
  @ApiProperty({ example: 'Alex' }) agentName!: string;
  @ApiProperty({ enum: AgentTone }) tone!: AgentTone;
  @ApiProperty({ enum: AgentVerbosity }) verbosity!: AgentVerbosity;
  @ApiProperty({ enum: AgentTechnicalDepth })
  technicalDepth!: AgentTechnicalDepth;
}

/**
 * The owner-facing preview: exactly the slide catalog the agent will narrate,
 * built by the same `projectSlides()` the agent's context uses. Nothing here
 * is a second, hand-maintained approximation — a section with nothing in it
 * (or `media` holding only videos) simply produces no slide, same as it would
 * for a visitor.
 */
export class ProfilePreviewResponseDto {
  @ApiProperty({ example: 'jane-doe' })
  username!: string;

  @ApiProperty({ type: ProfilePreviewPersonaDto })
  persona!: ProfilePreviewPersonaDto;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description:
      'The ordered slide catalog, identical in shape and content to what ' +
      '`GET /agent/context/:username` serves the voice worker: each slide is ' +
      '`{ id, template, title, payload, talkTrack, focus }`.',
  })
  slides!: Slide[];

  static fromRecord(record: IProfileRecord): ProfilePreviewResponseDto {
    const dto = new ProfilePreviewResponseDto();
    dto.username = record.username;

    const persona = record.agentPersona;
    dto.persona = {
      agentName: persona.agentName,
      tone: persona.tone,
      verbosity: persona.verbosity,
      technicalDepth: persona.technicalDepth,
    };

    dto.slides = projectSlides(record);
    return dto;
  }
}
