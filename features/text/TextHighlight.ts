import type { AnnotationColor, TextAnnotation } from '../../types/annotation';

export interface TextHighlightEntry {
  annotation: TextAnnotation;
  range: Range;
}

interface TextHighlightOptions {
  document?: Document;
  window?: Window;
  onClick: (annotationId: string) => void;
}

interface HighlightRegistry {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
}

type HighlightConstructor = new (...ranges: Range[]) => unknown;

const COLORS: Record<AnnotationColor, string> = {
  yellow: 'rgb(250 204 21 / 45%)',
  red: 'rgb(248 113 113 / 42%)',
  green: 'rgb(74 222 128 / 42%)',
  blue: 'rgb(96 165 250 / 42%)',
  purple: 'rgb(192 132 252 / 42%)',
};

const FALLBACK_ROOT_ID = 'html-memo-extension-text-highlights';

export class TextHighlight {
  private readonly document: Document;
  private readonly window: Window;
  private readonly onClick: (annotationId: string) => void;
  private readonly entries = new Map<string, TextHighlightEntry>();
  private customNames: string[] = [];
  private styleElement: HTMLStyleElement | null = null;
  private fallbackRoot: HTMLDivElement | null = null;
  private readonly useCustomHighlight: boolean;

  public constructor(options: TextHighlightOptions) {
    this.document = options.document ?? document;
    this.window = options.window ?? window;
    this.onClick = options.onClick;
    const css = (this.window as Window & { CSS?: typeof CSS & { highlights?: HighlightRegistry } })
      .CSS;
    const highlightConstructor = (this.window as Window & { Highlight?: HighlightConstructor })
      .Highlight;
    const canResolveClick =
      'caretPositionFromPoint' in this.document || 'caretRangeFromPoint' in this.document;
    this.useCustomHighlight =
      css?.highlights !== undefined && highlightConstructor !== undefined && canResolveClick;
  }

  public setHighlights(entries: TextHighlightEntry[]): void {
    this.entries.clear();
    entries.forEach((entry) => this.entries.set(entry.annotation.id, entry));
    if (this.useCustomHighlight) {
      this.renderCustomHighlights();
    } else {
      this.renderFallbackHighlights();
    }
  }

  public refresh(): void {
    if (!this.useCustomHighlight) {
      this.renderFallbackHighlights();
    }
  }

  public remove(annotationId: string): void {
    this.entries.delete(annotationId);
    this.setHighlights([...this.entries.values()]);
  }

  public destroy(): void {
    this.clearCustomHighlights();
    this.document.removeEventListener('click', this.handleDocumentClick, true);
    this.styleElement?.remove();
    this.styleElement = null;
    this.fallbackRoot?.remove();
    this.fallbackRoot = null;
    this.entries.clear();
  }

  private renderCustomHighlights(): void {
    this.clearCustomHighlights();
    const css = (this.window as Window & { CSS?: typeof CSS & { highlights?: HighlightRegistry } })
      .CSS;
    const HighlightClass = (this.window as Window & { Highlight?: HighlightConstructor }).Highlight;
    if (css?.highlights === undefined || HighlightClass === undefined) {
      return;
    }
    const rules: string[] = [];
    for (const entry of this.entries.values()) {
      const name = `html-memo-${entry.annotation.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      css.highlights.set(name, new HighlightClass(entry.range));
      this.customNames.push(name);
      rules.push(`::highlight(${name}) { background-color: ${COLORS[entry.annotation.color]}; }`);
    }
    this.ensureStyle().textContent = rules.join('\n');
    this.document.removeEventListener('click', this.handleDocumentClick, true);
    this.document.addEventListener('click', this.handleDocumentClick, true);
  }

  private clearCustomHighlights(): void {
    const css = (this.window as Window & { CSS?: typeof CSS & { highlights?: HighlightRegistry } })
      .CSS;
    this.customNames.forEach((name) => css?.highlights?.delete(name));
    this.customNames = [];
  }

  private ensureStyle(): HTMLStyleElement {
    if (this.styleElement !== null) {
      return this.styleElement;
    }
    const style = this.document.createElement('style');
    style.dataset.htmlMemoExtension = 'text-highlight-style';
    (this.document.head ?? this.document.documentElement).append(style);
    this.styleElement = style;
    return style;
  }

  private renderFallbackHighlights(): void {
    this.document.removeEventListener('click', this.handleDocumentClick, true);
    const root = this.ensureFallbackRoot();
    root.replaceChildren();
    for (const entry of this.entries.values()) {
      const getClientRects = entry.range.getClientRects as (() => DOMRectList) | undefined;
      const rects =
        typeof getClientRects === 'function' ? Array.from(getClientRects.call(entry.range)) : [];
      for (const rect of rects) {
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }
        const marker = this.document.createElement('button');
        marker.type = 'button';
        marker.dataset.annotationId = entry.annotation.id;
        marker.dataset.htmlMemoExtension = 'text-highlight';
        marker.setAttribute('aria-label', `텍스트 메모: ${entry.annotation.content}`);
        Object.assign(marker.style, {
          position: 'absolute',
          left: `${rect.left + this.window.scrollX}px`,
          top: `${rect.top + this.window.scrollY}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          margin: '0',
          padding: '0',
          border: '0',
          borderRadius: '2px',
          background: COLORS[entry.annotation.color],
          cursor: 'pointer',
          pointerEvents: 'auto',
        });
        marker.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.onClick(entry.annotation.id);
        });
        root.append(marker);
      }
    }
  }

  private ensureFallbackRoot(): HTMLDivElement {
    if (this.fallbackRoot !== null) {
      return this.fallbackRoot;
    }
    this.document.getElementById(FALLBACK_ROOT_ID)?.remove();
    const root = this.document.createElement('div');
    root.id = FALLBACK_ROOT_ID;
    root.dataset.htmlMemoExtension = 'text-highlight-layer';
    Object.assign(root.style, {
      position: 'absolute',
      inset: '0',
      width: '0',
      height: '0',
      zIndex: '2147483645',
      pointerEvents: 'none',
    });
    this.document.documentElement.append(root);
    this.fallbackRoot = root;
    return root;
  }

  private readonly handleDocumentClick = (event: MouseEvent): void => {
    const caretDocument = this.document as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const position = caretDocument.caretPositionFromPoint?.(event.clientX, event.clientY);
    const caretRange =
      position === undefined
        ? caretDocument.caretRangeFromPoint?.(event.clientX, event.clientY)
        : null;
    const node = position?.offsetNode ?? caretRange?.startContainer;
    const offset = position?.offset ?? caretRange?.startOffset;
    if (node === undefined || offset === undefined) {
      return;
    }
    const matches = [...this.entries.values()].filter((entry) => {
      try {
        return entry.range.isPointInRange(node, offset);
      } catch {
        return false;
      }
    });
    const match = matches.at(-1);
    if (match !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      this.onClick(match.annotation.id);
    }
  };
}
