import { describe, expect, it } from 'vitest';

import {
  calculateAreaPosition,
  normalizeDocumentArea,
  restoreViewportArea,
} from '../services/area-position-service';

describe('area-position-service', () => {
  it('역방향 드래그도 좌상단 기준의 비율 영역으로 정규화한다', () => {
    expect(calculateAreaPosition(600, 1_500, 200, 500, { width: 1_000, height: 2_000 })).toEqual({
      xRatio: 0.2,
      yRatio: 0.25,
      widthRatio: 0.4,
      heightRatio: 0.5,
    });
  });

  it('문서 바깥의 드래그 끝점을 문서 크기로 제한한다', () => {
    expect(
      normalizeDocumentArea(900, 1_900, 1_200, 2_400, { width: 1_000, height: 2_000 }),
    ).toEqual({
      left: 900,
      top: 1_900,
      width: 100,
      height: 100,
    });
  });

  it('문서 크기와 스크롤 변화에 맞춰 같은 비율을 화면 영역으로 복원한다', () => {
    const position = { xRatio: 0.25, yRatio: 0.5, widthRatio: 0.5, heightRatio: 0.25 };

    expect(restoreViewportArea(position, { width: 2_000, height: 4_000 }, 100, 1_200)).toEqual({
      left: 400,
      top: 800,
      width: 1_000,
      height: 1_000,
    });
  });
});
