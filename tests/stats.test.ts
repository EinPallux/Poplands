import { describe, it, expect } from 'vitest';
import { formatDuration } from '@/ui/StatsPanel';

describe('formatDuration', () => {
  it('shows seconds for a brand-new island', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(4200)).toBe('4s');
  });

  it('shows minutes under an hour', () => {
    expect(formatDuration(60_000)).toBe('1m');
    expect(formatDuration(45 * 60_000)).toBe('45m');
  });

  it('shows hours + minutes past an hour', () => {
    expect(formatDuration(60 * 60_000)).toBe('1h 0m');
    expect(formatDuration((2 * 60 + 34) * 60_000)).toBe('2h 34m');
  });

  it('never shows a negative duration', () => {
    expect(formatDuration(-500)).toBe('0s');
  });
});
