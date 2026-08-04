import type { AreaPosition } from '../types/annotation';
import type { DocumentSize } from './annotation-position-service';

export interface DocumentArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type ViewportArea = DocumentArea;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Creates a normalized document rectangle, including reverse-direction drags. */
export function normalizeDocumentArea(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  documentSize: DocumentSize,
): DocumentArea {
  const boundedStartX = clamp(startX, 0, documentSize.width);
  const boundedStartY = clamp(startY, 0, documentSize.height);
  const boundedEndX = clamp(endX, 0, documentSize.width);
  const boundedEndY = clamp(endY, 0, documentSize.height);

  return {
    left: Math.min(boundedStartX, boundedEndX),
    top: Math.min(boundedStartY, boundedEndY),
    width: Math.abs(boundedEndX - boundedStartX),
    height: Math.abs(boundedEndY - boundedStartY),
  };
}

export function calculateAreaPosition(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  documentSize: DocumentSize,
): AreaPosition {
  const size = {
    width: Math.max(1, documentSize.width),
    height: Math.max(1, documentSize.height),
  };
  const area = normalizeDocumentArea(startX, startY, endX, endY, size);

  return {
    xRatio: area.left / size.width,
    yRatio: area.top / size.height,
    widthRatio: area.width / size.width,
    heightRatio: area.height / size.height,
  };
}

export function restoreDocumentArea(
  position: AreaPosition,
  documentSize: DocumentSize,
): DocumentArea {
  const xRatio = clamp(position.xRatio, 0, 1);
  const yRatio = clamp(position.yRatio, 0, 1);
  const widthRatio = clamp(position.widthRatio, 0, 1 - xRatio);
  const heightRatio = clamp(position.heightRatio, 0, 1 - yRatio);

  return {
    left: xRatio * documentSize.width,
    top: yRatio * documentSize.height,
    width: widthRatio * documentSize.width,
    height: heightRatio * documentSize.height,
  };
}

export function restoreViewportArea(
  position: AreaPosition,
  documentSize: DocumentSize,
  scrollX: number,
  scrollY: number,
): ViewportArea {
  const area = restoreDocumentArea(position, documentSize);
  return { ...area, left: area.left - scrollX, top: area.top - scrollY };
}
