import type { TextAnchor } from '../types/annotation';
import {
  collectLinearText,
  createRangeFromTextOffsets,
  rangeFromLinearOffsets,
} from '../utils/dom-text';

export type TextAnchorRestoreStrategy = 'selector-offset' | 'context' | 'exact';

export interface RestoredTextAnchor {
  range: Range;
  strategy: TextAnchorRestoreStrategy;
}

function restoreWithSelector(anchor: TextAnchor, document: Document): Range | null {
  if (
    anchor.cssSelector === undefined ||
    anchor.startOffset === undefined ||
    anchor.endOffset === undefined
  ) {
    return null;
  }
  try {
    const container = document.querySelector(anchor.cssSelector);
    if (container === null) {
      return null;
    }
    const range = createRangeFromTextOffsets(container, anchor.startOffset, anchor.endOffset);
    return range?.toString() === anchor.exactText ? range : null;
  } catch {
    return null;
  }
}

function findOccurrences(text: string, exactText: string): number[] {
  if (exactText.length === 0) {
    return [];
  }
  const offsets: number[] = [];
  let fromIndex = 0;
  while (fromIndex <= text.length - exactText.length) {
    const index = text.indexOf(exactText, fromIndex);
    if (index < 0) {
      break;
    }
    offsets.push(index);
    fromIndex = index + Math.max(1, exactText.length);
  }
  return offsets;
}

function hasMatchingContext(text: string, offset: number, anchor: TextAnchor): boolean {
  const prefixMatches =
    anchor.prefixText.length === 0 ||
    text.slice(Math.max(0, offset - anchor.prefixText.length), offset) === anchor.prefixText;
  const end = offset + anchor.exactText.length;
  const suffixMatches =
    anchor.suffixText.length === 0 ||
    text.slice(end, end + anchor.suffixText.length) === anchor.suffixText;
  return (
    prefixMatches && suffixMatches && (anchor.prefixText.length > 0 || anchor.suffixText.length > 0)
  );
}

export function restoreTextAnchor(
  anchor: TextAnchor,
  document: Document = window.document,
): RestoredTextAnchor | null {
  const selectorRange = restoreWithSelector(anchor, document);
  if (selectorRange !== null) {
    return { range: selectorRange, strategy: 'selector-offset' };
  }

  const root = document.body ?? document.documentElement;
  const linearText = collectLinearText(root);
  const occurrences = findOccurrences(linearText.text, anchor.exactText);
  const contextualOffset = occurrences.find((offset) =>
    hasMatchingContext(linearText.text, offset, anchor),
  );
  if (contextualOffset !== undefined) {
    const range = rangeFromLinearOffsets(
      linearText,
      contextualOffset,
      contextualOffset + anchor.exactText.length,
    );
    if (range !== null) {
      return { range, strategy: 'context' };
    }
  }

  const exactOffset = occurrences[0];
  if (exactOffset === undefined) {
    return null;
  }
  const range = rangeFromLinearOffsets(
    linearText,
    exactOffset,
    exactOffset + anchor.exactText.length,
  );
  return range === null ? null : { range, strategy: 'exact' };
}
