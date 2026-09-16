import {
  DEFAULT_MONTHLY_MINUTES_PER_PROFILE,
  MINUTE_BUDGET_EXHAUSTED,
  isBudgetExhausted,
  minuteBudgetExhaustedBody,
  minutesUsed,
  monthStartUtc,
  nextMonthStartUtc,
  parseMonthlyMinuteBudget,
} from './minute-budget';

describe('parseMonthlyMinuteBudget', () => {
  it('falls back to the default when unset or blank', () => {
    expect(parseMonthlyMinuteBudget(undefined)).toBe(
      DEFAULT_MONTHLY_MINUTES_PER_PROFILE,
    );
    expect(parseMonthlyMinuteBudget('')).toBe(
      DEFAULT_MONTHLY_MINUTES_PER_PROFILE,
    );
    expect(parseMonthlyMinuteBudget('   ')).toBe(
      DEFAULT_MONTHLY_MINUTES_PER_PROFILE,
    );
  });

  it('treats 0 as unlimited', () => {
    expect(parseMonthlyMinuteBudget('0')).toBeNull();
  });

  it('accepts a positive integer, tolerating whitespace', () => {
    expect(parseMonthlyMinuteBudget(' 300 ')).toBe(300);
  });

  it('refuses anything that is not a non-negative integer', () => {
    for (const bad of ['abc', '-5', '1.5', '10m']) {
      expect(() => parseMonthlyMinuteBudget(bad)).toThrow(
        /MONTHLY_MINUTES_PER_PROFILE/,
      );
    }
  });
});

describe('month window (UTC)', () => {
  it('starts at the first of the current month', () => {
    const now = new Date('2026-09-13T18:45:00.000Z');
    expect(monthStartUtc(now).toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(nextMonthStartUtc(now).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });

  it('rolls the year over in December', () => {
    const now = new Date('2026-12-31T23:59:59.000Z');
    expect(nextMonthStartUtc(now).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('is not fooled by local time near the boundary', () => {
    // 2026-09-30 23:30 UTC is already October in UTC+1; the budget must not be.
    const now = new Date('2026-09-30T23:30:00.000Z');
    expect(monthStartUtc(now).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('minutesUsed', () => {
  it('rounds partial minutes up', () => {
    expect(minutesUsed(0)).toBe(0);
    expect(minutesUsed(1)).toBe(1);
    expect(minutesUsed(60)).toBe(1);
    expect(minutesUsed(61)).toBe(2);
  });

  it('never goes negative on a clock skew', () => {
    expect(minutesUsed(-30)).toBe(0);
  });
});

describe('isBudgetExhausted', () => {
  it('is never exhausted when unlimited', () => {
    expect(isBudgetExhausted(1_000_000, null)).toBe(false);
  });

  it('exhausts at the budget, not one minute over', () => {
    expect(isBudgetExhausted(119 * 60, 120)).toBe(false);
    expect(isBudgetExhausted(119 * 60 + 1, 120)).toBe(true); // rounds up to 120
    expect(isBudgetExhausted(120 * 60, 120)).toBe(true);
  });
});

describe('minuteBudgetExhaustedBody', () => {
  it('carries the stable code and the refill time', () => {
    const body = minuteBudgetExhaustedBody(
      new Date('2026-09-13T10:00:00.000Z'),
    );
    expect(body.statusCode).toBe(429);
    expect(body.code).toBe(MINUTE_BUDGET_EXHAUSTED);
    expect(body.resetsAt).toBe('2026-10-01T00:00:00.000Z');
    expect(body.message).toMatch(/conversation time/);
  });
});
