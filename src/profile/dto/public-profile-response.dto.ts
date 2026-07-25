import { ApiProperty } from '@nestjs/swagger';

import { ProfileVisibility, EntityType } from '../domain/profile.interface';
import type {
  IProfileRecord,
  WorkEntry,
  TimelineEntry,
  CapabilityEntry,
  OfferingEntry,
  MetricEntry,
  TestimonialEntry,
  TeamMemberEntry,
  MediaEntry,
  ContentEntry,
} from '../domain/profile.interface';

/**
 * Identity as an anonymous visitor may see it. `resume` (URL + parsed text — the
 * owner's full employment history, sometimes address/phone) is intentionally
 * absent from the type, so it cannot be spread in by accident.
 */
export class PublicIdentityDto {
  @ApiProperty({ enum: EntityType }) entityType!: EntityType;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) tagline!: string | null;
  @ApiProperty({ nullable: true }) bio!: string | null;
  @ApiProperty({ nullable: true }) about!: string | null;
  @ApiProperty({ nullable: true }) primaryImage!: string | null;
  @ApiProperty({ nullable: true }) coverImage!: string | null;
  @ApiProperty({ nullable: true }) location!: string | null;
  @ApiProperty({ nullable: true }) foundedOrBorn!: string | null;
  @ApiProperty({ nullable: true }) industry!: string | null;
  @ApiProperty({ nullable: true }) availability!: string | null;
}

/** Only outward-facing contact affordances — never the owner's raw email/phone. */
export class PublicSocialDto {
  @ApiProperty() links!: {
    platform: string;
    url: string;
    label: string | null;
  }[];
  @ApiProperty({ nullable: true }) calendarUrl!: string | null;
}

/**
 * The public portfolio, built by an explicit allowlist.
 *
 * Allowlist, not "owner DTO minus secrets": a field added to the profile later
 * is omitted here by default (safe) instead of leaking until someone remembers
 * to redact it. Never present: id, userId, protectedPassword, aiSettings, the
 * resume, social.email/phone, and every agentPersona field except the name.
 */
export class PublicProfileResponseDto {
  @ApiProperty({ example: 'jane-doe' }) username!: string;
  @ApiProperty({ enum: ProfileVisibility }) visibility!: ProfileVisibility;

  @ApiProperty({ type: PublicIdentityDto }) identity!: PublicIdentityDto;
  @ApiProperty() works!: WorkEntry[];
  @ApiProperty() timeline!: TimelineEntry[];
  @ApiProperty() capabilities!: CapabilityEntry[];
  @ApiProperty() offerings!: OfferingEntry[];
  @ApiProperty() metrics!: MetricEntry[];
  @ApiProperty() testimonials!: TestimonialEntry[];
  @ApiProperty() team!: TeamMemberEntry[];
  @ApiProperty() media!: MediaEntry[];
  @ApiProperty() content!: ContentEntry[];
  @ApiProperty({ type: PublicSocialDto }) social!: PublicSocialDto;

  @ApiProperty({
    example: 'Alex',
    description: "The agent's display name — the only persona field exposed.",
  })
  agentName!: string;

  static fromRecord(record: IProfileRecord): PublicProfileResponseDto {
    const dto = new PublicProfileResponseDto();
    dto.username = record.username;
    dto.visibility = record.visibility;

    const id = record.identity;
    dto.identity = {
      entityType: id.entityType,
      name: id.name,
      tagline: id.tagline,
      bio: id.bio,
      about: id.about,
      primaryImage: id.primaryImage,
      coverImage: id.coverImage,
      location: id.location,
      foundedOrBorn: id.foundedOrBorn,
      industry: id.industry,
      availability: id.availability,
      // resume is deliberately not copied.
    };

    dto.works = record.works;
    dto.timeline = record.timeline;
    dto.capabilities = record.capabilities;
    dto.offerings = record.offerings;
    dto.metrics = record.metrics;
    dto.testimonials = record.testimonials;
    dto.team = record.team;
    dto.media = record.media;
    dto.content = record.content;

    dto.social = {
      links: record.social.links,
      calendarUrl: record.social.calendarUrl,
      // email and phone deliberately omitted.
    };

    dto.agentName = record.agentPersona.agentName;
    return dto;
  }
}
