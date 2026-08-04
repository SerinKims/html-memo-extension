import { measureDocument } from '../../services/annotation-position-service';
import {
  calculateAreaPosition,
  normalizeDocumentArea,
  type ViewportArea,
} from '../../services/area-position-service';
import type { AreaPosition } from '../../types/annotation';

export const MIN_AREA_SIZE_PX = 12;

export interface AreaSelection {
  position: AreaPosition;
  clientX: number;
  clientY: number;
}

interface AreaAnnotationToolOptions {
  document?: Document;
  window?: Window;
  extensionHostId: string;
  minimumSize?: number;
  onPreview?: (area: ViewportArea | null) => void;
  onSelect: (selection: AreaSelection) => void;
  onCancel?: () => void;
  onInvalidSelection?: (message: string) => void;
}

interface InlineStyleSnapshot {
  value: string;
  priority: string;
}

export class AreaAnnotationTool {
  private readonly document: Document;
  private readonly window: Window;
  private readonly extensionHostId: string;
  private readonly minimumSize: number;
  private readonly onPreview: (area: ViewportArea | null) => void;
  private readonly onSelect: (selection: AreaSelection) => void;
  private readonly onCancel: () => void;
  private readonly onInvalidSelection: (message: string) => void;
  private isActive = false;
  private startPoint: { x: number; y: number } | null = null;
  private lastClientPoint: { x: number; y: number } | null = null;
  private userSelectSnapshot: InlineStyleSnapshot | null = null;
  private webkitUserSelectSnapshot: InlineStyleSnapshot | null = null;

  public constructor(options: AreaAnnotationToolOptions) {
    this.document = options.document ?? document;
    this.window = options.window ?? window;
    this.extensionHostId = options.extensionHostId;
    this.minimumSize = options.minimumSize ?? MIN_AREA_SIZE_PX;
    this.onPreview = options.onPreview ?? (() => undefined);
    this.onSelect = options.onSelect;
    this.onCancel = options.onCancel ?? (() => undefined);
    this.onInvalidSelection = options.onInvalidSelection ?? (() => undefined);
  }

  public activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.document.addEventListener('mousedown', this.handleMouseDown, true);
    this.document.addEventListener('keydown', this.handleKeyDown, true);
  }

  public deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.document.removeEventListener('mousedown', this.handleMouseDown, true);
    this.document.removeEventListener('keydown', this.handleKeyDown, true);
    this.cancelSelection(false);
  }

  public get active(): boolean {
    return this.isActive;
  }

  public get selecting(): boolean {
    return this.startPoint !== null;
  }

  public cancelSelection(notify = true): void {
    if (this.startPoint === null) return;
    this.finishTracking();
    this.onPreview(null);
    if (notify) this.onCancel();
  }

  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (!this.isActive || event.button !== 0 || event.defaultPrevented) return;
    if (this.isExtensionUiEvent(event.composedPath())) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    this.startPoint = {
      x: event.clientX + this.window.scrollX,
      y: event.clientY + this.window.scrollY,
    };
    this.lastClientPoint = { x: event.clientX, y: event.clientY };
    this.disableTextSelection();
    this.document.addEventListener('mousemove', this.handleMouseMove, true);
    this.document.addEventListener('mouseup', this.handleMouseUp, true);
    this.window.addEventListener('scroll', this.handleScroll, true);
    this.window.addEventListener('blur', this.handleBlur);
    this.updatePreview();
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (this.startPoint === null) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.lastClientPoint = { x: event.clientX, y: event.clientY };
    this.updatePreview();
  };

  private readonly handleMouseUp = (event: MouseEvent): void => {
    if (this.startPoint === null || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.lastClientPoint = { x: event.clientX, y: event.clientY };

    const start = this.startPoint;
    const end = this.getCurrentDocumentPoint();
    const size = measureDocument(this.document);
    const area = normalizeDocumentArea(start.x, start.y, end.x, end.y, size);
    this.finishTracking();
    this.onPreview(null);

    if (area.width < this.minimumSize || area.height < this.minimumSize) {
      this.onInvalidSelection(`영역은 가로와 세로가 각각 ${this.minimumSize}px 이상이어야 합니다.`);
      return;
    }

    this.onSelect({
      position: calculateAreaPosition(start.x, start.y, end.x, end.y, size),
      clientX: area.left + area.width - this.window.scrollX,
      clientY: area.top + area.height - this.window.scrollY,
    });
  };

  private readonly handleScroll = (): void => this.updatePreview();

  private readonly handleBlur = (): void => this.cancelSelection();

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || this.startPoint === null) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.cancelSelection();
  };

  private updatePreview(): void {
    if (this.startPoint === null || this.lastClientPoint === null) return;
    const end = this.getCurrentDocumentPoint();
    const area = normalizeDocumentArea(
      this.startPoint.x,
      this.startPoint.y,
      end.x,
      end.y,
      measureDocument(this.document),
    );
    this.onPreview({
      ...area,
      left: area.left - this.window.scrollX,
      top: area.top - this.window.scrollY,
    });
  }

  private getCurrentDocumentPoint(): { x: number; y: number } {
    const point = this.lastClientPoint ?? { x: 0, y: 0 };
    return { x: point.x + this.window.scrollX, y: point.y + this.window.scrollY };
  }

  private finishTracking(): void {
    this.startPoint = null;
    this.lastClientPoint = null;
    this.document.removeEventListener('mousemove', this.handleMouseMove, true);
    this.document.removeEventListener('mouseup', this.handleMouseUp, true);
    this.window.removeEventListener('scroll', this.handleScroll, true);
    this.window.removeEventListener('blur', this.handleBlur);
    this.restoreTextSelection();
  }

  private disableTextSelection(): void {
    const style = this.document.documentElement.style;
    this.userSelectSnapshot = {
      value: style.getPropertyValue('user-select'),
      priority: style.getPropertyPriority('user-select'),
    };
    this.webkitUserSelectSnapshot = {
      value: style.getPropertyValue('-webkit-user-select'),
      priority: style.getPropertyPriority('-webkit-user-select'),
    };
    style.setProperty('user-select', 'none', 'important');
    style.setProperty('-webkit-user-select', 'none', 'important');
  }

  private restoreTextSelection(): void {
    const style = this.document.documentElement.style;
    this.restoreStyleProperty(style, 'user-select', this.userSelectSnapshot);
    this.restoreStyleProperty(style, '-webkit-user-select', this.webkitUserSelectSnapshot);
    this.userSelectSnapshot = null;
    this.webkitUserSelectSnapshot = null;
  }

  private restoreStyleProperty(
    style: CSSStyleDeclaration,
    property: string,
    snapshot: InlineStyleSnapshot | null,
  ): void {
    if (snapshot === null) return;
    if (snapshot.value.length === 0) style.removeProperty(property);
    else style.setProperty(property, snapshot.value, snapshot.priority);
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
