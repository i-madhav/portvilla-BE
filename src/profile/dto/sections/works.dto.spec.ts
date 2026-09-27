import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';

import { HotspotDto, ScreenshotDto } from './works.dto';

/**
 * The hotspot rules, run the way the global `ValidationPipe` runs them:
 * transform first (so `label` is trimmed), then validate.
 */

const aHotspot = (overrides: Record<string, unknown> = {}) => ({
  label: 'Export button',
  note: 'Exports the board as a CSV.',
  x: 80,
  y: 4,
  w: 12,
  h: 6,
  ...overrides,
});

const aScreenshot = (overrides: Record<string, unknown> = {}) => ({
  url: 'https://example.com/board.png',
  ...overrides,
});

/** Property paths that failed, e.g. `w` or `hotspots.0.label`. */
function failures(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((e) => {
    const path = `${prefix}${e.property}`;
    return e.children?.length
      ? failures(e.children, `${path}.`)
      : e.constraints
        ? [path]
        : [];
  });
}

const hotspotFailures = (plain: object) =>
  failures(validateSync(plainToInstance(HotspotDto, plain)));

const screenshotFailures = (plain: object) =>
  failures(validateSync(plainToInstance(ScreenshotDto, plain)));

describe('HotspotDto', () => {
  it('accepts a region inside the image, flush with its edges', () => {
    expect(hotspotFailures(aHotspot())).toEqual([]);
    expect(hotspotFailures(aHotspot({ x: 0, y: 0, w: 100, h: 100 }))).toEqual(
      [],
    );
    // Floating-point percentages that sum to 100 are not "over" it.
    expect(hotspotFailures(aHotspot({ x: 33.3, w: 66.7 }))).toEqual([]);
  });

  it('rejects a region that runs off the right or bottom edge', () => {
    expect(hotspotFailures(aHotspot({ x: 90, w: 11 }))).toEqual(['w']);
    expect(hotspotFailures(aHotspot({ y: 95, h: 6 }))).toEqual(['h']);
  });

  it('rejects coordinates outside 0–100 and a region with no area', () => {
    expect(hotspotFailures(aHotspot({ x: -1 }))).toEqual(['x']);
    expect(hotspotFailures(aHotspot({ y: 101 }))).toContain('y');
    expect(hotspotFailures(aHotspot({ w: 0 }))).toEqual(['w']);
    expect(hotspotFailures(aHotspot({ h: -5 }))).toEqual(['h']);
  });

  it('holds a label to 40 characters, after trimming', () => {
    expect(hotspotFailures(aHotspot({ label: 'x'.repeat(41) }))).toEqual([
      'label',
    ]);
    expect(
      hotspotFailures(aHotspot({ label: `  ${'x'.repeat(40)}  ` })),
    ).toEqual([]);
    expect(hotspotFailures(aHotspot({ label: '   ' }))).toEqual(['label']);
  });

  it('trims the label it keeps', () => {
    const dto = plainToInstance(HotspotDto, aHotspot({ label: ' Export ' }));
    expect(dto.label).toBe('Export');
  });

  it('requires a note of at most 280 characters', () => {
    expect(hotspotFailures(aHotspot({ note: undefined }))).toEqual(['note']);
    expect(hotspotFailures(aHotspot({ note: 'x'.repeat(281) }))).toEqual([
      'note',
    ]);
    expect(hotspotFailures(aHotspot({ note: 'x'.repeat(280) }))).toEqual([]);
  });

  it('takes a round-tripped key and refuses one it could not have minted', () => {
    expect(hotspotFailures(aHotspot({ key: 'hot00001' }))).toEqual([]);
    expect(hotspotFailures(aHotspot({ key: 'hot.0001' }))).toEqual(['key']);
  });
});

describe('ScreenshotDto', () => {
  it('needs neither a key nor hotspots', () => {
    expect(screenshotFailures(aScreenshot())).toEqual([]);
  });

  it('allows eight hotspots and rejects a ninth', () => {
    const hotspots = (n: number) => Array.from({ length: n }, () => aHotspot());

    expect(screenshotFailures(aScreenshot({ hotspots: hotspots(8) }))).toEqual(
      [],
    );
    expect(screenshotFailures(aScreenshot({ hotspots: hotspots(9) }))).toEqual([
      'hotspots',
    ]);
  });

  it('validates each hotspot it carries', () => {
    expect(
      screenshotFailures(
        aScreenshot({ hotspots: [aHotspot(), aHotspot({ x: 95, w: 10 })] }),
      ),
    ).toEqual(['hotspots.1.w']);
  });
});
