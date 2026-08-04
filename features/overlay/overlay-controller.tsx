import { createRoot, type Root } from 'react-dom/client';

import type { AnnotationEditorValue } from '../editor/AnnotationEditor';
import { AreaAnnotationTool, type AreaSelection } from '../area/AreaAnnotationTool';
import { PointAnnotationTool, type PointSelection } from '../point/PointAnnotationTool';
import { TextAnnotationTool, type TextSelection } from '../text/TextAnnotationTool';
import { TextHighlight } from '../text/TextHighlight';
import {
  createAnnotation,
  deleteAnnotation,
  getAnnotationSettings,
  getPageAreaAnnotations,
  getPageAnnotationCount,
  getPagePointAnnotations,
  getPageTextAnnotations,
  movePointAnnotation,
  updateAnnotation,
  updateAnnotationSettings,
} from '../../services/message-service';
import { restoreViewportArea, type ViewportArea } from '../../services/area-position-service';
import {
  calculatePointPosition,
  measureDocument,
  restoreViewportPoint,
} from '../../services/annotation-position-service';
import type {
  Annotation,
  AreaAnnotation,
  PointAnnotation,
  PointPosition,
  TextAnnotation,
} from '../../types/annotation';
import type { StorageSettings } from '../../types/storage';
import type {
  AreaAnnotationGateway,
  OverlayState,
  OverlayTool,
  PointAnnotationGateway,
  TextAnnotationGateway,
} from '../../types/messages';
import { restoreTextAnchor } from '../../services/text-anchor-restorer';
import { observeSpaNavigation, type NavigationCleanup } from '../../utils/spa-navigation';
import AnnotationOverlay, {
  type AnnotationEditorView,
  type AreaMarkerView,
  type PointMarkerView,
  type TextMemoListItemView,
} from './AnnotationOverlay';

export const OVERLAY_HOST_ID = 'html-memo-extension-overlay-host';

interface OverlayControllerOptions {
  document?: Document;
  window?: Window;
  styles: string;
  loadAnnotationCount?: (url: string) => Promise<number>;
  pointGateway?: PointAnnotationGateway;
  textGateway?: TextAnnotationGateway;
  areaGateway?: AreaAnnotationGateway;
}

type EditorState =
  | { mode: 'create-point'; position: PointPosition }
  | { mode: 'create-text'; selection: TextSelection }
  | { mode: 'create-area'; selection: AreaSelection }
  | { mode: 'edit'; annotationId: string };

const defaultPointGateway: PointAnnotationGateway = {
  getByPage: getPagePointAnnotations,
  create: createAnnotation,
  update: updateAnnotation,
  move: movePointAnnotation,
  delete: deleteAnnotation,
  getSettings: getAnnotationSettings,
  updateSettings: updateAnnotationSettings,
};

const defaultTextGateway: TextAnnotationGateway = {
  getByPage: async (url) => getPageTextAnnotations(url),
  create: createAnnotation,
  update: updateAnnotation,
  delete: deleteAnnotation,
};

const defaultAreaGateway: AreaAnnotationGateway = {
  getByPage: getPageAreaAnnotations,
  create: createAnnotation,
  update: updateAnnotation,
  delete: deleteAnnotation,
};

const initialSettings: StorageSettings = { defaultAuthor: '', defaultColor: 'yellow' };

function byOldestFirst(left: Annotation, right: Annotation): number {
  const difference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
  return difference === 0 ? left.id.localeCompare(right.id) : difference;
}

function invokeAsync<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return operation();
  } catch (error) {
    return Promise.reject(error);
  }
}

export class OverlayController {
  private readonly document: Document;
  private readonly window: Window;
  private readonly styles: string;
  private readonly loadAnnotationCount: (url: string) => Promise<number>;
  private readonly pointGateway: PointAnnotationGateway;
  private readonly textGateway: TextAnnotationGateway;
  private readonly areaGateway: AreaAnnotationGateway;
  private readonly pointTool: PointAnnotationTool;
  private readonly textTool: TextAnnotationTool;
  private readonly areaTool: AreaAnnotationTool;
  private readonly textHighlight: TextHighlight;
  private root: Root | null = null;
  private host: HTMLElement | null = null;
  private stopNavigationObserver: NavigationCleanup | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private textRestoreTimer: number | null = null;
  private renderFrame: number | null = null;
  private isActive = false;
  private selectedTool: OverlayTool | null = null;
  private annotationCount: number | null = null;
  private pointAnnotations: PointAnnotation[] = [];
  private textAnnotations: TextAnnotation[] = [];
  private areaAnnotations: AreaAnnotation[] = [];
  private areaPreview: ViewportArea | null = null;
  private readonly restoredTextRanges = new Map<string, Range>();
  private pendingTextSelection: TextSelection | null = null;
  private isTextMemoListOpen = false;
  private settings: StorageSettings = { ...initialSettings };
  private editorState: EditorState | null = null;
  private readonly markerMoveSequences = new Map<string, number>();
  private currentUrl: string;
  private statusMessage = '메모 모드가 활성화되었습니다.';
  private requestSequence = 0;

  public constructor(options: OverlayControllerOptions) {
    this.document = options.document ?? document;
    this.window = options.window ?? window;
    this.styles = options.styles;
    this.loadAnnotationCount = options.loadAnnotationCount ?? getPageAnnotationCount;
    this.pointGateway = options.pointGateway ?? defaultPointGateway;
    this.textGateway = options.textGateway ?? defaultTextGateway;
    this.areaGateway = options.areaGateway ?? defaultAreaGateway;
    this.currentUrl = this.window.location.href;
    this.pointTool = new PointAnnotationTool({
      document: this.document,
      window: this.window,
      extensionHostId: OVERLAY_HOST_ID,
      onSelect: (selection) => this.handlePointSelection(selection),
    });
    this.textTool = new TextAnnotationTool({
      document: this.document,
      window: this.window,
      extensionHostId: OVERLAY_HOST_ID,
      onSelect: (selection) => this.handleTextSelection(selection),
      onClear: () => {
        if (this.pendingTextSelection !== null) {
          this.pendingTextSelection = null;
          this.render();
        }
      },
      onInvalidSelection: (message) => {
        this.statusMessage = message;
        this.render();
      },
    });
    this.areaTool = new AreaAnnotationTool({
      document: this.document,
      window: this.window,
      extensionHostId: OVERLAY_HOST_ID,
      onPreview: (area) => {
        this.areaPreview = area;
        this.render();
      },
      onSelect: (selection) => this.handleAreaSelection(selection),
      onCancel: () => {
        this.statusMessage = '영역 선택을 취소했습니다.';
        this.render();
      },
      onInvalidSelection: (message) => {
        this.statusMessage = message;
        this.render();
      },
    });
    this.textHighlight = new TextHighlight({
      document: this.document,
      window: this.window,
      onClick: (annotationId) => this.openTextEditor(annotationId),
    });
  }

  public activate(): OverlayState {
    if (this.isActive) {
      return this.getState();
    }

    this.isActive = true;
    this.selectedTool = null;
    this.statusMessage = '메모 모드가 활성화되었습니다.';
    this.ensureRoot();
    this.window.addEventListener('keydown', this.handleKeyDown, true);
    this.window.addEventListener('scroll', this.scheduleMarkerRender, true);
    this.window.addEventListener('resize', this.scheduleMarkerRender);
    this.startDocumentObservers();
    this.stopNavigationObserver = observeSpaNavigation(
      (url) => this.handleNavigation(url),
      this.window,
    );
    void this.refreshPageState(this.window.location.href);
    return this.getState();
  }

  public deactivate(): OverlayState {
    if (!this.isActive) {
      return this.getState();
    }

    this.isActive = false;
    this.selectedTool = null;
    this.annotationCount = null;
    this.pointAnnotations = [];
    this.textAnnotations = [];
    this.areaAnnotations = [];
    this.areaPreview = null;
    this.restoredTextRanges.clear();
    this.pendingTextSelection = null;
    this.isTextMemoListOpen = false;
    this.editorState = null;
    this.markerMoveSequences.clear();
    this.requestSequence += 1;
    this.pointTool.deactivate();
    this.textTool.deactivate();
    this.areaTool.deactivate();
    this.textHighlight.destroy();
    this.window.removeEventListener('keydown', this.handleKeyDown, true);
    this.window.removeEventListener('scroll', this.scheduleMarkerRender, true);
    this.window.removeEventListener('resize', this.scheduleMarkerRender);
    this.stopNavigationObserver?.();
    this.stopNavigationObserver = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    if (this.textRestoreTimer !== null) {
      this.window.clearTimeout(this.textRestoreTimer);
      this.textRestoreTimer = null;
    }
    if (this.renderFrame !== null) {
      this.window.cancelAnimationFrame(this.renderFrame);
      this.renderFrame = null;
    }
    this.root?.unmount();
    this.root = null;
    this.host?.remove();
    this.host = null;
    return this.getState();
  }

  public getState(): OverlayState {
    return {
      isActive: this.isActive,
      selectedTool: this.selectedTool,
      annotationCount: this.annotationCount,
      url: this.currentUrl,
    };
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') {
      return;
    }
    if (this.areaTool.selecting) {
      event.preventDefault();
      event.stopPropagation();
      this.areaTool.cancelSelection();
      return;
    }
    if (this.editorState !== null) {
      this.closeEditor();
      return;
    }
    this.deactivate();
  };

  private readonly scheduleMarkerRender = (): void => {
    if (!this.isActive || this.renderFrame !== null) {
      return;
    }
    this.renderFrame = this.window.requestAnimationFrame(() => {
      this.renderFrame = null;
      this.textHighlight.refresh();
      this.render();
    });
  };

  private handlePointSelection(selection: PointSelection): void {
    if (!this.isActive || this.selectedTool !== 'point' || this.editorState !== null) {
      return;
    }
    this.editorState = { mode: 'create-point', position: selection.position };
    this.statusMessage = '메모 내용을 입력한 뒤 저장하세요.';
    this.syncTools();
    this.render();
  }

  private handleTextSelection(selection: TextSelection): void {
    if (!this.isActive || this.selectedTool !== 'text' || this.editorState !== null) {
      return;
    }
    this.pendingTextSelection = selection;
    this.statusMessage = '선택 영역 옆의 ‘메모 추가’ 버튼을 누르세요.';
    this.render();
  }

  private handleAreaSelection(selection: AreaSelection): void {
    if (!this.isActive || this.selectedTool !== 'area' || this.editorState !== null) {
      return;
    }
    this.editorState = { mode: 'create-area', selection };
    this.statusMessage = '선택한 영역에 메모 내용을 입력하세요.';
    this.syncTools();
    this.render();
  }

  private startTextEditor(): void {
    if (this.pendingTextSelection === null) {
      return;
    }
    this.editorState = { mode: 'create-text', selection: this.pendingTextSelection };
    this.pendingTextSelection = null;
    this.areaPreview = null;
    this.statusMessage = '선택한 텍스트에 남길 메모를 입력하세요.';
    this.syncTools();
    this.render();
  }

  private handleNavigation(url: string): void {
    this.selectedTool = null;
    this.editorState = null;
    this.markerMoveSequences.clear();
    this.pendingTextSelection = null;
    this.isTextMemoListOpen = false;
    this.restoredTextRanges.clear();
    this.textHighlight.setHighlights([]);
    this.areaTool.cancelSelection(false);
    this.syncTools();
    this.statusMessage = '페이지 이동을 감지해 메모 상태를 갱신합니다.';
    void this.refreshPageState(url);
  }

  private async refreshPageState(url: string): Promise<void> {
    const sequence = ++this.requestSequence;
    this.currentUrl = url;
    this.annotationCount = null;
    this.pointAnnotations = [];
    this.textAnnotations = [];
    this.areaAnnotations = [];
    this.restoredTextRanges.clear();
    this.textHighlight.setHighlights([]);
    this.render();

    const [countResult, pointsResult, textsResult, areasResult, settingsResult] =
      await Promise.allSettled([
        invokeAsync(() => this.loadAnnotationCount(url)),
        invokeAsync(() => this.pointGateway.getByPage(url)),
        invokeAsync(() => this.textGateway.getByPage(url)),
        invokeAsync(() => this.areaGateway.getByPage(url)),
        invokeAsync(() => this.pointGateway.getSettings()),
      ]);
    if (!this.isActive || sequence !== this.requestSequence) {
      return;
    }

    if (countResult.status === 'fulfilled') {
      this.annotationCount = countResult.value;
    }
    if (pointsResult.status === 'fulfilled') {
      this.pointAnnotations = pointsResult.value;
    }
    if (textsResult.status === 'fulfilled') {
      this.textAnnotations = textsResult.value;
      this.restoreTextAnnotations();
    }
    if (areasResult.status === 'fulfilled') {
      this.areaAnnotations = areasResult.value;
    }
    if (settingsResult.status === 'fulfilled') {
      this.settings = settingsResult.value;
    }

    const failure = [countResult, pointsResult, textsResult, areasResult, settingsResult].find(
      (result) => result.status === 'rejected',
    );
    if (failure?.status === 'rejected') {
      this.statusMessage =
        failure.reason instanceof Error
          ? failure.reason.message
          : '현재 페이지의 메모를 불러오지 못했습니다.';
    }
    this.render();
  }

  private startDocumentObservers(): void {
    const ResizeObserverConstructor = (
      this.window as Window & { ResizeObserver?: typeof ResizeObserver }
    ).ResizeObserver;
    if (ResizeObserverConstructor !== undefined) {
      const observer = new ResizeObserverConstructor(this.scheduleMarkerRender);
      observer.observe(this.document.documentElement);
      if (this.document.body !== null) {
        observer.observe(this.document.body);
      }
      this.resizeObserver = observer;
    }

    const MutationObserverConstructor = (
      this.window as Window & { MutationObserver?: typeof MutationObserver }
    ).MutationObserver;
    if (MutationObserverConstructor !== undefined && this.document.body !== null) {
      const observer = new MutationObserverConstructor((records) => {
        this.scheduleMarkerRender();
        const hasPageMutation = records.some((record) => {
          const target =
            record.target instanceof Element ? record.target : record.target.parentElement;
          return target?.closest('[data-html-memo-extension]') === null;
        });
        if (hasPageMutation) {
          this.scheduleTextRestoration();
        }
      });
      observer.observe(this.document.body, {
        childList: true,
        subtree: true,
      });
      this.mutationObserver = observer;
    }
  }

  private ensureRoot(): void {
    const existingHost = this.document.getElementById(OVERLAY_HOST_ID);
    if (existingHost !== null && existingHost !== this.host) {
      existingHost.remove();
    }

    if (this.root !== null) {
      return;
    }

    const host = this.document.createElement('div');
    host.id = OVERLAY_HOST_ID;
    host.setAttribute('data-html-memo-extension', 'overlay');
    host.style.setProperty('all', 'initial', 'important');
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('inset', '0', 'important');
    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('width', '0', 'important');
    host.style.setProperty('height', '0', 'important');
    host.style.setProperty('z-index', '2147483647', 'important');
    host.style.setProperty('pointer-events', 'none', 'important');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleElement = this.document.createElement('style');
    styleElement.textContent = this.styles;
    const mountElement = this.document.createElement('div');
    mountElement.id = 'html-memo-extension-root';
    shadowRoot.append(styleElement, mountElement);
    this.document.documentElement.append(host);

    this.host = host;
    this.root = createRoot(mountElement);
    this.render();
  }

  private scheduleTextRestoration(): void {
    if (this.textRestoreTimer !== null) {
      this.window.clearTimeout(this.textRestoreTimer);
    }
    this.textRestoreTimer = this.window.setTimeout(() => {
      this.textRestoreTimer = null;
      if (this.isActive) {
        this.restoreTextAnnotations();
        this.render();
      }
    }, 250);
  }

  private syncTools(): void {
    if (this.isActive && this.selectedTool === 'point' && this.editorState === null) {
      this.pointTool.activate();
    } else {
      this.pointTool.deactivate();
    }
    if (this.isActive && this.selectedTool === 'text' && this.editorState === null) {
      this.textTool.activate();
    } else {
      this.textTool.deactivate();
    }
    if (this.isActive && this.selectedTool === 'area' && this.editorState === null) {
      this.areaTool.activate();
    } else {
      this.areaTool.deactivate();
      this.areaPreview = null;
    }
  }

  private restoreTextAnnotations(): void {
    this.restoredTextRanges.clear();
    for (const annotation of this.textAnnotations) {
      try {
        const restored = restoreTextAnchor(annotation.anchor, this.document);
        if (restored !== null) {
          this.restoredTextRanges.set(annotation.id, restored.range);
        }
      } catch {
        // A single stale anchor must not interrupt the remaining annotations.
      }
    }
    this.textHighlight.setHighlights(
      this.textAnnotations.flatMap((annotation) => {
        const range = this.restoredTextRanges.get(annotation.id);
        return range === undefined ? [] : [{ annotation, range }];
      }),
    );
  }

  private openPointEditor(annotationId: string): void {
    if (!this.pointAnnotations.some((annotation) => annotation.id === annotationId)) {
      return;
    }
    this.editorState = { mode: 'edit', annotationId };
    this.statusMessage = '위치 메모를 수정할 수 있습니다.';
    this.syncTools();
    this.render();
  }

  private openTextEditor(annotationId: string): void {
    const annotation = this.textAnnotations.find((candidate) => candidate.id === annotationId);
    if (annotation === undefined) {
      return;
    }
    this.editorState = { mode: 'edit', annotationId };
    this.statusMessage = this.restoredTextRanges.has(annotationId)
      ? '텍스트 메모를 수정할 수 있습니다.'
      : '원문 위치를 찾지 못한 미배치 텍스트 메모입니다.';
    this.syncTools();
    this.render();
  }

  private openAreaEditor(annotationId: string): void {
    if (!this.areaAnnotations.some((annotation) => annotation.id === annotationId)) {
      return;
    }
    this.editorState = { mode: 'edit', annotationId };
    this.statusMessage = '영역 메모를 수정할 수 있습니다.';
    this.syncTools();
    this.render();
  }

  private closeEditor(): void {
    this.editorState = null;
    this.statusMessage =
      this.selectedTool === 'point'
        ? '웹페이지에서 메모를 남길 위치를 클릭하세요.'
        : this.selectedTool === 'area'
          ? '웹페이지에서 메모를 남길 영역을 드래그하세요.'
          : '메모 편집을 취소했습니다.';
    this.syncTools();
    this.render();
  }

  private async saveEditor(value: AnnotationEditorValue): Promise<void> {
    const editorState = this.editorState;
    if (editorState === null) {
      return;
    }

    let savedType: 'point' | 'text' | 'area';
    if (editorState.mode === 'create-point') {
      const created = await this.pointGateway.create({
        type: 'point',
        originalUrl: this.currentUrl,
        pageTitle: this.document.title,
        content: value.content,
        author: value.author,
        color: value.color,
        status: value.status,
        position: editorState.position,
      });
      if (created.type !== 'point') {
        throw new Error('저장된 위치 메모 형식이 올바르지 않습니다.');
      }
      this.pointAnnotations = [...this.pointAnnotations, created];
      this.annotationCount = (this.annotationCount ?? 0) + 1;
      savedType = 'point';
    } else if (editorState.mode === 'create-text') {
      const created = await this.textGateway.create({
        type: 'text',
        originalUrl: this.currentUrl,
        pageTitle: this.document.title,
        content: value.content,
        author: value.author,
        color: value.color,
        status: value.status,
        anchor: editorState.selection.anchor,
      });
      if (created.type !== 'text') {
        throw new Error('저장된 텍스트 메모 형식이 올바르지 않습니다.');
      }
      this.textAnnotations = [...this.textAnnotations, created];
      this.restoredTextRanges.set(created.id, editorState.selection.range);
      this.annotationCount = (this.annotationCount ?? 0) + 1;
      savedType = 'text';
    } else if (editorState.mode === 'create-area') {
      const created = await this.areaGateway.create({
        type: 'area',
        originalUrl: this.currentUrl,
        pageTitle: this.document.title,
        content: value.content,
        author: value.author,
        color: value.color,
        status: value.status,
        position: editorState.selection.position,
      });
      if (created.type !== 'area') {
        throw new Error('저장된 영역 메모 형식이 올바르지 않습니다.');
      }
      this.areaAnnotations = [...this.areaAnnotations, created];
      this.annotationCount = (this.annotationCount ?? 0) + 1;
      savedType = 'area';
    } else {
      const isText = this.textAnnotations.some(
        (annotation) => annotation.id === editorState.annotationId,
      );
      const isArea = this.areaAnnotations.some(
        (annotation) => annotation.id === editorState.annotationId,
      );
      const gateway = isText ? this.textGateway : isArea ? this.areaGateway : this.pointGateway;
      const updated = await gateway.update(editorState.annotationId, value);
      if (isText && updated.type === 'text') {
        this.textAnnotations = this.textAnnotations.map((annotation) =>
          annotation.id === updated.id ? updated : annotation,
        );
        savedType = 'text';
      } else if (!isText && !isArea && updated.type === 'point') {
        this.pointAnnotations = this.pointAnnotations.map((annotation) =>
          annotation.id === updated.id ? updated : annotation,
        );
        savedType = 'point';
      } else if (isArea && updated.type === 'area') {
        this.areaAnnotations = this.areaAnnotations.map((annotation) =>
          annotation.id === updated.id ? updated : annotation,
        );
        savedType = 'area';
      } else {
        throw new Error('수정된 메모 형식이 올바르지 않습니다.');
      }
    }

    this.settings = { defaultAuthor: value.author, defaultColor: value.color };
    let settingsFailed = false;
    try {
      this.settings = await this.pointGateway.updateSettings(this.settings);
    } catch {
      settingsFailed = true;
    }

    this.editorState = null;
    this.statusMessage = settingsFailed
      ? '메모는 저장했지만 기본 작성자와 색상은 기억하지 못했습니다.'
      : `${savedType === 'text' ? '텍스트' : savedType === 'area' ? '영역' : '위치'} 메모를 저장했습니다.`;
    if (savedType === 'text') {
      this.restoreTextAnnotations();
      this.window.getSelection()?.removeAllRanges();
    }
    this.syncTools();
    this.render();
  }

  private async deleteEditorAnnotation(): Promise<void> {
    if (this.editorState?.mode !== 'edit') {
      return;
    }
    const annotationId = this.editorState.annotationId;
    const textAnnotation = this.textAnnotations.find(
      (annotation) => annotation.id === annotationId,
    );
    const areaAnnotation = this.areaAnnotations.find(
      (annotation) => annotation.id === annotationId,
    );
    const kind =
      textAnnotation !== undefined ? '텍스트' : areaAnnotation !== undefined ? '영역' : '위치';
    if (!this.window.confirm(`이 ${kind} 메모를 삭제하시겠습니까?`)) {
      return;
    }

    const deleteGateway =
      textAnnotation !== undefined
        ? this.textGateway
        : areaAnnotation !== undefined
          ? this.areaGateway
          : this.pointGateway;
    const deleted = await deleteGateway.delete(annotationId);
    if (!deleted) {
      throw new Error('삭제할 메모를 찾지 못했습니다.');
    }
    this.pointAnnotations = this.pointAnnotations.filter(
      (annotation) => annotation.id !== annotationId,
    );
    this.textAnnotations = this.textAnnotations.filter(
      (annotation) => annotation.id !== annotationId,
    );
    this.areaAnnotations = this.areaAnnotations.filter(
      (annotation) => annotation.id !== annotationId,
    );
    this.restoredTextRanges.delete(annotationId);
    this.textHighlight.remove(annotationId);
    this.annotationCount = Math.max(0, (this.annotationCount ?? 1) - 1);
    this.editorState = null;
    this.statusMessage = `${kind} 메모를 삭제했습니다.`;
    this.syncTools();
    this.render();
  }

  private async moveMarker(annotationId: string, clientX: number, clientY: number): Promise<void> {
    const previous = this.pointAnnotations.find((annotation) => annotation.id === annotationId);
    if (previous === undefined) {
      return;
    }

    const sequence = (this.markerMoveSequences.get(annotationId) ?? 0) + 1;
    this.markerMoveSequences.set(annotationId, sequence);
    const position = calculatePointPosition(
      clientX + this.window.scrollX,
      clientY + this.window.scrollY,
      measureDocument(this.document),
    );
    this.pointAnnotations = this.pointAnnotations.map((annotation) =>
      annotation.id === annotationId ? { ...annotation, position } : annotation,
    );
    this.statusMessage = '메모 위치를 저장하는 중입니다.';
    this.render();

    try {
      const moved = await this.pointGateway.move(annotationId, position);
      if (this.markerMoveSequences.get(annotationId) !== sequence) {
        return;
      }
      this.pointAnnotations = this.pointAnnotations.map((annotation) =>
        annotation.id === annotationId ? moved : annotation,
      );
      this.statusMessage = '메모 위치를 옮겼습니다.';
    } catch (error) {
      if (this.markerMoveSequences.get(annotationId) !== sequence) {
        return;
      }
      this.pointAnnotations = this.pointAnnotations.map((annotation) =>
        annotation.id === annotationId ? previous : annotation,
      );
      this.statusMessage =
        error instanceof Error ? error.message : '메모 위치를 저장하지 못했습니다.';
    } finally {
      if (this.markerMoveSequences.get(annotationId) === sequence) {
        this.markerMoveSequences.delete(annotationId);
        this.render();
      }
    }
  }

  private createMarkerViews(): PointMarkerView[] {
    const size = measureDocument(this.document);
    return this.pointAnnotations.toSorted(byOldestFirst).map((annotation, index) => ({
      annotationId: annotation.id,
      number: index + 1,
      color: annotation.color,
      status: annotation.status,
      ...restoreViewportPoint(annotation.position, size, this.window.scrollX, this.window.scrollY),
    }));
  }

  private createAreaMarkerViews(): AreaMarkerView[] {
    const size = measureDocument(this.document);
    return this.areaAnnotations.toSorted(byOldestFirst).map((annotation, index) => ({
      annotationId: annotation.id,
      number: index + 1,
      color: annotation.color,
      status: annotation.status,
      ...restoreViewportArea(annotation.position, size, this.window.scrollX, this.window.scrollY),
    }));
  }

  private createEditorView(): AnnotationEditorView | null {
    if (this.editorState === null) {
      return null;
    }

    const size = measureDocument(this.document);
    if (this.editorState.mode === 'create-point') {
      const point = restoreViewportPoint(
        this.editorState.position,
        size,
        this.window.scrollX,
        this.window.scrollY,
      );
      return {
        key: 'create',
        ...point,
        initialValue: {
          content: '',
          author: this.settings.defaultAuthor,
          color: this.settings.defaultColor,
          status: 'open',
        },
        isEditing: false,
        onSave: (value) => this.saveEditor(value),
        onCancel: () => this.closeEditor(),
      };
    }

    if (this.editorState.mode === 'create-text') {
      return {
        key: 'create-text',
        left: this.editorState.selection.clientX,
        top: this.editorState.selection.clientY,
        initialValue: {
          content: '',
          author: this.settings.defaultAuthor,
          color: this.settings.defaultColor,
          status: 'open',
        },
        isEditing: false,
        kindLabel: '텍스트 메모',
        onSave: (value) => this.saveEditor(value),
        onCancel: () => this.closeEditor(),
      };
    }

    if (this.editorState.mode === 'create-area') {
      return {
        key: 'create-area',
        left: this.editorState.selection.clientX,
        top: this.editorState.selection.clientY,
        initialValue: {
          content: '',
          author: this.settings.defaultAuthor,
          color: this.settings.defaultColor,
          status: 'open',
        },
        isEditing: false,
        kindLabel: '영역 메모',
        onSave: (value) => this.saveEditor(value),
        onCancel: () => this.closeEditor(),
      };
    }

    const annotationId = this.editorState.annotationId;
    const pointAnnotation = this.pointAnnotations.find(
      (candidate) => candidate.id === annotationId,
    );
    if (pointAnnotation !== undefined) {
      const point = restoreViewportPoint(
        pointAnnotation.position,
        size,
        this.window.scrollX,
        this.window.scrollY,
      );
      return {
        key: pointAnnotation.id,
        ...point,
        initialValue: {
          content: pointAnnotation.content,
          author: pointAnnotation.author,
          color: pointAnnotation.color,
          status: pointAnnotation.status,
        },
        isEditing: true,
        onSave: (value) => this.saveEditor(value),
        onCancel: () => this.closeEditor(),
        onDelete: () => this.deleteEditorAnnotation(),
      };
    }

    const areaAnnotation = this.areaAnnotations.find((candidate) => candidate.id === annotationId);
    if (areaAnnotation !== undefined) {
      const area = restoreViewportArea(
        areaAnnotation.position,
        size,
        this.window.scrollX,
        this.window.scrollY,
      );
      return {
        key: areaAnnotation.id,
        left: area.left + area.width,
        top: area.top + area.height,
        initialValue: {
          content: areaAnnotation.content,
          author: areaAnnotation.author,
          color: areaAnnotation.color,
          status: areaAnnotation.status,
        },
        isEditing: true,
        kindLabel: '영역 메모',
        onSave: (value) => this.saveEditor(value),
        onCancel: () => this.closeEditor(),
        onDelete: () => this.deleteEditorAnnotation(),
      };
    }

    const textAnnotation = this.textAnnotations.find((candidate) => candidate.id === annotationId);
    if (textAnnotation === undefined) {
      return null;
    }
    const range = this.restoredTextRanges.get(annotationId);
    let rect: DOMRect | undefined;
    try {
      rect = range?.getBoundingClientRect();
    } catch {
      rect = undefined;
    }
    return {
      key: textAnnotation.id,
      left: rect?.right ?? Math.max(12, this.window.innerWidth / 2 - 160),
      top: rect?.bottom ?? Math.max(12, this.window.innerHeight / 3),
      initialValue: {
        content: textAnnotation.content,
        author: textAnnotation.author,
        color: textAnnotation.color,
        status: textAnnotation.status,
      },
      isEditing: true,
      kindLabel: '텍스트 메모',
      onSave: (value) => this.saveEditor(value),
      onCancel: () => this.closeEditor(),
      onDelete: () => this.deleteEditorAnnotation(),
    };
  }

  private createTextMemoListViews(): TextMemoListItemView[] | null {
    if (!this.isTextMemoListOpen) {
      return null;
    }
    return this.textAnnotations.map((annotation) => ({
      annotationId: annotation.id,
      exactText: annotation.anchor.exactText,
      content: annotation.content,
      isPlaced: this.restoredTextRanges.has(annotation.id),
    }));
  }

  private render(): void {
    if (!this.isActive || this.root === null) {
      return;
    }

    this.root.render(
      <AnnotationOverlay
        annotationCount={this.annotationCount}
        selectedTool={this.selectedTool}
        statusMessage={this.statusMessage}
        markers={this.createMarkerViews()}
        areaMarkers={this.createAreaMarkerViews()}
        areaPreview={this.areaPreview}
        editor={this.createEditorView()}
        textSelection={
          this.pendingTextSelection === null
            ? null
            : {
                left: this.pendingTextSelection.clientX,
                top: this.pendingTextSelection.clientY,
                onAdd: () => this.startTextEditor(),
              }
        }
        textMemoList={this.createTextMemoListViews()}
        onOpenMarker={(annotationId) => this.openPointEditor(annotationId)}
        onOpenAreaMarker={(annotationId) => this.openAreaEditor(annotationId)}
        onOpenTextMemo={(annotationId) => this.openTextEditor(annotationId)}
        onMoveMarker={(annotationId, clientX, clientY) =>
          this.moveMarker(annotationId, clientX, clientY)
        }
        onSelectTool={(tool) => {
          this.selectedTool = tool;
          this.editorState = null;
          this.pendingTextSelection = null;
          this.areaTool.cancelSelection(false);
          this.areaPreview = null;
          const labels: Record<OverlayTool, string> = {
            point: '위치 메모',
            text: '텍스트 메모',
            area: '영역 메모',
          };
          this.statusMessage =
            tool === 'point'
              ? '웹페이지에서 메모를 남길 위치를 클릭하세요.'
              : tool === 'text'
                ? '웹페이지에서 메모할 텍스트를 드래그하세요.'
                : `${labels[tool]} 도구를 선택했습니다.`;
          this.syncTools();
          this.render();
        }}
        onShowList={() => {
          this.isTextMemoListOpen = !this.isTextMemoListOpen;
          this.statusMessage = this.isTextMemoListOpen
            ? '텍스트 메모 목록을 열었습니다.'
            : '텍스트 메모 목록을 닫았습니다.';
          this.render();
        }}
        onSaveHtml={() => {
          this.statusMessage = 'HTML 저장 기능은 다음 단계에서 구현합니다.';
          this.render();
        }}
        onExit={() => queueMicrotask(() => this.deactivate())}
      />,
    );
  }
}
