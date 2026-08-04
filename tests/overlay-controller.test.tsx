import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OVERLAY_HOST_ID, OverlayController } from '../features/overlay/overlay-controller';
import type { PointAnnotationGateway, TextAnnotationGateway } from '../types/messages';

function createPointGateway(
  overrides: Partial<PointAnnotationGateway> = {},
): PointAnnotationGateway {
  return {
    getByPage: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    move: vi.fn(),
    delete: vi.fn().mockResolvedValue(true),
    getSettings: vi.fn().mockResolvedValue({ defaultAuthor: '', defaultColor: 'yellow' }),
    updateSettings: vi.fn().mockResolvedValue({ defaultAuthor: '', defaultColor: 'yellow' }),
    ...overrides,
  };
}

function createTextGateway(overrides: Partial<TextAnnotationGateway> = {}): TextAnnotationGateway {
  return {
    getByPage: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('OverlayController', () => {
  let controller: OverlayController | null = null;

  beforeEach(() => {
    window.history.replaceState({}, '', '/articles/first');
  });

  afterEach(() => {
    act(() => controller?.deactivate());
    controller = null;
    document.getElementById(OVERLAY_HOST_ID)?.remove();
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('Shadow DOM 호스트를 한 번만 만들고 현재 페이지 메모 수를 표시한다', async () => {
    const loadAnnotationCount = vi.fn().mockResolvedValue(3);
    controller = new OverlayController({
      styles: '',
      loadAnnotationCount,
      pointGateway: createPointGateway(),
    });

    await act(async () => {
      controller?.activate();
      controller?.activate();
      await Promise.resolve();
    });

    const hosts = document.querySelectorAll(`#${OVERLAY_HOST_ID}`);
    expect(hosts).toHaveLength(1);
    expect(hosts[0]?.shadowRoot).not.toBeNull();
    expect(hosts[0]?.shadowRoot?.textContent).toContain('현재 페이지 메모 3개');
    expect(loadAnnotationCount).toHaveBeenCalledOnce();
  });

  it('도구 선택 상태를 전환하고 ESC 키로 UI와 모드 이벤트를 정리한다', async () => {
    controller = new OverlayController({
      styles: '',
      loadAnnotationCount: vi.fn().mockResolvedValue(0),
      pointGateway: createPointGateway(),
    });

    await act(async () => {
      controller?.activate();
      await Promise.resolve();
    });

    const shadowRoot = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    const textTool = shadowRoot?.querySelector<HTMLButtonElement>(
      'button[aria-label="텍스트 메모"]',
    );

    act(() => textTool?.click());
    expect(controller.getState().selectedTool).toBe('text');
    expect(textTool).toHaveAttribute('aria-pressed', 'true');

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(controller.getState().isActive).toBe(false);
    expect(document.getElementById(OVERLAY_HOST_ID)).toBeNull();

    act(() => window.history.pushState({}, '', '/articles/after-exit'));
    expect(controller.getState().url).toContain('/articles/first');
  });

  it('SPA URL 변경 시 도구 선택과 현재 페이지 메모 수를 갱신한다', async () => {
    const loadAnnotationCount = vi
      .fn<(url: string) => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(5);
    controller = new OverlayController({
      styles: '',
      loadAnnotationCount,
      pointGateway: createPointGateway(),
    });

    await act(async () => {
      controller?.activate();
      await Promise.resolve();
    });

    const textTool = document
      .getElementById(OVERLAY_HOST_ID)
      ?.shadowRoot?.querySelector<HTMLButtonElement>('button[aria-label="텍스트 메모"]');
    act(() => textTool?.click());

    await act(async () => {
      window.history.pushState({}, '', '/articles/second');
      await Promise.resolve();
    });

    expect(controller.getState()).toMatchObject({
      selectedTool: null,
      annotationCount: 5,
    });
    expect(controller.getState().url).toContain('/articles/second');
    expect(loadAnnotationCount).toHaveBeenCalledTimes(2);
  });

  it('저장된 위치 메모를 복원하고 삭제 직후 마커를 제거한다', async () => {
    const annotation = {
      id: 'point-1',
      pageKey: 'page-1',
      originalUrl: window.location.href,
      pageTitle: '문서',
      type: 'point' as const,
      content: '검토 메모',
      author: '연구원',
      color: 'yellow' as const,
      status: 'open' as const,
      position: { xRatio: 0.25, yRatio: 0.5 },
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
    };
    const pointGateway = createPointGateway({
      getByPage: vi.fn().mockResolvedValue([annotation]),
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    controller = new OverlayController({
      styles: '',
      loadAnnotationCount: vi.fn().mockResolvedValue(1),
      pointGateway,
    });

    await act(async () => {
      controller?.activate();
      await Promise.resolve();
    });

    const shadowRoot = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    const marker = shadowRoot?.querySelector<HTMLButtonElement>('[data-annotation-id="point-1"]');
    expect(marker).not.toBeNull();

    act(() => marker?.click());
    const deleteButton = Array.from(shadowRoot?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent === '삭제',
    );
    await act(async () => {
      deleteButton?.click();
      await Promise.resolve();
    });

    expect(pointGateway.delete).toHaveBeenCalledWith('point-1');
    expect(shadowRoot?.querySelector('[data-annotation-id="point-1"]')).toBeNull();
  });

  it('패널에서 해결 상태를 바꾸면 웹페이지 마커에 즉시 반영한다', async () => {
    const annotation = {
      id: 'point-sync',
      pageKey: 'page-1',
      originalUrl: window.location.href,
      pageTitle: '문서',
      type: 'point' as const,
      content: '동기화할 메모',
      author: '연구원',
      color: 'blue' as const,
      status: 'open' as const,
      position: { xRatio: 0.25, yRatio: 0.5 },
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
    };
    const pointGateway = createPointGateway({
      getByPage: vi.fn().mockResolvedValue([annotation]),
      update: vi.fn().mockImplementation(async (_id, changes) => ({
        ...annotation,
        ...changes,
        updatedAt: '2026-08-04T00:01:00.000Z',
      })),
    });
    controller = new OverlayController({
      styles: '',
      loadAnnotationCount: vi.fn().mockResolvedValue(1),
      pointGateway,
    });

    await act(async () => {
      controller?.activate();
      await Promise.resolve();
    });
    const shadowRoot = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    act(() =>
      shadowRoot?.querySelector<HTMLButtonElement>('button[aria-label="메모 목록"]')?.click(),
    );
    const resolveButton = Array.from(shadowRoot?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent === '해결됨으로 표시',
    );
    await act(async () => {
      resolveButton?.click();
      await Promise.resolve();
    });

    expect(pointGateway.update).toHaveBeenCalledWith('point-sync', { status: 'resolved' });
    expect(shadowRoot?.querySelector('[data-annotation-id="point-sync"]')).toHaveClass(
      'is-resolved',
    );
  });

  it('복원 실패 텍스트 메모를 미배치로 표시하고 동적 렌더링 후 다시 배치한다', async () => {
    vi.useFakeTimers();
    const annotation = {
      id: 'text-1',
      pageKey: 'page-1',
      originalUrl: window.location.href,
      pageTitle: '문서',
      type: 'text' as const,
      content: '동적 영역 검토',
      author: '',
      color: 'yellow' as const,
      status: 'open' as const,
      anchor: {
        exactText: '늦게 렌더링된 문장',
        prefixText: '',
        suffixText: '',
        cssSelector: '#dynamic-content',
        startOffset: 0,
        endOffset: 10,
      },
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
    };
    controller = new OverlayController({
      styles: '',
      loadAnnotationCount: vi.fn().mockResolvedValue(1),
      pointGateway: createPointGateway(),
      textGateway: createTextGateway({ getByPage: vi.fn().mockResolvedValue([annotation]) }),
    });

    await act(async () => {
      controller?.activate();
      await Promise.resolve();
    });
    const shadowRoot = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    const listButton = shadowRoot?.querySelector<HTMLButtonElement>(
      'button[aria-label="메모 목록"]',
    );
    act(() => listButton?.click());
    expect(shadowRoot?.textContent).toContain('미배치 · 원문 위치를 찾지 못함');

    await act(async () => {
      const dynamic = document.createElement('p');
      dynamic.id = 'dynamic-content';
      dynamic.textContent = '늦게 렌더링된 문장';
      document.body.append(dynamic);
      await Promise.resolve();
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(shadowRoot?.textContent).toContain('배치됨');
    expect(shadowRoot?.textContent).not.toContain('미배치 · 원문 위치를 찾지 못함');
  });
});
