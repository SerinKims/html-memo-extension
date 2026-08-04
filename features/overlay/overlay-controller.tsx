import { createRoot, type Root } from 'react-dom/client';

import type { AnnotationEditorValue } from '../editor/AnnotationEditor';
import { PointAnnotationTool, type PointSelection } from '../point/PointAnnotationTool';
import {
  createAnnotation,
  deleteAnnotation,
  getAnnotationSettings,
  getPageAnnotationCount,
  getPagePointAnnotations,
  updateAnnotation,
  updateAnnotationSettings,
} from '../../services/message-service';
import { measureDocument, restoreViewportPoint } from '../../services/annotation-position-service';
import type { PointAnnotation, PointPosition } from '../../types/annotation';
import type { StorageSettings } from '../../types/storage';
import type { OverlayState, OverlayTool, PointAnnotationGateway } from '../../types/messages';
import { observeSpaNavigation, type NavigationCleanup } from '../../utils/spa-navigation';
import AnnotationOverlay, {
  type AnnotationEditorView,
  type PointMarkerView,
} from './AnnotationOverlay';

export const OVERLAY_HOST_ID = 'html-memo-extension-overlay-host';

interface OverlayControllerOptions {
  document?: Document;
  window?: Window;
  styles: string;
  loadAnnotationCount?: (url: string) => Promise<number>;
  pointGateway?: PointAnnotationGateway;
}

type EditorState =
  { mode: 'create'; position: PointPosition } | { mode: 'edit'; annotationId: string };

const defaultPointGateway: PointAnnotationGateway = {
  getByPage: getPagePointAnnotations,
  create: createAnnotation,
  update: updateAnnotation,
  delete: deleteAnnotation,
  getSettings: getAnnotationSettings,
  updateSettings: updateAnnotationSettings,
};

const initialSettings: StorageSettings = { defaultAuthor: '', defaultColor: 'yellow' };

function byOldestFirst(left: PointAnnotation, right: PointAnnotation): number {
  const difference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
  return difference === 0 ? left.id.localeCompare(right.id) : difference;
}

export class OverlayController {
  private readonly document: Document;
  private readonly window: Window;
  private readonly styles: string;
  private readonly loadAnnotationCount: (url: string) => Promise<number>;
  private readonly pointGateway: PointAnnotationGateway;
  private readonly pointTool: PointAnnotationTool;
  private root: Root | null = null;
  private host: HTMLElement | null = null;
  private stopNavigationObserver: NavigationCleanup | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private renderFrame: number | null = null;
  private isActive = false;
  private selectedTool: OverlayTool | null = null;
  private annotationCount: number | null = null;
  private pointAnnotations: PointAnnotation[] = [];
  private settings: StorageSettings = { ...initialSettings };
  private editorState: EditorState | null = null;
  private currentUrl: string;
  private statusMessage = '메모 모드가 활성화되었습니다.';
  private requestSequence = 0;

  public constructor(options: OverlayControllerOptions) {
    this.document = options.document ?? document;
    this.window = options.window ?? window;
    this.styles = options.styles;
    this.loadAnnotationCount = options.loadAnnotationCount ?? getPageAnnotationCount;
    this.pointGateway = options.pointGateway ?? defaultPointGateway;
    this.currentUrl = this.window.location.href;
    this.pointTool = new PointAnnotationTool({
      document: this.document,
      window: this.window,
      extensionHostId: OVERLAY_HOST_ID,
      onSelect: (selection) => this.handlePointSelection(selection),
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
    this.editorState = null;
    this.requestSequence += 1;
    this.pointTool.deactivate();
    this.window.removeEventListener('keydown', this.handleKeyDown, true);
    this.window.removeEventListener('scroll', this.scheduleMarkerRender, true);
    this.window.removeEventListener('resize', this.scheduleMarkerRender);
    this.stopNavigationObserver?.();
    this.stopNavigationObserver = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
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
      this.render();
    });
  };

  private handlePointSelection(selection: PointSelection): void {
    if (!this.isActive || this.selectedTool !== 'point' || this.editorState !== null) {
      return;
    }
    this.editorState = { mode: 'create', position: selection.position };
    this.statusMessage = '메모 내용을 입력한 뒤 저장하세요.';
    this.syncPointTool();
    this.render();
  }

  private handleNavigation(url: string): void {
    this.selectedTool = null;
    this.editorState = null;
    this.syncPointTool();
    this.statusMessage = '페이지 이동을 감지해 메모 상태를 갱신합니다.';
    void this.refreshPageState(url);
  }

  private async refreshPageState(url: string): Promise<void> {
    const sequence = ++this.requestSequence;
    this.currentUrl = url;
    this.annotationCount = null;
    this.pointAnnotations = [];
    this.render();

    const [countResult, pointsResult, settingsResult] = await Promise.allSettled([
      this.loadAnnotationCount(url),
      this.pointGateway.getByPage(url),
      this.pointGateway.getSettings(),
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
    if (settingsResult.status === 'fulfilled') {
      this.settings = settingsResult.value;
    }

    const failure = [countResult, pointsResult, settingsResult].find(
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
      const observer = new MutationObserverConstructor(this.scheduleMarkerRender);
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

  private syncPointTool(): void {
    if (this.isActive && this.selectedTool === 'point' && this.editorState === null) {
      this.pointTool.activate();
    } else {
      this.pointTool.deactivate();
    }
  }

  private openEditor(annotationId: string): void {
    if (!this.pointAnnotations.some((annotation) => annotation.id === annotationId)) {
      return;
    }
    this.editorState = { mode: 'edit', annotationId };
    this.statusMessage = '위치 메모를 수정할 수 있습니다.';
    this.syncPointTool();
    this.render();
  }

  private closeEditor(): void {
    this.editorState = null;
    this.statusMessage =
      this.selectedTool === 'point'
        ? '웹페이지에서 메모를 남길 위치를 클릭하세요.'
        : '메모 편집을 취소했습니다.';
    this.syncPointTool();
    this.render();
  }

  private async saveEditor(value: AnnotationEditorValue): Promise<void> {
    const editorState = this.editorState;
    if (editorState === null) {
      return;
    }

    if (editorState.mode === 'create') {
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
    } else {
      const updated = await this.pointGateway.update(editorState.annotationId, value);
      if (updated.type !== 'point') {
        throw new Error('수정된 위치 메모 형식이 올바르지 않습니다.');
      }
      this.pointAnnotations = this.pointAnnotations.map((annotation) =>
        annotation.id === updated.id ? updated : annotation,
      );
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
      : '위치 메모를 저장했습니다.';
    this.syncPointTool();
    this.render();
  }

  private async deleteEditorAnnotation(): Promise<void> {
    if (this.editorState?.mode !== 'edit') {
      return;
    }
    if (!this.window.confirm('이 위치 메모를 삭제하시겠습니까?')) {
      return;
    }

    const annotationId = this.editorState.annotationId;
    const deleted = await this.pointGateway.delete(annotationId);
    if (!deleted) {
      throw new Error('삭제할 위치 메모를 찾지 못했습니다.');
    }
    this.pointAnnotations = this.pointAnnotations.filter(
      (annotation) => annotation.id !== annotationId,
    );
    this.annotationCount = Math.max(0, (this.annotationCount ?? 1) - 1);
    this.editorState = null;
    this.statusMessage = '위치 메모를 삭제했습니다.';
    this.syncPointTool();
    this.render();
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

  private createEditorView(): AnnotationEditorView | null {
    if (this.editorState === null) {
      return null;
    }

    const size = measureDocument(this.document);
    if (this.editorState.mode === 'create') {
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

    const annotationId = this.editorState.annotationId;
    const annotation = this.pointAnnotations.find((candidate) => candidate.id === annotationId);
    if (annotation === undefined) {
      return null;
    }
    const point = restoreViewportPoint(
      annotation.position,
      size,
      this.window.scrollX,
      this.window.scrollY,
    );
    return {
      key: annotation.id,
      ...point,
      initialValue: {
        content: annotation.content,
        author: annotation.author,
        color: annotation.color,
        status: annotation.status,
      },
      isEditing: true,
      onSave: (value) => this.saveEditor(value),
      onCancel: () => this.closeEditor(),
      onDelete: () => this.deleteEditorAnnotation(),
    };
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
        editor={this.createEditorView()}
        onOpenMarker={(annotationId) => this.openEditor(annotationId)}
        onSelectTool={(tool) => {
          this.selectedTool = tool;
          this.editorState = null;
          const labels: Record<OverlayTool, string> = {
            point: '위치 메모',
            text: '텍스트 메모',
            area: '영역 메모',
          };
          this.statusMessage =
            tool === 'point'
              ? '웹페이지에서 메모를 남길 위치를 클릭하세요.'
              : `${labels[tool]} 도구를 선택했습니다.`;
          this.syncPointTool();
          this.render();
        }}
        onShowList={() => {
          this.statusMessage = '메모 목록 기능은 다음 단계에서 구현합니다.';
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
