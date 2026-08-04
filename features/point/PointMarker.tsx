import type { AnnotationColor, AnnotationStatus } from '../../types/annotation';

interface PointMarkerProps {
  annotationId: string;
  number: number;
  color: AnnotationColor;
  status: AnnotationStatus;
  left: number;
  top: number;
  onOpen: () => void;
}

export default function PointMarker({
  annotationId,
  number,
  color,
  status,
  left,
  top,
  onOpen,
}: PointMarkerProps) {
  return (
    <button
      type="button"
      className={`point-marker point-marker--${color} ${status === 'resolved' ? 'is-resolved' : ''}`}
      style={{ left, top }}
      aria-label={`위치 메모 ${number} 열기`}
      data-annotation-id={annotationId}
      onClick={onOpen}
    >
      <span>{number}</span>
    </button>
  );
}
