export const TEXT_CONTEXT_LENGTH = 48;

const SKIPPED_ELEMENT_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[data-html-memo-extension]',
].join(',');

export interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

export interface LinearText {
  text: string;
  segments: TextSegment[];
}

export function isEditableNode(node: Node | null): boolean {
  const element = node instanceof Element ? node : node?.parentElement;
  return (
    element?.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    ) !== null
  );
}

function shouldSkip(node: Node): boolean {
  return node instanceof Element && node.matches(SKIPPED_ELEMENT_SELECTOR);
}

export function collectLinearText(root: Node): LinearText {
  const segments: TextSegment[] = [];
  let text = '';

  const visit = (node: Node): void => {
    if (shouldSkip(node)) {
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue ?? '';
      if (value.length > 0) {
        const start = text.length;
        text += value;
        segments.push({ node: node as Text, start, end: text.length });
      }
      return;
    }
    node.childNodes.forEach(visit);
  };

  visit(root);
  return { text, segments };
}

export function getTextOffset(
  root: Node,
  boundaryContainer: Node,
  boundaryOffset: number,
): number | null {
  let total = 0;
  let result: number | null = null;

  const visit = (node: Node): boolean => {
    if (shouldSkip(node)) {
      return false;
    }
    if (node === boundaryContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        result = total + Math.min(boundaryOffset, node.nodeValue?.length ?? 0);
        return true;
      }
      const limit = Math.min(boundaryOffset, node.childNodes.length);
      for (let index = 0; index < limit; index += 1) {
        const child = node.childNodes[index];
        if (child !== undefined) {
          total += collectLinearText(child).text.length;
        }
      }
      result = total;
      return true;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      total += node.nodeValue?.length ?? 0;
      return false;
    }
    for (const child of node.childNodes) {
      if (visit(child)) {
        return true;
      }
    }
    return false;
  };

  visit(root);
  return result;
}

function locateBoundary(
  segments: TextSegment[],
  offset: number,
  preferNext: boolean,
): { node: Text; offset: number } | null {
  for (const [index, segment] of segments.entries()) {
    if (
      offset < segment.end ||
      (offset === segment.end && (!preferNext || index === segments.length - 1))
    ) {
      return { node: segment.node, offset: Math.max(0, offset - segment.start) };
    }
  }
  const last = segments.at(-1);
  return last === undefined ? null : { node: last.node, offset: last.node.data.length };
}

export function createRangeFromTextOffsets(
  root: Node,
  startOffset: number,
  endOffset: number,
): Range | null {
  if (startOffset < 0 || endOffset < startOffset) {
    return null;
  }
  const { text, segments } = collectLinearText(root);
  if (endOffset > text.length || segments.length === 0) {
    return null;
  }
  const start = locateBoundary(segments, startOffset, true);
  const end = locateBoundary(segments, endOffset, false);
  if (start === null || end === null) {
    return null;
  }
  const range = root.ownerDocument?.createRange() ?? document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

export function rangeFromLinearOffsets(
  linearText: LinearText,
  startOffset: number,
  endOffset: number,
): Range | null {
  const start = locateBoundary(linearText.segments, startOffset, true);
  const end = locateBoundary(linearText.segments, endOffset, false);
  if (start === null || end === null) {
    return null;
  }
  const range = start.node.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

function escapeCssIdentifier(value: string): string {
  const cssObject = globalThis.CSS as { escape?: (input: string) => string } | undefined;
  if (cssObject?.escape !== undefined) {
    return cssObject.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}

export function createCssSelector(element: Element): string | undefined {
  const document = element.ownerDocument;
  if (element.id.length > 0) {
    const selector = `#${escapeCssIdentifier(element.id)}`;
    try {
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    } catch {
      // Fall through to the structural selector.
    }
  }

  const parts: string[] = [];
  let current: Element | null = element;
  while (current !== null && current !== document.documentElement) {
    const tagName = current.tagName.toLowerCase();
    const parentElement: Element | null = current.parentElement;
    if (parentElement === null) {
      break;
    }
    const sameTagSiblings: Element[] = Array.from(parentElement.children).filter(
      (candidate: Element) => candidate.tagName === current?.tagName,
    );
    const index = sameTagSiblings.indexOf(current) + 1;
    parts.unshift(`${tagName}:nth-of-type(${index})`);
    current = parentElement;
  }
  if (parts.length === 0) {
    return element === document.documentElement ? 'html' : undefined;
  }
  return `html > ${parts.join(' > ')}`;
}

export function getRangeContainer(range: Range): Element | null {
  const common = range.commonAncestorContainer;
  return common instanceof Element ? common : common.parentElement;
}
