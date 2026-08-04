import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OVERLAY_HOST_ID, OverlayController } from '../features/overlay/overlay-controller';

describe('OverlayController', () => {
  let controller: OverlayController | null = null;

  beforeEach(() => {
    window.history.replaceState({}, '', '/articles/first');
  });

  afterEach(() => {
    act(() => controller?.deactivate());
    controller = null;
    document.getElementById(OVERLAY_HOST_ID)?.remove();
  });

  it('Shadow DOM 호스트를 한 번만 만들고 현재 페이지 메모 수를 표시한다', async () => {
    const loadAnnotationCount = vi.fn().mockResolvedValue(3);
    controller = new OverlayController({ styles: '', loadAnnotationCount });

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
    controller = new OverlayController({ styles: '', loadAnnotationCount });

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
});
