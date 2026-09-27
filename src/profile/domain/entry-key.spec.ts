import { ENTRY_KEY_REGEX, withWorkChildKeys } from './entry-key';
import { WorkType, type WorkEntryInput } from './profile.interface';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function aWorkInput(overrides: Partial<WorkEntryInput> = {}): WorkEntryInput {
  return {
    type: WorkType.PROJECT,
    name: 'PortVilla',
    tagline: null,
    description: '',
    url: null,
    repoUrl: null,
    coverImage: null,
    screenshots: [],
    technologies: [],
    tags: [],
    status: 'completed',
    highlights: [],
    featured: false,
    codeSnippets: [],
    date: '2024-01',
    stages: [],
    ...overrides,
  };
}

const stage = (key?: string) => ({
  key,
  label: 'GA',
  status: 'completed' as const,
  summary: 'Shipped.',
  detail: null,
  date: null,
  endDate: null,
  highlights: [],
});

const hotspot = (key?: string) => ({
  key,
  label: 'Export button',
  note: 'Exports the board as a CSV.',
  x: 80,
  y: 4,
  w: 12,
  h: 6,
});

const screenshot = (key?: string, hotspots = [hotspot()]) => ({
  key,
  url: 'https://example.com/board.png',
  caption: null,
  hotspots,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('withWorkChildKeys', () => {
  it('mints a key for every new screenshot and every new hotspot', () => {
    const work = withWorkChildKeys(
      aWorkInput({ screenshots: [screenshot(), screenshot()] }),
    );

    for (const shot of work.screenshots) {
      expect(shot.key).toMatch(ENTRY_KEY_REGEX);
      expect(shot.hotspots[0].key).toMatch(ENTRY_KEY_REGEX);
    }
    expect(work.screenshots[0].key).not.toBe(work.screenshots[1].key);
  });

  it('keeps the keys a client round-tripped', () => {
    const work = withWorkChildKeys(
      aWorkInput({
        screenshots: [screenshot('shot0001', [hotspot('hot00001')])],
        stages: [stage('stage001')],
      }),
    );

    expect(work.screenshots[0].key).toBe('shot0001');
    expect(work.screenshots[0].hotspots[0].key).toBe('hot00001');
    expect(work.stages[0].key).toBe('stage001');
  });

  it('re-keys a duplicate rather than letting two targets share a name', () => {
    const work = withWorkChildKeys(
      aWorkInput({
        screenshots: [
          screenshot('shot0001', [hotspot('hot00001'), hotspot('hot00001')]),
          screenshot('shot0001'),
        ],
      }),
    );

    const [first, second] = work.screenshots;
    expect(first.key).toBe('shot0001');
    expect(second.key).not.toBe('shot0001');
    expect(first.hotspots[0].key).toBe('hot00001');
    expect(first.hotspots[1].key).not.toBe('hot00001');
  });

  it('keys hotspots per screenshot, so two screenshots may reuse one', () => {
    // A focus key is `shotKey.hotspotKey`, so uniqueness is only needed within
    // a screenshot.
    const work = withWorkChildKeys(
      aWorkInput({
        screenshots: [
          screenshot('shot0001', [hotspot('hot00001')]),
          screenshot('shot0002', [hotspot('hot00001')]),
        ],
      }),
    );

    expect(work.screenshots.map((s) => s.hotspots[0].key)).toEqual([
      'hot00001',
      'hot00001',
    ]);
  });

  it('replaces a malformed key, including one with the focus separator', () => {
    const work = withWorkChildKeys(
      aWorkInput({ screenshots: [screenshot('shot.001', [hotspot('HOT!')])] }),
    );

    expect(work.screenshots[0].key).toMatch(ENTRY_KEY_REGEX);
    expect(work.screenshots[0].hotspots[0].key).toMatch(ENTRY_KEY_REGEX);
  });

  it('keys a legacy screenshot saved with neither a key nor hotspots', () => {
    const legacy = {
      url: 'https://example.com/old.png',
      caption: 'Old',
    } as WorkEntryInput['screenshots'][number];

    const [shot] = withWorkChildKeys(
      aWorkInput({ screenshots: [legacy] }),
    ).screenshots;

    expect(shot.key).toMatch(ENTRY_KEY_REGEX);
    expect(shot.hotspots).toEqual([]);
  });

  it('does not mutate the work it was given', () => {
    const input = aWorkInput({ screenshots: [screenshot()] });
    const before = JSON.stringify(input);

    withWorkChildKeys(input);

    expect(JSON.stringify(input)).toBe(before);
  });
});
