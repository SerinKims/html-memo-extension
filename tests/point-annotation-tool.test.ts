import { afterEach, describe, expect, it, vi } from 'vitest';

import { PointAnnotationTool } from '../features/point/PointAnnotationTool';

const HOST_ID = 'test-extension-host';

function setDocumentSize(width: number, height: number): void {
  Object.defineProperties(document.documentElement, {
    scrollWidth: { configurable: true, value: width },
    clientWidth: { configurable: true, value: width },
    scrollHeight: { configurable: true, value: height },
    clientHeight: { configurable: true, value: height },
  });
}

describe('PointAnnotationTool', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('활성화를 중복 호출해도 한 번의 클릭으로 메모를 한 개만 만든다', () => {
    setDocumentSize(1_000, 2_000);
    const onSelect = vi.fn();
    const tool = new PointAnnotationTool({ extensionHostId: HOST_ID, onSelect });
    const target = document.createElement('div');
    document.body.append(target);

    tool.activate();
    tool.activate();
    target.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 250, clientY: 500 }),
    );

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ position: { xRatio: 0.25, yRatio: 0.25 } }),
    );
    tool.deactivate();
  });

  it('확장 프로그램 UI 클릭은 무시한다', () => {
    const onSelect = vi.fn();
    const tool = new PointAnnotationTool({ extensionHostId: HOST_ID, onSelect });
    const host = document.createElement('div');
    host.id = HOST_ID;
    const button = document.createElement('button');
    host.append(button);
    document.body.append(host);

    tool.activate();
    button.click();

    expect(onSelect).not.toHaveBeenCalled();
    tool.deactivate();
  });

  it('링크와 입력 요소는 사용자가 확인하지 않으면 메모를 만들지 않는다', () => {
    const onSelect = vi.fn();
    const confirmInteractiveClick = vi.fn().mockReturnValue(false);
    const tool = new PointAnnotationTool({
      extensionHostId: HOST_ID,
      onSelect,
      confirmInteractiveClick,
    });
    const link = document.createElement('a');
    link.href = '#next';
    document.body.append(link);

    tool.activate();
    link.click();

    expect(confirmInteractiveClick).toHaveBeenCalledWith(link);
    expect(onSelect).not.toHaveBeenCalled();
    tool.deactivate();
  });
});
