import { useState, type FormEvent } from 'react';

import {
  ANNOTATION_COLORS,
  type Annotation,
  type AnnotationChanges,
  type AnnotationColor,
} from '../../types/annotation';

const TYPE_LABELS: Record<Annotation['type'], string> = {
  point: '위치',
  text: '텍스트',
  area: '영역',
};

const COLOR_LABELS: Record<AnnotationColor, string> = {
  yellow: '노랑',
  red: '빨강',
  green: '초록',
  blue: '파랑',
  purple: '보라',
};

interface AnnotationListItemProps {
  annotation: Annotation;
  number: number;
  showPinNumber: boolean;
  isTextPlaced: boolean;
  onFocus: () => void;
  onUpdate: (changes: AnnotationChanges) => Promise<void>;
  onDelete: () => Promise<void>;
  onStatus: (message: string, isError?: boolean) => void;
}

export default function AnnotationListItem({
  annotation,
  number,
  showPinNumber,
  isTextPlaced,
  onFocus,
  onUpdate,
  onDelete,
  onStatus,
}: AnnotationListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [content, setContent] = useState(annotation.content);
  const [author, setAuthor] = useState(annotation.author);
  const [color, setColor] = useState(annotation.color);

  async function runAction(
    action: () => Promise<void>,
    pending: string,
    success: string,
  ): Promise<boolean> {
    setIsBusy(true);
    onStatus(pending);
    try {
      await action();
      onStatus(success);
      return true;
    } catch (error) {
      onStatus(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.', true);
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      onStatus('메모 내용을 입력하세요.', true);
      return;
    }
    const saved = await runAction(
      () => onUpdate({ content: trimmedContent, author: author.trim(), color }),
      '메모를 저장하는 중입니다.',
      '메모를 수정했습니다.',
    );
    if (saved) {
      setIsEditing(false);
    }
  }

  async function handleStatusToggle(): Promise<void> {
    const nextStatus = annotation.status === 'open' ? 'resolved' : 'open';
    await runAction(
      () => onUpdate({ status: nextStatus }),
      nextStatus === 'resolved' ? '메모를 해결 처리하는 중입니다.' : '메모를 다시 여는 중입니다.',
      nextStatus === 'resolved' ? '메모를 해결됨으로 표시했습니다.' : '메모를 다시 열었습니다.',
    );
  }

  async function handleDelete(): Promise<void> {
    if (!window.confirm('이 메모를 삭제하시겠습니까? 삭제한 메모는 복구할 수 없습니다.')) {
      return;
    }
    await runAction(onDelete, '메모를 삭제하는 중입니다.', '메모를 삭제했습니다.');
  }

  return (
    <article
      className={`annotation-list-item annotation-list-item--${annotation.color}`}
      data-status={annotation.status}
    >
      <button type="button" className="annotation-list-item__summary" onClick={onFocus}>
        <span className="annotation-list-item__meta">
          <span>
            {showPinNumber ? `${number}. ` : ''}
            {TYPE_LABELS[annotation.type]} 메모
          </span>
          <span>{annotation.status === 'resolved' ? '해결됨' : '열림'}</span>
        </span>
        <strong>{annotation.content}</strong>
        <span className="annotation-list-item__submeta">
          {annotation.author || '작성자 없음'} ·{' '}
          {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(
            new Date(annotation.createdAt),
          )}
        </span>
        {annotation.type === 'text' ? (
          <>
            <span className="annotation-list-item__quote">“{annotation.anchor.exactText}”</span>
            <span
              className={
                isTextPlaced ? 'annotation-list-item__placed' : 'annotation-list-item__unplaced'
              }
            >
              {isTextPlaced ? '배치됨' : '미배치 · 원문 위치를 찾지 못함'}
            </span>
          </>
        ) : null}
      </button>

      {isEditing ? (
        <form
          className="annotation-list-item__editor"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label>
            작성자
            <input
              value={author}
              disabled={isBusy}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </label>
          <label>
            메모 내용
            <textarea
              required
              autoFocus
              rows={4}
              value={content}
              disabled={isBusy}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
          <label>
            색상
            <select
              value={color}
              disabled={isBusy}
              onChange={(event) => setColor(event.target.value as AnnotationColor)}
            >
              {ANNOTATION_COLORS.map((option) => (
                <option key={option} value={option}>
                  {COLOR_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <div className="annotation-list-item__actions">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setContent(annotation.content);
                setAuthor(annotation.author);
                setColor(annotation.color);
                setIsEditing(false);
              }}
            >
              취소
            </button>
            <button type="submit" className="is-primary" disabled={isBusy}>
              {isBusy ? '저장 중' : '변경사항 저장'}
            </button>
          </div>
        </form>
      ) : (
        <div className="annotation-list-item__actions">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setContent(annotation.content);
              setAuthor(annotation.author);
              setColor(annotation.color);
              setIsEditing(true);
            }}
          >
            수정
          </button>
          <button type="button" disabled={isBusy} onClick={() => void handleStatusToggle()}>
            {annotation.status === 'open' ? '해결됨으로 표시' : '다시 열기'}
          </button>
          <button
            type="button"
            className="is-danger"
            disabled={isBusy}
            onClick={() => void handleDelete()}
          >
            삭제
          </button>
        </div>
      )}
    </article>
  );
}
