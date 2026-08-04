import type { Annotation, AnnotationChanges } from '../../types/annotation';
import AnnotationListItem from './AnnotationListItem';

interface AnnotationListProps {
  annotations: Annotation[];
  orderedAnnotations: Annotation[];
  showPinNumbers: boolean;
  unplacedTextIds: ReadonlySet<string>;
  onFocus: (annotation: Annotation) => void;
  onUpdate: (id: string, changes: AnnotationChanges) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onStatus: (message: string, isError?: boolean) => void;
}

export default function AnnotationList({
  annotations,
  orderedAnnotations,
  showPinNumbers,
  unplacedTextIds,
  onFocus,
  onUpdate,
  onDelete,
  onStatus,
}: AnnotationListProps) {
  if (annotations.length === 0) {
    return (
      <div className="annotation-list__empty">
        <strong>표시할 메모가 없습니다.</strong>
        <p>검색어나 필터를 바꾸거나, 도구 모음에서 새 메모를 추가해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="annotation-list" role="list" aria-label="현재 페이지 메모">
      {annotations.map((annotation) => (
        <div role="listitem" key={annotation.id}>
          <AnnotationListItem
            annotation={annotation}
            number={orderedAnnotations.findIndex((item) => item.id === annotation.id) + 1}
            showPinNumber={showPinNumbers}
            isTextPlaced={annotation.type !== 'text' || !unplacedTextIds.has(annotation.id)}
            onFocus={() => onFocus(annotation)}
            onUpdate={(changes) => onUpdate(annotation.id, changes)}
            onDelete={() => onDelete(annotation.id)}
            onStatus={onStatus}
          />
        </div>
      ))}
    </div>
  );
}
