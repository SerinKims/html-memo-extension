import { describe, expect, it } from 'vitest';

import {
  calculatePointPosition,
  restoreDocumentPoint,
  restoreViewportPoint,
} from '../services/annotation-position-service';

describe('annotation-position-service', () => {
  it('문서 좌표를 전체 문서 크기 기준 비율로 계산한다', () => {
    expect(calculatePointPosition(500, 750, { width: 2_000, height: 3_000 })).toEqual({
      xRatio: 0.25,
      yRatio: 0.25,
    });
  });

  it('비율 좌표를 문서 좌표와 현재 스크롤 기준 화면 좌표로 복원한다', () => {
    const position = { xRatio: 0.25, yRatio: 0.5 };
    const size = { width: 2_000, height: 4_000 };

    expect(restoreDocumentPoint(position, size)).toEqual({ left: 500, top: 2_000 });
    expect(restoreViewportPoint(position, size, 100, 1_200)).toEqual({ left: 400, top: 800 });
  });

  it('화면과 페이지 높이가 바뀌면 같은 비율로 좌표를 다시 계산한다', () => {
    const position = { xRatio: 0.5, yRatio: 0.25 };

    expect(restoreDocumentPoint(position, { width: 1_000, height: 2_000 })).toEqual({
      left: 500,
      top: 500,
    });
    expect(restoreDocumentPoint(position, { width: 1_600, height: 4_000 })).toEqual({
      left: 800,
      top: 1_000,
    });
  });
});
