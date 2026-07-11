import { describe, it, expect } from 'vitest';
import { seasonForMonth, resolveSeason, SEASON_ORDER, seasonDef } from '@/content/seasons';

describe('seasonForMonth (northern hemisphere)', () => {
  it('maps each month to the right season', () => {
    expect(seasonForMonth(11)).toBe('winter'); // Dec
    expect(seasonForMonth(0)).toBe('winter'); // Jan
    expect(seasonForMonth(1)).toBe('winter'); // Feb
    expect(seasonForMonth(2)).toBe('spring'); // Mar
    expect(seasonForMonth(4)).toBe('spring'); // May
    expect(seasonForMonth(5)).toBe('summer'); // Jun
    expect(seasonForMonth(7)).toBe('summer'); // Aug
    expect(seasonForMonth(8)).toBe('autumn'); // Sep
    expect(seasonForMonth(10)).toBe('autumn'); // Nov
  });
  it('covers all 12 months with a valid season', () => {
    for (let m = 0; m < 12; m++) expect(SEASON_ORDER).toContain(seasonForMonth(m));
  });
});

describe('resolveSeason', () => {
  it('auto follows the month; a pinned season overrides it', () => {
    expect(resolveSeason('auto', 6)).toBe('summer');
    expect(resolveSeason('winter', 6)).toBe('winter'); // pin wins over the month
    expect(resolveSeason('spring', 0)).toBe('spring');
  });
});

describe('SEASONS data', () => {
  it('every season carries light+sky tints and a falling-ambient kind', () => {
    for (const s of SEASON_ORDER) {
      const d = seasonDef(s);
      expect(d.light).toHaveLength(3);
      expect(d.sky).toHaveLength(3);
      expect(d.lightMul).toBeGreaterThan(0);
      expect(['petals', 'motes', 'leaves', 'snow']).toContain(d.ambient);
    }
  });
});
