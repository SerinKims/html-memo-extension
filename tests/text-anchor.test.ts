import { afterEach, describe, expect, it } from 'vitest';

import { buildTextAnchor, InvalidTextSelectionError } from '../services/text-anchor-builder';
import { restoreTextAnchor } from '../services/text-anchor-restorer';
import type { TextAnchor } from '../types/annotation';

function selectText(
  startNode: Text,
  startOffset: number,
  endNode: Text = startNode,
  endOffset: number = startNode.data.length,
): Range {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

describe('text anchor builder and restorer', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('한 요소 내부 선택을 selector와 offset으로 복원한다', () => {
    document.body.innerHTML = '<article id="story">앞 문맥 선택한 문장 뒤 문맥</article>';
    const text = document.querySelector('#story')?.firstChild as Text;
    const range = selectText(text, 5, text, 11);

    const anchor = buildTextAnchor(range, document);
    const restored = restoreTextAnchor(anchor, document);

    expect(anchor).toMatchObject({
      exactText: '선택한 문장',
      cssSelector: '#story',
      startOffset: 5,
      endOffset: 11,
    });
    expect(restored?.strategy).toBe('selector-offset');
    expect(restored?.range.toString()).toBe('선택한 문장');
  });

  it('여러 요소에 걸친 선택을 공통 컨테이너 offset으로 복원한다', () => {
    document.body.innerHTML =
      '<article id="story"><span>첫 번째 </span><strong>중간 문장</strong><span> 마지막</span></article>';
    const first = document.querySelector('span')?.firstChild as Text;
    const last = document.querySelectorAll('span')[1]?.firstChild as Text;
    const range = selectText(first, 3, last, 3);

    const anchor = buildTextAnchor(range, document);
    const restored = restoreTextAnchor(anchor, document);

    expect(anchor.exactText).toBe('째 중간 문장 마지');
    expect(anchor.cssSelector).toBe('#story');
    expect(restored?.range.toString()).toBe(anchor.exactText);
  });

  it('동일 텍스트가 여러 번 있으면 앞뒤 문맥으로 원래 위치를 찾는다', () => {
    document.body.innerHTML = '<main>첫 문맥 공통 문장 첫 끝 / 둘 문맥 공통 문장 둘 끝</main>';
    const text = document.querySelector('main')?.firstChild as Text;
    const secondOffset = text.data.lastIndexOf('공통 문장');
    const anchor = buildTextAnchor(
      selectText(text, secondOffset, text, secondOffset + '공통 문장'.length),
      document,
    );

    document.body.innerHTML =
      '<section><p>첫 문맥 공통 문장 첫 끝 / 둘 문맥 </p><p>공통 문장 둘 끝</p></section>';
    const restored = restoreTextAnchor({ ...anchor, cssSelector: '#missing' }, document);

    expect(restored?.strategy).toBe('context');
    expect(restored?.range.startContainer.parentElement?.tagName).toBe('P');
    expect(restored?.range.startContainer.parentElement?.textContent).toContain('둘 끝');
  });

  it('문맥도 바뀌면 정확한 텍스트 단독 검색으로 복원하고 없으면 실패한다', () => {
    const anchor: TextAnchor = {
      exactText: '유일한 문장',
      prefixText: '사라진 앞 문맥',
      suffixText: '사라진 뒤 문맥',
      cssSelector: '#missing',
      startOffset: 0,
      endOffset: 6,
    };
    document.body.innerHTML = '<div>새로운 구조 속 유일한 문장만 남음</div>';
    expect(restoreTextAnchor(anchor, document)?.strategy).toBe('exact');

    document.body.textContent = '완전히 다른 페이지';
    expect(restoreTextAnchor(anchor, document)).toBeNull();
  });

  it('공백·너무 짧은 선택과 편집 가능한 영역을 거부한다', () => {
    document.body.innerHTML = '<p> a </p><textarea>선택 금지</textarea>';
    const paragraphText = document.querySelector('p')?.firstChild as Text;
    const textareaText = document.querySelector('textarea')?.firstChild as Text;

    expect(() => buildTextAnchor(selectText(paragraphText, 0, paragraphText, 1), document)).toThrow(
      InvalidTextSelectionError,
    );
    expect(() => buildTextAnchor(selectText(paragraphText, 1, paragraphText, 2), document)).toThrow(
      '2자 이상',
    );
    expect(() => buildTextAnchor(selectText(textareaText, 0, textareaText, 2), document)).toThrow(
      '편집 가능한 영역',
    );
  });
});
