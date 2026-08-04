import type { PointPosition } from '../types/annotation';

export interface DocumentSize {
  width: number;
  height: number;
}

export interface ViewportPoint {
  left: number;
  top: number;
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function measureDocument(document: Document): DocumentSize {
  const root = document.documentElement;
  const body = document.body;

  return {
    width: Math.max(
      root.scrollWidth,
      root.clientWidth,
      body?.scrollWidth ?? 0,
      body?.clientWidth ?? 0,
      1,
    ),
    height: Math.max(
      root.scrollHeight,
      root.clientHeight,
      body?.scrollHeight ?? 0,
      body?.clientHeight ?? 0,
      1,
    ),
  };
}

export function calculatePointPosition(
  pageX: number,
  pageY: number,
  documentSize: DocumentSize,
): PointPosition {
  return {
    xRatio: clampRatio(pageX / Math.max(documentSize.width, 1)),
    yRatio: clampRatio(pageY / Math.max(documentSize.height, 1)),
  };
}

export function restoreDocumentPoint(
  position: PointPosition,
  documentSize: DocumentSize,
): ViewportPoint {
  return {
    left: clampRatio(position.xRatio) * documentSize.width,
    top: clampRatio(position.yRatio) * documentSize.height,
  };
}

export function restoreViewportPoint(
  position: PointPosition,
  documentSize: DocumentSize,
  scrollX: number,
  scrollY: number,
): ViewportPoint {
  const point = restoreDocumentPoint(position, documentSize);
  return {
    left: point.left - scrollX,
    top: point.top - scrollY,
  };
}
