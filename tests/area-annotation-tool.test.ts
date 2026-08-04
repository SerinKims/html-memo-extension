import { afterEach, describe, expect, it, vi } from 'vitest';

import { AreaAnnotationTool } from '../features/area/AreaAnnotationTool';

const HOST_ID = 'test-extension-host';

function setDocumentSize(width: number, height: number): void {
  Object.defineProperties(document.documentElement, {
    scrollWidth: { configurable: true, value: width },
    clientWidth: { configurable: true, value: width },
    scrollHeight: { configurable: true, value: height },
    clientHeight: { configurable: true, value: height },
  });
}

function setScroll(x: number, y: number): void {
  Object.defineProperties(window, {
    scrollX: { configurable: true, value: x },
    scrollY: { configurable: true, value: y },
  });
}

describe('AreaAnnotationTool', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.style.removeProperty('user-select');
    document.documentElement.style.removeProperty('-webkit-user-select');
    setScroll(0, 0);
  });

  it('스크롤이 바뀌는 드래그를 현재 문서 좌표 기준의 비율로 저장한다', () => {
    setDocumentSize(1_000, 4_000);
    setScroll(0, 1_000);
    const onSelect = vi.fn();
    const onPreview = vi.fn();
    const target = document.createElement('div');
    document.body.append(target);
    const tool = new AreaAnnotationTool({
      extensionHostId: HOST_ID,
      onPreview,
      onSelect,
    });
    tool.activate();

    target.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 100,
        clientY: 200,
      }),
    );
    setScroll(0, 1_200);
    window.dispatchEvent(new Event('scroll'));
    target.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 300,
        clientY: 400,
      }),
    );

    expect(onSelect).toHaveBeenCalledWith({
      position: { xRatio: 0.1, yRatio: 0.3, widthRatio: 0.2, heightRatio: 0.1 },
      clientX: 300,
      clientY: 400,
    });
    expect(onPreview).toHaveBeenLastCalledWith(null);
    tool.deactivate();
  });

  it('최소 크기보다 작은 영역은 저장하지 않는다', () => {
    setDocumentSize(1_000, 2_000);
    const onSelect = vi.fn();
    const onInvalidSelection = vi.fn();
    const tool = new AreaAnnotationTool({
      extensionHostId: HOST_ID,
      onSelect,
      onInvalidSelection,
    });
    tool.activate();

    document.body.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 10,
        clientY: 10,
      }),
    );
    document.body.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 20,
        clientY: 30,
      }),
    );

    expect(onSelect).not.toHaveBeenCalled();
    expect(onInvalidSelection).toHaveBeenCalledOnce();
    tool.deactivate();
  });

  it('ESC로 취소하고 드래그 전에 설정된 텍스트 선택 스타일을 복구한다', () => {
    setDocumentSize(1_000, 2_000);
    document.documentElement.style.setProperty('user-select', 'text', 'important');
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const tool = new AreaAnnotationTool({ extensionHostId: HOST_ID, onSelect, onCancel });
    tool.activate();

    document.body.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 10,
        clientY: 10,
      }),
    );
    expect(document.documentElement.style.getPropertyValue('user-select')).toBe('none');
    document.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }),
    );

    expect(tool.selecting).toBe(false);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('user-select')).toBe('text');
    expect(document.documentElement.style.getPropertyPriority('user-select')).toBe('important');
    tool.deactivate();
  });

  it('확장 프로그램 오버레이에서 시작한 드래그는 무시한다', () => {
    const host = document.createElement('div');
    host.id = HOST_ID;
    const button = document.createElement('button');
    host.append(button);
    document.body.append(host);
    const onSelect = vi.fn();
    const onPreview = vi.fn();
    const tool = new AreaAnnotationTool({ extensionHostId: HOST_ID, onSelect, onPreview });
    tool.activate();

    button.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 10,
        clientY: 10,
      }),
    );

    expect(tool.selecting).toBe(false);
    expect(onPreview).not.toHaveBeenCalled();
    tool.deactivate();
  });
});
