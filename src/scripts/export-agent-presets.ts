import { PRESETS } from '../profile/domain/agent-stack/catalog';

/**
 * Prints the agent-stack presets *with* their voice descriptors as JSON, for
 * the preview renderer in `portvilla-agent/scripts/render_preset_previews.py`.
 *
 * This is the only path by which the hidden engine details leave the backend,
 * and it goes to a developer's disk, never to a client.
 *
 *   pnpm build && pnpm presets:export > /tmp/presets.json
 *
 * Pure: no Nest, no database, so it runs anywhere the build does.
 */
const rows = PRESETS.map((p) => ({
  id: p.id,
  label: p.label,
  language: p.stack.language.primary,
  voice: p.stack.tts.voice,
  speed: p.stack.tts.speed,
}));

process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
