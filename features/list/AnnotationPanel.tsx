import { useMemo, useState } from 'react';

import type {
  Annotation,
  AnnotationChanges,
  AnnotationStatus,
  AnnotationType,
} from '../../types/annotation';
import AnnotationList from './AnnotationList';

type SortDirection = 'newest' | 'oldest';

interface AnnotationPanelProps {
  annotations: Annotation[];
  annotationsVisible: boolean;
  showPinNumbers: boolean;
  unplacedTextIds: ReadonlySet<string>;
  onClose: () => void;
  onToggleVisibility: () => void;
  onFocus: (annotation: Annotation) => void;
  onUpdate: (id: string, changes: AnnotationChanges) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function AnnotationPanel({
  annotations,
  annotationsVisible,
  showPinNumbers,
  unplacedTextIds,
  onClose,
  onToggleVisibility,
  onFocus,
  onUpdate,
  onDelete,
}: AnnotationPanelProps) {
  const [typeFilter, setTypeFilter] = useState<AnnotationType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AnnotationStatus | 'all'>('all');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortDirection>('newest');
  const [status, setStatus] = useState('메모 목록을 열었습니다.');
  const [statusIsError, setStatusIsError] = useState(false);

  const orderedAnnotations = useMemo(
    () =>
      annotations.toSorted((left, right) => {
        const difference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
        return difference === 0 ? right.id.localeCompare(left.id) : difference;
      }),
    [annotations],
  );
  const authors = useMemo(
    () => [...new Set(annotations.map((annotation) => annotation.author).filter(Boolean))].sort(),
    [annotations],
  );
  const filteredAnnotations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko');
    const result = annotations.filter((annotation) => {
      const textAnchor = annotation.type === 'text' ? annotation.anchor.exactText : '';
      return (
        (typeFilter === 'all' || annotation.type === typeFilter) &&
        (statusFilter === 'all' || annotation.status === statusFilter) &&
        (authorFilter === 'all' || annotation.author === authorFilter) &&
        (normalizedQuery.length === 0 ||
          `${annotation.content} ${annotation.author} ${textAnchor}`
            .toLocaleLowerCase('ko')
            .includes(normalizedQuery))
      );
    });
    return result.toSorted((left, right) => {
      const difference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
      return sort === 'oldest' ? difference : -difference;
    });
  }, [annotations, authorFilter, query, sort, statusFilter, typeFilter]);

  const openCount = annotations.filter((annotation) => annotation.status === 'open').length;
  const resolvedCount = annotations.length - openCount;

  function reportStatus(message: string, isError = false): void {
    setStatus(message);
    setStatusIsError(isError);
  }

  return (
    <section className="annotation-panel" aria-label="현재 페이지 메모 패널">
      <header className="annotation-panel__header">
        <div>
          <strong>현재 페이지 메모</strong>
          <span>{annotations.length}개</span>
        </div>
        <button type="button" onClick={onClose}>
          패널 닫기
        </button>
      </header>

      <dl className="annotation-panel__stats" aria-label="메모 상태 요약">
        <div>
          <dt>전체</dt>
          <dd>{annotations.length}</dd>
        </div>
        <div>
          <dt>열림</dt>
          <dd>{openCount}</dd>
        </div>
        <div>
          <dt>해결됨</dt>
          <dd>{resolvedCount}</dd>
        </div>
      </dl>

      <button
        type="button"
        className="annotation-panel__visibility"
        aria-pressed={!annotationsVisible}
        onClick={() => {
          onToggleVisibility();
          reportStatus(
            annotationsVisible
              ? '웹페이지의 모든 메모를 숨겼습니다.'
              : '웹페이지의 모든 메모를 표시했습니다.',
          );
        }}
      >
        {annotationsVisible ? '모든 메모 숨기기' : '모든 메모 표시하기'}
      </button>

      <div className="annotation-panel__filters">
        <label className="annotation-panel__search">
          <span>메모 검색</span>
          <input
            type="search"
            placeholder="내용, 작성자, 선택 텍스트 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="annotation-panel__filter-grid">
          <label>
            유형
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as AnnotationType | 'all')}
            >
              <option value="all">모든 유형</option>
              <option value="point">위치</option>
              <option value="text">텍스트</option>
              <option value="area">영역</option>
            </select>
          </label>
          <label>
            상태
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AnnotationStatus | 'all')}
            >
              <option value="all">모든 상태</option>
              <option value="open">열림</option>
              <option value="resolved">해결됨</option>
            </select>
          </label>
          <label>
            작성자
            <select value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}>
              <option value="all">모든 작성자</option>
              {authors.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
          </label>
          <label>
            생성일 정렬
            <select value={sort} onChange={(event) => setSort(event.target.value as SortDirection)}>
              <option value="newest">최신순</option>
              <option value="oldest">오래된순</option>
            </select>
          </label>
        </div>
      </div>

      <p className="annotation-panel__result">검색 결과 {filteredAnnotations.length}개</p>
      <AnnotationList
        annotations={filteredAnnotations}
        orderedAnnotations={orderedAnnotations.toReversed()}
        showPinNumbers={showPinNumbers}
        unplacedTextIds={unplacedTextIds}
        onFocus={onFocus}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onStatus={reportStatus}
      />
      <p
        className={`annotation-panel__status ${statusIsError ? 'is-error' : ''}`}
        role={statusIsError ? 'alert' : 'status'}
        aria-live="polite"
      >
        {status}
      </p>
    </section>
  );
}
