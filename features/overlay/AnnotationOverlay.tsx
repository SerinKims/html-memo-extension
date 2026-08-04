import AnnotationPopover from '../editor/AnnotationPopover';
import type { AnnotationEditorValue } from '../editor/AnnotationEditor';
import PointMarker from '../point/PointMarker';
import AreaMarker from '../area/AreaMarker';
import AreaSelectionOverlay from '../area/AreaSelectionOverlay';
import type { ViewportArea } from '../../services/area-position-service';
import type { AnnotationColor, AnnotationStatus } from '../../types/annotation';
import type { OverlayTool } from '../../types/messages';
import Toolbar from './Toolbar';
import TextSelectionButton from '../text/TextSelectionButton';

export interface PointMarkerView {
  annotationId: string;
  number: number;
  color: AnnotationColor;
  status: AnnotationStatus;
  left: number;
  top: number;
}

export interface AreaMarkerView extends ViewportArea {
  annotationId: string;
  number: number;
  color: AnnotationColor;
  status: AnnotationStatus;
}

export interface AnnotationEditorView {
  key: string;
  left: number;
  top: number;
  initialValue: AnnotationEditorValue;
  isEditing: boolean;
  onSave: (value: AnnotationEditorValue) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  kindLabel?: string;
}

export interface TextSelectionButtonView {
  left: number;
  top: number;
  onAdd: () => void;
}

export interface TextMemoListItemView {
  annotationId: string;
  exactText: string;
  content: string;
  isPlaced: boolean;
}

interface AnnotationOverlayProps {
  annotationCount: number | null;
  selectedTool: OverlayTool | null;
  statusMessage: string;
  markers: PointMarkerView[];
  areaMarkers: AreaMarkerView[];
  areaPreview: ViewportArea | null;
  editor: AnnotationEditorView | null;
  textSelection: TextSelectionButtonView | null;
  textMemoList: TextMemoListItemView[] | null;
  onOpenMarker: (annotationId: string) => void;
  onOpenAreaMarker: (annotationId: string) => void;
  onMoveMarker: (annotationId: string, clientX: number, clientY: number) => Promise<void>;
  onOpenTextMemo: (annotationId: string) => void;
  onSelectTool: (tool: OverlayTool) => void;
  onShowList: () => void;
  onSaveHtml: () => void;
  onExit: () => void;
}

export default function AnnotationOverlay({
  annotationCount,
  selectedTool,
  statusMessage,
  markers,
  areaMarkers,
  areaPreview,
  editor,
  textSelection,
  textMemoList,
  onOpenMarker,
  onOpenAreaMarker,
  onMoveMarker,
  onOpenTextMemo,
  onSelectTool,
  onShowList,
  onSaveHtml,
  onExit,
}: AnnotationOverlayProps) {
  return (
    <aside className="memo-overlay" aria-label="웹 메모 모드">
      {markers.map((marker) => (
        <PointMarker
          key={marker.annotationId}
          {...marker}
          onOpen={() => onOpenMarker(marker.annotationId)}
          onMove={(clientX, clientY) => onMoveMarker(marker.annotationId, clientX, clientY)}
        />
      ))}

      {areaMarkers.map((marker) => (
        <AreaMarker
          key={marker.annotationId}
          {...marker}
          onOpen={() => onOpenAreaMarker(marker.annotationId)}
        />
      ))}
      {areaPreview === null ? null : <AreaSelectionOverlay {...areaPreview} />}

      {editor === null ? null : <AnnotationPopover {...editor} />}
      {textSelection === null ? null : <TextSelectionButton {...textSelection} />}

      {textMemoList === null ? null : (
        <section className="text-memo-list" aria-label="텍스트 메모 목록">
          <header>
            <strong>텍스트 메모</strong>
            <span>{textMemoList.length}개</span>
          </header>
          {textMemoList.length === 0 ? (
            <p>현재 페이지에 텍스트 메모가 없습니다.</p>
          ) : (
            <ul>
              {textMemoList.map((item) => (
                <li key={item.annotationId}>
                  <button type="button" onClick={() => onOpenTextMemo(item.annotationId)}>
                    <span className="text-memo-list__quote">“{item.exactText}”</span>
                    <span>{item.content}</span>
                    <em className={item.isPlaced ? 'is-placed' : 'is-unplaced'}>
                      {item.isPlaced ? '배치됨' : '미배치 · 원문 위치를 찾지 못함'}
                    </em>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
