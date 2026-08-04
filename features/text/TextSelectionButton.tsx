interface TextSelectionButtonProps {
  left: number;
  top: number;
  onAdd: () => void;
}

export default function TextSelectionButton({ left, top, onAdd }: TextSelectionButtonProps) {
  return (
    <button
      type="button"
      className="text-selection-button"
      style={{
        left: Math.max(8, Math.min(left, window.innerWidth - 104)),
        top: Math.max(8, Math.min(top, window.innerHeight - 44)),
      }}
      data-html-memo-extension="text-selection-button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onAdd}
    >
      메모 추가
    </button>
  );
}
