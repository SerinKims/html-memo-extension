import { useState, type FormEvent } from 'react';

import { ANNOTATION_COLORS, type AnnotationColor } from '../../types/annotation';
import type { StorageSettings } from '../../types/storage';

const COLOR_LABELS: Record<AnnotationColor, string> = {
  yellow: '노랑',
  red: '빨강',
  green: '초록',
  blue: '파랑',
  purple: '보라',
};

interface SettingsPanelProps {
  settings: StorageSettings | null;
  onSave: (settings: StorageSettings) => Promise<void>;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const [value, setValue] = useState<StorageSettings | null>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(settings === null ? '설정을 불러오는 중입니다.' : '');
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (value === null) {
      return;
    }
    if (value.htmlFilenamePattern.trim().length === 0) {
      setMessage('HTML 파일명 규칙을 입력하세요.');
      setIsError(true);
      return;
    }
    setIsSaving(true);
    setIsError(false);
    setMessage('설정을 저장하는 중입니다.');
    try {
      await onSave({ ...value, defaultAuthor: value.defaultAuthor.trim() });
      setMessage('설정을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '설정을 저장하지 못했습니다.');
      setIsError(true);
    } finally {
      setIsSaving(false);
    }
  }

  if (value === null) {
    return (
      <section className="popup-settings" aria-label="설정">
        <p role="status">{message}</p>
        <button type="button" onClick={onClose}>
          돌아가기
        </button>
      </section>
    );
  }

  return (
    <section className="popup-settings" aria-label="설정">
      <header>
        <div>
          <p>환경 설정</p>
          <h2>메모 기본값과 내보내기</h2>
        </div>
        <button type="button" onClick={onClose} disabled={isSaving}>
          돌아가기
        </button>
      </header>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label>
          기본 작성자 이름
          <input
            value={value.defaultAuthor}
            autoComplete="name"
            onChange={(event) => setValue({ ...value, defaultAuthor: event.target.value })}
          />
        </label>
        <label>
          기본 메모 색상
          <select
            value={value.defaultColor}
            onChange={(event) =>
              setValue({ ...value, defaultColor: event.target.value as AnnotationColor })
            }
          >
            {ANNOTATION_COLORS.map((color) => (
              <option key={color} value={color}>
                {COLOR_LABELS[color]}
              </option>
            ))}
          </select>
        </label>
        <label>
          HTML 파일명 규칙
          <input
            required
            value={value.htmlFilenamePattern}
            onChange={(event) => setValue({ ...value, htmlFilenamePattern: event.target.value })}
          />
          <small>
            사용 가능: {'{title}'}, {'{host}'}, {'{date}'}, {'{datetime}'}
          </small>
        </label>
        <label className="popup-settings__check">
          <input
            type="checkbox"
            checked={value.includeResolvedInExport}
            onChange={(event) =>
              setValue({ ...value, includeResolvedInExport: event.target.checked })
            }
          />
          HTML 검토본에 해결된 메모 포함
        </label>
        <label className="popup-settings__check">
          <input
            type="checkbox"
            checked={value.showPinNumbers}
            onChange={(event) => setValue({ ...value, showPinNumbers: event.target.checked })}
          />
          웹페이지 핀 번호 표시
        </label>
        <p
          className={isError ? 'is-error' : ''}
          role={isError ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message}
        </p>
        <button type="submit" className="popup-primary" disabled={isSaving}>
          {isSaving ? '저장 중' : '설정 저장'}
        </button>
      </form>
    </section>
  );
}
