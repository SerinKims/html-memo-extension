import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from '../entrypoints/popup/App';

describe('Popup', () => {
  it('초기 안내와 manifest 정보를 표시한다', () => {
    render(<App name="웹 메모 HTML 검토" version="0.1.0" onStartMemo={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '웹 메모 HTML 검토' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메모 시작' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('메모 모드를 시작할 수 있습니다');
    expect(screen.getByText('현재 버전 0.1.0')).toBeInTheDocument();
  });

  it('시작 버튼으로 현재 탭의 메모 모드를 활성화한다', async () => {
    const onStartMemo = vi.fn().mockResolvedValue(undefined);
    render(<App name="웹 메모 HTML 검토" version="0.1.0" onStartMemo={onStartMemo} />);

    fireEvent.click(screen.getByRole('button', { name: '메모 시작' }));

    await waitFor(() => expect(onStartMemo).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent('메모 모드가 활성화되었습니다');
  });
});
