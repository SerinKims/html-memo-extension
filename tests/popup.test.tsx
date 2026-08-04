import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from '../entrypoints/popup/App';

describe('Popup', () => {
  it('초기 안내와 manifest 정보를 표시한다', () => {
    render(<App name="웹 메모 HTML 검토" version="0.1.0" onStartMemo={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '웹 메모 HTML 검토' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '현재 페이지에서 메모 기능 시작' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('아직 구현되지 않았습니다');
    expect(screen.getByText('현재 버전 0.1.0')).toBeInTheDocument();
  });

  it('시작 버튼으로 현재 탭의 준비 코드를 불러온다', async () => {
    const onStartMemo = vi.fn().mockResolvedValue(undefined);
    render(<App name="웹 메모 HTML 검토" version="0.1.0" onStartMemo={onStartMemo} />);

    fireEvent.click(screen.getByRole('button', { name: '현재 페이지에서 메모 기능 시작' }));

    await waitFor(() => expect(onStartMemo).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent('준비 코드가 정상적으로 로드되었습니다');
  });
});
