import { afterEach, expect, it, vi } from 'vitest';
import { uploadDateFilter, uploadDateValue } from './upload-date';

afterEach(() => vi.unstubAllEnvs());
it('converts the selected local day to a half-open UTC range and clears both bounds', () => {
  vi.stubEnv('TZ', 'Asia/Vladivostok');
  expect(uploadDateFilter('2026-11-13')).toEqual({ uploadedFrom: '2026-11-12T14:00:00.000Z', uploadedBefore: '2026-11-13T14:00:00.000Z' });
  expect(uploadDateValue(uploadDateFilter('2026-11-13').uploadedFrom)).toBe('2026-11-13');
  expect(uploadDateFilter('')).toEqual({ uploadedFrom: undefined, uploadedBefore: undefined });
});
it('uses the next local midnight across daylight saving transitions', () => {
  vi.stubEnv('TZ', 'America/New_York');
  expect(uploadDateFilter('2026-03-08')).toEqual({ uploadedFrom: '2026-03-08T05:00:00.000Z', uploadedBefore: '2026-03-09T04:00:00.000Z' });
});
