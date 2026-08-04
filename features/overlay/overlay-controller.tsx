import { createRoot, type Root } from 'react-dom/client';

import { getPageAnnotationCount } from '../../services/message-service';
import type { OverlayState, OverlayTool } from '../../types/messages';
import { observeSpaNavigation, type NavigationCleanup } from '../../utils/spa-navigation';
import AnnotationOverlay from './AnnotationOverlay';

export const OVERLAY_HOST_ID = 'html-memo-extension-overlay-host';

interface OverlayControllerOptions {
  document?: Document;
  window?: Window;
  styles: string;
  loadAnnotationCount?: (url: string) => Promise<number>;
}

export class OverlayController {
  private readonly document: Document;
  private readonly window: Window;
  private readonly styles: string;
  private readonly loadAnnotationCount: (url: string) => Promise<number>;
  private root: Root | null = null;
  private host: HTMLElement | null = null;
  private stopNavigationObserver: NavigationCleanup | null = null;
  private isActive = false;
  private selectedTool: OverlayTool | null = null;
  private annotationCount: number | null = null;
  private currentUrl: string;
  private statusMessage = '메모 모드가 활성화되었습니다.';
  private requestSequence = 0;

  public constructor(options: OverlayControllerOptions) {
    this.document = options.document ?? document;
    this.window = options.window ?? window;
    this.styles = options.styles;
    this.loadAnnotationCount = options.loadAnnotationCount ?? getPageAnnotationCount;
    this.currentUrl = this.window.location.href;
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
    this.requestSequence += 1;
    this.window.removeEventListener('keydown', this.handleKeyDown, true);
    this.stopNavigationObserver?.();
    this.stopNavigationObserver = null;
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
    if (event.key === 'Escape') {
      this.deactivate();
    }
  };

  private handleNavigation(url: string): void {
    this.selectedTool = null;
    this.statusMessage = '페이지 이동을 감지해 메모 상태를 갱신합니다.';
    void this.refreshPageState(url);
  }

  private async refreshPageState(url: string): Promise<void> {
    const sequence = ++this.requestSequence;
    this.currentUrl = url;
    this.annotationCount = null;
    this.render();

    try {
      const count = await this.loadAnnotationCount(url);
      if (!this.isActive || sequence !== this.requestSequence) {
        return;
      }
      this.annotationCount = count;
      this.render();
    } catch (error) {
      if (!this.isActive || sequence !== this.requestSequence) {
        return;
      }
      this.statusMessage =
        error instanceof Error ? error.message : '현재 페이지의 메모 수를 확인하지 못했습니다.';
      this.render();
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

  private render(): void {
    if (!this.isActive || this.root === null) {
      return;
    }

    this.root.render(
      <AnnotationOverlay
        annotationCount={this.annotationCount}
        selectedTool={this.selectedTool}
        statusMessage={this.statusMessage}
        onSelectTool={(tool) => {
          this.selectedTool = tool;
          const labels: Record<OverlayTool, string> = {
            point: '위치 메모',
            text: '텍스트 메모',
            area: '영역 메모',
          };
          this.statusMessage = `${labels[tool]} 도구를 선택했습니다.`;
          this.render();
        }}
        onShowList={() => {
          this.statusMessage = '메모 목록 기능은 다음 단계에서 구현됩니다.';
          this.render();
        }}
        onSaveHtml={() => {
          this.statusMessage = 'HTML 저장 기능은 다음 단계에서 구현됩니다.';
          this.render();
        }}
        onExit={() => queueMicrotask(() => this.deactivate())}
      />,
    );
  }
}
