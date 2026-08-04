import { buildTextAnchor, InvalidTextSelectionError } from '../../services/text-anchor-builder';
import type { TextAnchor } from '../../types/annotation';

export interface TextSelection {
  anchor: TextAnchor;
  range: Range;
  clientX: number;
  clientY: number;
}

interface TextAnnotationToolOptions {
  document?: Document;
  window?: Window;
  extensionHostId: string;
  onSelect: (selection: TextSelection) => void;
  onClear: () => void;
  onInvalidSelection: (message: string) => void;
}

export class TextAnnotationTool {
  private readonly document: Document;
  private readonly window: Window;
  private readonly extensionHostId: string;
  private readonly onSelect: (selection: TextSelection) => void;
  private readonly onClear: () => void;
  private readonly onInvalidSelection: (message: string) => void;
  private isActive = false;

  public constructor(options: TextAnnotationToolOptions) {
    this.document = options.document ?? document;
    this.window = options.window ?? window;
    this.extensionHostId = options.extensionHostId;
    this.onSelect = options.onSelect;
    this.onClear = options.onClear;
    this.onInvalidSelection = options.onInvalidSelection;
  }

  public activate(): void {
    if (this.isActive) {
      return;
    }
    this.isActive = true;
    this.document.addEventListener('mouseup', this.handlePointerSelection, true);
    this.document.addEventListener('keyup', this.handleKeyboardSelection, true);
  }

  public deactivate(): void {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.document.removeEventListener('mouseup', this.handlePointerSelection, true);
    this.document.removeEventListener('keyup', this.handleKeyboardSelection, true);
    this.onClear();
  }

  public get active(): boolean {
    return this.isActive;
  }

  private readonly handlePointerSelection = (event: MouseEvent): void => {
    if (event.button !== 0 || this.isExtensionUiEvent(event.composedPath())) {
      return;
    }
    this.captureSelection();
  };

  private readonly handleKeyboardSelection = (event: KeyboardEvent): void => {
    if (!event.shiftKey) {
      return;
    }
    this.captureSelection();
  };

  private captureSelection(): void {
    if (!this.isActive) {
      return;
    }
    const selection = this.window.getSelection();
    if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
      this.onClear();
      return;
    }

    const range = selection.getRangeAt(0).cloneRange();
    try {
      const anchor = buildTextAnchor(range, this.document);
      const rects = Array.from(range.getClientRects());
      const rect = rects.at(-1) ?? range.getBoundingClientRect();
      this.onSelect({
        anchor,
        range,
        clientX: rect.right + 8,
        clientY: rect.bottom + 8,
      });
    } catch (error) {
      this.onClear();
      this.onInvalidSelection(
        error instanceof InvalidTextSelectionError
          ? error.message
          : '선택한 텍스트에 메모를 만들 수 없습니다.',
      );
    }
  }

  private isExtensionUiEvent(path: EventTarget[]): boolean {
    return path.some(
      (candidate) =>
        candidate instanceof Element &&
        (candidate.id === this.extensionHostId ||
          candidate.closest(`#${this.extensionHostId}`) !== null ||
          candidate.hasAttribute('data-html-memo-extension')),
    );
  }
}
