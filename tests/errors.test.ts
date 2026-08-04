import { describe, expect, it } from 'vitest';

import { toKoreanErrorMessage } from '../utils/errors';

describe('toKoreanErrorMessage', () => {
  it('Error의 메시지를 유지한다', () => {
    expect(toKoreanErrorMessage(new Error('페이지 정보를 읽을 수 없습니다.'))).toBe(
      '페이지 정보를 읽을 수 없습니다.',
    );
  });

  it('알 수 없는 오류는 한국어 기본 메시지로 변환한다', () => {
    expect(toKoreanErrorMessage({ reason: 'unknown' })).toBe(
      '알 수 없는 오류가 발생했습니다. 확장 프로그램을 다시 시도해 주세요.',
    );
  });
});
