import type { ViewportArea } from '../../services/area-position-service';

type AreaSelectionOverlayProps = ViewportArea;

export default function AreaSelectionOverlay({
  left,
  top,
  width,
  height,
}: AreaSelectionOverlayProps) {
  return (
    <div
      className="area-selection-overlay"
      style={{ left, top, width, height }}
      aria-hidden="true"
      data-html-memo-extension="area-selection"
    />
  );
}
