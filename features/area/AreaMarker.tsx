import type { AnnotationColor, AnnotationStatus } from '../../types/annotation';

interface AreaMarkerProps {
  annotationId: string;
  number: number;
  showNumber?: boolean;
  color: AnnotationColor;
  status: AnnotationStatus;
  left: number;
  top: number;
  width: number;
  height: number;
  onOpen: () => void;
}

export default function AreaMarker({
  annotationId,
  number,
  showNumber = true,
  color,
  status,
  left,
  top,
  width,
  height,
  onOpen,
}: AreaMarkerProps) {
  return (
    <button
      type="button"
      className={`area-marker area-marker--${color} ${status === 'resolved' ? 'is-resolved' : ''}`}
      style={{ left, top, width, height }}
      aria-label={`영역 메모${showNumber ? ` ${number}` : ''} 열기`}
      title="클릭해서 영역 메모 열기"
      data-annotation-id={annotationId}
      onClick={onOpen}
    >
      <span>{showNumber ? number : ''}</span>
    </button>
  );
}
