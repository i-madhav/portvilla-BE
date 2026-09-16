import { ApiProperty } from '@nestjs/swagger';

import {
  AgentSpeakingSpeed,
  AgentTechnicalDepth,
  AgentTone,
  AgentVerbosity,
  ReplyLanguage,
} from '../../profile/domain/profile.interface';
import type { IProfileRecord } from '../../profile/domain/profile.interface';
import { projectSlides } from '../../profile/domain/slide.projector';
import type { Slide } from '../../profile/domain/slide';
import { resolveAgentStack } from '../../profile/domain/agent-stack/agent-stack.rules';
import type {
  ResolvedAgentStack,
  ResolvedLanguage,
  ResolvedLlm,
  ResolvedStt,
  ResolvedTts,
  ResolvedTurnTaking,
} from '../../profile/domain/agent-stack/agent-stack.rules';

/**
 * How the agent should speak — the prompt-shaping fields. Every one is a
 * rendering instruction, none is a secret. What the agent *runs on* is
 * `AgentStackDto` below.
 */
export class AgentPersonaDto {
  @ApiProperty({ example: 'Alex' }) agentName!: string;
  @ApiProperty({ enum: AgentTone }) tone!: AgentTone;
  @ApiProperty({ enum: AgentVerbosity }) verbosity!: AgentVerbosity;
  @ApiProperty({ enum: AgentTechnicalDepth })
  technicalDepth!: AgentTechnicalDepth;
}

class AgentStackLanguageWireDto implements ResolvedLanguage {
  @ApiProperty({ example: 'en' }) primary!: string;
  @ApiProperty({ example: 'English' }) label!: string;
  @ApiProperty({ enum: ReplyLanguage }) reply!: ReplyLanguage;
}

class AgentStackSttWireDto implements ResolvedStt {
  @ApiProperty({ example: 'deepgram/nova-3' }) model!: string;
  @ApiProperty({
    example: 'multi',
    description: 'A language code, or `multi`.',
  })
  language!: string;
  @ApiProperty({ type: [String] }) keyterms!: string[];
}

class AgentStackLlmWireDto implements ResolvedLlm {
  @ApiProperty({ example: 'openai/gpt-4o-mini' }) model!: string;
}

class AgentStackTtsWireDto implements ResolvedTts {
  @ApiProperty({ example: 'cartesia/sonic-3' }) model!: string;
  @ApiProperty({ example: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc' })
  voice!: string;
  @ApiProperty({ nullable: true, example: 'en' }) language!: string | null;
  @ApiProperty({ enum: AgentSpeakingSpeed, nullable: true })
  speed!: AgentSpeakingSpeed | null;
}

class AgentStackTurnTakingWireDto implements ResolvedTurnTaking {
  @ApiProperty({ enum: ['model', 'stt'] }) detection!: 'model' | 'stt';
  @ApiProperty() allowInterruptions!: boolean;
  @ApiProperty({ example: 0.5 }) minEndpointingDelay!: number;
  @ApiProperty({ example: 3.0 }) maxEndpointingDelay!: number;
}

/**
 * The pipeline the worker builds, already resolved: concrete LiveKit Inference
 * ids, the STT language (`multi` or a code), the TTS language (pinned, or null
 * so the voice follows the reply), the derived keyterm list, and the
 * turn-taking numbers for the owner's patience level. The worker applies no
 * policy of its own — see `agent-stack.rules.ts`.
 */
export class AgentStackDto implements ResolvedAgentStack {
  @ApiProperty({ type: AgentStackLanguageWireDto })
  language!: AgentStackLanguageWireDto;
  @ApiProperty({ type: AgentStackSttWireDto }) stt!: AgentStackSttWireDto;
  @ApiProperty({ type: AgentStackLlmWireDto }) llm!: AgentStackLlmWireDto;
  @ApiProperty({ type: AgentStackTtsWireDto }) tts!: AgentStackTtsWireDto;
  @ApiProperty({ type: AgentStackTurnTakingWireDto })
  turnTaking!: AgentStackTurnTakingWireDto;
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

  @ApiProperty({ type: AgentStackDto })
  stack!: AgentStackDto;

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
    };

    // Work names feed STT keyterms: they are the words a visitor is most likely
    // to say and a transcriber most likely to mangle.
    dto.stack = resolveAgentStack(record.agentStack, {
      ownerName: record.identity.name,
      agentName: persona.agentName,
      workNames: record.works.map((w) => w.name),
    });

    // The projector is itself an allowlist over the sections — see
    // `slide.projector.ts`. Nothing is filtered on the way out of it here.
    dto.slides = projectSlides(record);
    return dto;
  }
}
