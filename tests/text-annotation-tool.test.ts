import { afterEach, describe, expect, it, vi } from 'vitest';

import { TextAnnotationTool } from '../features/text/TextAnnotationTool';

describe('TextAnnotationTool', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
  });

  it('드래그 선택 후 앵커와 메모 버튼 위치를 전달한다', () => {
    document.body.innerHTML = '<p id="content">앞 문맥 선택 문장 뒤 문맥</p>';
    const text = document.querySelector('#content')?.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 5);
    range.setEnd(text, 10);
    Object.defineProperties(Range.prototype, {
      getClientRects: {
        configurable: true,
        value: () => [{ left: 10, right: 70, top: 20, bottom: 40, width: 60, height: 20 }],
      },
      getBoundingClientRect: {
        configurable: true,
        value: () => ({ left: 10, right: 70, top: 20, bottom: 40, width: 60, height: 20 }),
      },
    });
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const onSelect = vi.fn();
    const tool = new TextAnnotationTool({
      extensionHostId: 'extension-host',
      onSelect,
      onClear: vi.fn(),
      onInvalidSelection: vi.fn(),
    });

    tool.activate();
    document
      .querySelector('#content')
      ?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: expect.objectContaining({ exactText: '선택 문장' }),
        clientX: 78,
        clientY: 48,
      }),
    );
    tool.deactivate();
  });

  it('입력 요소 선택은 오류로 처리하고 확장 UI 이벤트는 무시한다', () => {
    document.body.innerHTML =
      '<textarea>편집 텍스트</textarea><div id="extension-host"><button>UI</button></div>';
    const text = document.querySelector('textarea')?.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 2);
    window.getSelection()?.addRange(range);
    const onSelect = vi.fn();
    const onInvalidSelection = vi.fn();
    const tool = new TextAnnotationTool({
      extensionHostId: 'extension-host',
      onSelect,
      onClear: vi.fn(),
      onInvalidSelection,
    });

    tool.activate();
    document
      .querySelector('textarea')
      ?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    document
      .querySelector('button')
      ?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onInvalidSelection).toHaveBeenCalledWith(expect.stringContaining('편집 가능한 영역'));
    tool.deactivate();
  });
});
