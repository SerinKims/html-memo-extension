import { useState, type FormEvent } from 'react';

import {
  ANNOTATION_COLORS,
  type AnnotationColor,
  type AnnotationStatus,
} from '../../types/annotation';

export interface AnnotationEditorValue {
  content: string;
  author: string;
  color: AnnotationColor;
  status: AnnotationStatus;
}

interface AnnotationEditorProps {
  initialValue: AnnotationEditorValue;
  isEditing: boolean;
  onSave: (value: AnnotationEditorValue) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  kindLabel?: string;
}

const COLOR_LABELS: Record<AnnotationColor, string> = {
  yellow: '노랑',
  red: '빨강',
  green: '초록',
  blue: '파랑',
  purple: '보라',
};

export default function AnnotationEditor({
  initialValue,
  isEditing,
  onSave,
  onCancel,
  onDelete,
  kindLabel = '위치 메모',
}: AnnotationEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (value.content.trim().length === 0) {
      setError('메모 내용을 입력하세요.');
      return;
    }

    setIsBusy(true);
    setError('');
    try {
      await onSave({ ...value, content: value.content.trim(), author: value.author.trim() });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '메모를 저장하지 못했습니다.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (onDelete === undefined) {
      return;
    }
    setIsBusy(true);
    setError('');
    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '메모를 삭제하지 못했습니다.');
      setIsBusy(false);
    }
  }

  return (
    <form className="annotation-editor" onSubmit={(event) => void handleSubmit(event)}>
      <header className="annotation-editor__header">
        <strong>{isEditing ? `${kindLabel} 수정` : `새 ${kindLabel}`}</strong>
        <button type="button" aria-label="메모 편집 닫기" onClick={onCancel} disabled={isBusy}>
          ×
        </button>
      </header>

      <label>
        <span>작성자</span>
        <input
          name="author"
          value={value.author}
          autoComplete="off"
          onChange={(event) => setValue((current) => ({ ...current, author: event.target.value }))}
        />
      </label>

      <label>
        <span>
          메모 내용 <em>필수</em>
        </span>
        <textarea
          name="content"
          required
          autoFocus
          rows={5}
          value={value.content}
          onChange={(event) => setValue((current) => ({ ...current, content: event.target.value }))}
        />
      </label>

      <fieldset>
        <legend>색상</legend>
        <div className="annotation-editor__colors">
          {ANNOTATION_COLORS.map((color) => (
            <label key={color} title={COLOR_LABELS[color]}>
              <input
                type="radio"
                name="color"
                value={color}
                checked={value.color === color}
                onChange={() => setValue((current) => ({ ...current, color }))}
              />
              <span className={`color-swatch color-swatch--${color}`}>
                <span className="sr-only">{COLOR_LABELS[color]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {isEditing ? (
        <label className="annotation-editor__resolved">
          <input
            type="checkbox"
            checked={value.status === 'resolved'}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                status: event.target.checked ? 'resolved' : 'open',
              }))
            }
          />
          해결됨
        </label>
      ) : null}

      {error.length > 0 ? (
        <p className="annotation-editor__error" role="alert">
          {error}
        </p>
      ) : null}

      <footer className="annotation-editor__actions">
        {isEditing && onDelete !== undefined ? (
          <button
            type="button"
            className="is-delete"
            onClick={() => void handleDelete()}
            disabled={isBusy}
          >
            삭제
          </button>
        ) : null}
        <span />
        <button type="button" onClick={onCancel} disabled={isBusy}>
          취소
        </button>
        <button type="submit" className="is-primary" disabled={isBusy}>
          {isBusy ? '저장 중' : '저장'}
        </button>
      </footer>
    </form>
  );
}
