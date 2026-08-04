import { describe, expect, it } from 'vitest';

import { getStorageUsageLevel } from '../storage/storage-schema';

describe('getStorageUsageLevel', () => {
  it.each([
    [0.59, 'normal'],
    [0.6, 'warning'],
    [0.799, 'warning'],
    [0.8, 'cleanupRecommended'],
    [0.949, 'cleanupRecommended'],
    [0.95, 'critical'],
  ] as const)('%d 비율을 %s 단계로 분류한다', (ratio, expected) => {
    expect(getStorageUsageLevel(ratio)).toBe(expected);
  });
});
