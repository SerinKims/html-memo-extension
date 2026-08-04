import { useRef, useState, type PointerEvent } from 'react';

import type { AnnotationColor, AnnotationStatus } from '../../types/annotation';

const DRAG_THRESHOLD_PX = 4;

interface PointMarkerProps {
  annotationId: string;
  number: number;
  color: AnnotationColor;
  status: AnnotationStatus;
  left: number;
  top: number;
  onOpen: () => void;
  onMove: (clientX: number, clientY: number) => Promise<void>;
}

export default function PointMarker({
  annotationId,
  number,
  color,
  status,
  left,
  top,
  onOpen,
  onMove,
}: PointMarkerProps) {
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const suppressNextClick = useRef(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) {
      return;
    }
    dragStart.current = { x: event.clientX, y: event.clientY };
    didDrag.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>): void {
    const start = dragStart.current;
    if (start === null) {
      return;
    }
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (!didDrag.current && Math.hypot(x, y) < DRAG_THRESHOLD_PX) {
      return;
    }
    didDrag.current = true;
    event.preventDefault();
    setDragOffset({ x, y });
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>): void {
    if (dragStart.current === null) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragStart.current = null;
    if (didDrag.current) {
      suppressNextClick.current = true;
      void onMove(event.clientX, event.clientY)
        .catch(() => undefined)
        .finally(() => setDragOffset({ x: 0, y: 0 }));
    }
  }

  function handlePointerCancel(): void {
    dragStart.current = null;
    didDrag.current = false;
    setDragOffset({ x: 0, y: 0 });
  }

  function handleClick(): void {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    onOpen();
  }

  return (
    <button
      type="button"
      className={`point-marker point-marker--${color} ${status === 'resolved' ? 'is-resolved' : ''} ${dragOffset.x === 0 && dragOffset.y === 0 ? '' : 'is-dragging'}`}
      style={{ left: left + dragOffset.x, top: top + dragOffset.y }}
      aria-label={`위치 메모 ${number} 열기`}
      title="클릭해서 열기 · 드래그해서 이동"
      data-annotation-id={annotationId}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
    >
      <span>{number}</span>
    </button>
  );
}
