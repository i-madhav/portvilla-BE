import { ApiProperty } from '@nestjs/swagger';

import {
  AgentSpeakingSpeed,
  AgentTechnicalDepth,
  AgentTone,
  AgentVerbosity,
} from '../../profile/domain/profile.interface';
import type { IProfileRecord } from '../../profile/domain/profile.interface';
import { projectSlides } from '../../profile/domain/slide.projector';
import type { Slide } from '../../profile/domain/slide';

/**
 * How the agent should sound. Every field here is already a rendering
 * instruction — none of it is a secret, and all of it is consumed by the worker
 * (tone/verbosity/depth shape the prompt, voiceId and speakingSpeed the TTS).
 */
export class AgentPersonaDto {
  @ApiProperty({ example: 'Alex' }) agentName!: string;
  @ApiProperty({ enum: AgentTone }) tone!: AgentTone;
  @ApiProperty({ enum: AgentVerbosity }) verbosity!: AgentVerbosity;
  @ApiProperty({ enum: AgentTechnicalDepth })
  technicalDepth!: AgentTechnicalDepth;
  @ApiProperty({ enum: AgentSpeakingSpeed })
  speakingSpeed!: AgentSpeakingSpeed;
  @ApiProperty({ nullable: true }) voiceId!: string | null;
}

/**
 * Everything the voice worker gets, and nothing else.
 *
 * A second allowlist, distinct from `PublicProfileResponseDto` — this response
 * leaves the process entirely and carries stage `detail` bodies, so it is built
 * field by field from a *narrower* starting point than the public page.
 *
 * Never present, by construction rather than by redaction:
 * - `aiSettings` — including `apiKey`. The worker runs its own inference; a
 *   per-profile provider key would be a secret shipped over the wire for a
 *   consumer that has no code to use it. If BYO-key inference ever ships, that
 *   is a deliberate addition here, not an oversight to discover.
 * - `identity.resume` — url and parsed employment history.
 * - `social.email` / `social.phone` — the contact slide offers links and a
 *   calendar; an inbox and a phone number are not narration material.
 * - `id`, `userId`, `protectedPassword`, `visibility` — nothing the agent acts on.
 *
 * The sections themselves are absent too: the worker is served the derived
 * catalog only, so there is one shape to narrate rather than a section tree the
 * worker would have to re-derive structure from on every turn.
 */
export class AgentContextResponseDto {
  @ApiProperty({
    example: 'jane-doe',
    description: 'Echoed back so the worker can confirm what it resolved.',
  })
  username!: string;

  @ApiProperty({ type: AgentPersonaDto })
  persona!: AgentPersonaDto;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description:
      'The ordered slide catalog. Each slide is `{ id, template, title, payload, ' +
      'talkTrack }`; `payload` is discriminated by `template`. Navigation is the ' +
      'array order — "next" is index + 1. Capped at MAX_SLIDES (120).',
  })
  slides!: Slide[];

  static fromRecord(record: IProfileRecord): AgentContextResponseDto {
    const dto = new AgentContextResponseDto();
    dto.username = record.username;

    const persona = record.agentPersona;
    dto.persona = {
      agentName: persona.agentName,
      tone: persona.tone,
      verbosity: persona.verbosity,
      technicalDepth: persona.technicalDepth,
      speakingSpeed: persona.speakingSpeed,
      voiceId: persona.voiceId,
    };

    // The projector is itself an allowlist over the sections — see
    // `slide.projector.ts`. Nothing is filtered on the way out of it here.
    dto.slides = projectSlides(record);
    return dto;
  }
}
