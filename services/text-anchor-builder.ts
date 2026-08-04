import type { TextAnchor } from '../types/annotation';
import {
  collectLinearText,
  createCssSelector,
  getRangeContainer,
  getTextOffset,
  isEditableNode,
  TEXT_CONTEXT_LENGTH,
} from '../utils/dom-text';

export const MIN_TEXT_SELECTION_LENGTH = 2;

export class InvalidTextSelectionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidTextSelectionError';
  }
}

export function buildTextAnchor(
  range: Range,
  document: Document = range.startContainer.ownerDocument ?? globalThis.document,
): TextAnchor {
  const exactText = range.toString();
  if (range.collapsed || exactText.trim().length === 0) {
    throw new InvalidTextSelectionError('공백이 아닌 텍스트를 선택하세요.');
  }
  if (exactText.trim().length < MIN_TEXT_SELECTION_LENGTH) {
    throw new InvalidTextSelectionError(`텍스트를 ${MIN_TEXT_SELECTION_LENGTH}자 이상 선택하세요.`);
  }
  if (isEditableNode(range.startContainer) || isEditableNode(range.endContainer)) {
    throw new InvalidTextSelectionError(
      '입력 또는 편집 가능한 영역에는 텍스트 메모를 만들 수 없습니다.',
    );
  }

  const pageRoot = document.body ?? document.documentElement;
  const pageText = collectLinearText(pageRoot);
  const pageStart = getTextOffset(pageRoot, range.startContainer, range.startOffset);
  const pageEnd = getTextOffset(pageRoot, range.endContainer, range.endOffset);
  if (
    pageStart === null ||
    pageEnd === null ||
    pageText.text.slice(pageStart, pageEnd) !== exactText
  ) {
    throw new InvalidTextSelectionError('선택한 텍스트의 위치를 확인할 수 없습니다.');
  }

  const container = getRangeContainer(range);
  const startOffset =
    container === null ? null : getTextOffset(container, range.startContainer, range.startOffset);
  const endOffset =
    container === null ? null : getTextOffset(container, range.endContainer, range.endOffset);

  const cssSelector = container === null ? undefined : createCssSelector(container);
  return {
    exactText,
    prefixText: pageText.text.slice(Math.max(0, pageStart - TEXT_CONTEXT_LENGTH), pageStart),
    suffixText: pageText.text.slice(pageEnd, pageEnd + TEXT_CONTEXT_LENGTH),
    ...(container === null ||
    startOffset === null ||
    endOffset === null ||
    cssSelector === undefined
      ? {}
      : {
          cssSelector,
          startOffset,
          endOffset,
        }),
  };
}
