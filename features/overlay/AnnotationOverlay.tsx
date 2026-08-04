import type { OverlayTool } from '../../types/messages';
import Toolbar from './Toolbar';

interface AnnotationOverlayProps {
  annotationCount: number | null;
  selectedTool: OverlayTool | null;
  statusMessage: string;
  onSelectTool: (tool: OverlayTool) => void;
  onShowList: () => void;
  onSaveHtml: () => void;
  onExit: () => void;
}

export default function AnnotationOverlay({
  annotationCount,
  selectedTool,
  statusMessage,
  onSelectTool,
  onShowList,
  onSaveHtml,
  onExit,
}: AnnotationOverlayProps) {
  return (
    <aside className="memo-overlay" aria-label="웹 메모 모드">
      <section className="memo-status-card" aria-label="메모 모드 상태">
        <div className="memo-status-card__mode">
          <span className="memo-status-card__dot" aria-hidden="true" />
          <strong>메모 모드 사용 중</strong>
        </div>
        <span className="memo-status-card__count">
          현재 페이지 메모 {annotationCount === null ? '확인 중' : `${annotationCount}개`}
        </span>
        <span className="memo-status-card__hint">ESC 키로 종료</span>
      </section>

      <Toolbar
        selectedTool={selectedTool}
        onSelectTool={onSelectTool}
        onShowList={onShowList}
        onSaveHtml={onSaveHtml}
        onExit={onExit}
      />

      <p className="memo-overlay__notice" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </aside>
  );
}
