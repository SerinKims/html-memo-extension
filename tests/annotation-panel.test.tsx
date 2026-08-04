import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AnnotationPanel from '../features/list/AnnotationPanel';
import type { Annotation } from '../types/annotation';

const annotations: Annotation[] = [
  {
    id: 'point-1',
    pageKey: 'page',
    originalUrl: 'https://example.com',
    pageTitle: '문서',
    type: 'point',
    content: '첫 번째 검토',
    author: '민지',
    color: 'yellow',
    status: 'open',
    position: { xRatio: 0.1, yRatio: 0.2 },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'text-1',
    pageKey: 'page',
    originalUrl: 'https://example.com',
    pageTitle: '문서',
    type: 'text',
    content: '문구 수정 필요',
    author: '준호',
    color: 'blue',
    status: 'resolved',
    anchor: { exactText: '선택 문구', prefixText: '', suffixText: '' },
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  },
];

describe('AnnotationPanel', () => {
  it('요약 수치와 검색·유형 필터를 제공한다', () => {
    render(
      <AnnotationPanel
        annotations={annotations}
        annotationsVisible
        showPinNumbers
        unplacedTextIds={new Set()}
        onClose={vi.fn()}
        onToggleVisibility={vi.fn()}
        onFocus={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const summary = within(screen.getByLabelText('메모 상태 요약'));
    expect(summary.getByText('전체').parentElement).toHaveTextContent('2');
    expect(summary.getByText('열림').parentElement).toHaveTextContent('1');
    expect(summary.getByText('해결됨').parentElement).toHaveTextContent('1');

    fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: '문구' } });
    expect(screen.getByText('문구 수정 필요')).toBeInTheDocument();
    expect(screen.queryByText('첫 번째 검토')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('메모 검색'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('유형'), { target: { value: 'point' } });
    expect(screen.getByText('첫 번째 검토')).toBeInTheDocument();
    expect(screen.queryByText('문구 수정 필요')).not.toBeInTheDocument();
  });

  it('상태 전환과 위험한 삭제에 사용자 확인을 사용한다', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <AnnotationPanel
        annotations={[annotations[0]!]}
        annotationsVisible
        showPinNumbers
        unplacedTextIds={new Set()}
        onClose={vi.fn()}
        onToggleVisibility={vi.fn()}
        onFocus={vi.fn()}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '해결됨으로 표시' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('point-1', { status: 'resolved' }));
    expect(screen.getByRole('status')).toHaveTextContent('해결됨으로 표시했습니다');

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('point-1'));
    expect(window.confirm).toHaveBeenCalledOnce();
  });
});
