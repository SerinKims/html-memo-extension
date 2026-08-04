import {
  calculatePointPosition,
  measureDocument,
} from '../../services/annotation-position-service';
import type { PointPosition } from '../../types/annotation';

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[contenteditable="true"]',
].join(',');

export interface PointSelection {
  position: PointPosition;
  clientX: number;
  clientY: number;
}

interface PointAnnotationToolOptions {
  document?: Document;
  window?: Window;
  extensionHostId: string;
  confirmInteractiveClick?: (element: Element) => boolean;
  onSelect: (selection: PointSelection) => void;
}

export class PointAnnotationTool {
  private readonly document: Document;
  private readonly window: Window;
  private readonly extensionHostId: string;
  private readonly confirmInteractiveClick: (element: Element) => boolean;
  private readonly onSelect: (selection: PointSelection) => void;
  private isActive = false;

  public constructor(options: PointAnnotationToolOptions) {
    this.document = options.document ?? document;
    this.window = options.window ?? window;
    this.extensionHostId = options.extensionHostId;
    this.confirmInteractiveClick =
      options.confirmInteractiveClick ??
      (() => this.window.confirm('이 요소의 원래 동작을 중단하고 위치 메모를 만드시겠습니까?'));
    this.onSelect = options.onSelect;
  }

  public activate(): void {
    if (this.isActive) {
      return;
    }
    this.isActive = true;
    this.document.addEventListener('click', this.handleClick, true);
  }

  public deactivate(): void {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.document.removeEventListener('click', this.handleClick, true);
  }

  public get active(): boolean {
    return this.isActive;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (!this.isActive || event.button !== 0 || event.defaultPrevented) {
      return;
    }

    const path = event.composedPath();
    if (this.isExtensionUiEvent(path)) {
      return;
    }

    const target = path.find((candidate): candidate is Element => candidate instanceof Element);
    const interactive = target?.closest(INTERACTIVE_SELECTOR);
    if (
      interactive !== undefined &&
      interactive !== null &&
      !this.confirmInteractiveClick(interactive)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    this.onSelect({
      position: calculatePointPosition(event.pageX, event.pageY, measureDocument(this.document)),
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

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
