import AnnotationEditor, { type AnnotationEditorValue } from './AnnotationEditor';

interface AnnotationPopoverProps {
  left: number;
  top: number;
  initialValue: AnnotationEditorValue;
  isEditing: boolean;
  onSave: (value: AnnotationEditorValue) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  kindLabel?: string;
}

export default function AnnotationPopover({ left, top, ...editorProps }: AnnotationPopoverProps) {
  return (
    <section
      className="annotation-popover"
      style={{
        left: Math.max(12, Math.min(left + 14, window.innerWidth - 340)),
        top: Math.max(12, Math.min(top + 14, window.innerHeight - 430)),
      }}
      role="dialog"
      aria-label={
        editorProps.isEditing
          ? `${editorProps.kindLabel ?? '위치 메모'} 수정`
          : `새 ${editorProps.kindLabel ?? '위치 메모'}`
      }
    >
      <AnnotationEditor {...editorProps} />
    </section>
  );
}
