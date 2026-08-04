import { afterEach, describe, expect, it, vi } from 'vitest';

import { TextHighlight } from '../features/text/TextHighlight';
import type { TextAnnotation } from '../types/annotation';

const annotation: TextAnnotation = {
  id: 'text-1',
  pageKey: 'page-1',
  originalUrl: 'https://example.com/article',
  pageTitle: '문서',
  type: 'text',
  content: '검토 필요',
  author: '',
  color: 'yellow',
  status: 'open',
  anchor: { exactText: '선택 문장', prefixText: '', suffixText: '' },
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
};

describe('TextHighlight fallback', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.querySelectorAll('[data-html-memo-extension]').forEach((element) => element.remove());
  });

  it('원본 텍스트 노드를 감싸지 않고 클릭 가능한 하이라이트를 만들고 제거한다', () => {
    document.body.innerHTML = '<p>선택 문장</p>';
    const originalTextNode = document.querySelector('p')?.firstChild as Text;
    const range = document.createRange();
    range.selectNodeContents(originalTextNode);
    Object.defineProperty(range, 'getClientRects', {
      configurable: true,
      value: () => [{ left: 10, top: 20, right: 90, bottom: 40, width: 80, height: 20 }],
    });
    const onClick = vi.fn();
    const highlight = new TextHighlight({ onClick });

    highlight.setHighlights([{ annotation, range }]);
    const marker = document.querySelector<HTMLButtonElement>(
      '[data-html-memo-extension="text-highlight"]',
    );
    marker?.click();

    expect(document.querySelector('p')?.firstChild).toBe(originalTextNode);
    expect(onClick).toHaveBeenCalledWith('text-1');

    highlight.remove('text-1');
    expect(document.querySelector('[data-html-memo-extension="text-highlight"]')).toBeNull();
    highlight.destroy();
  });
});
