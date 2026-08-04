import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from '../entrypoints/popup/App';
import { FileAccessRequiredError } from '../services/contentScript';

const metadata = { name: '웹 메모 HTML 검토', version: '0.1.0' };
const openSettings = vi.fn().mockResolvedValue(undefined);

describe('Popup', () => {
  it('초기 안내와 manifest 정보를 표시한다', () => {
    render(
      <App
        {...metadata}
        onStartMemo={vi.fn().mockResolvedValue({ mode: 'overlay' })}
        onOpenFileAccessSettings={openSettings}
      />,
    );

    expect(screen.getByRole('heading', { name: '웹 메모 HTML 검토' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메모 시작' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('메모 모드를 시작할 수 있습니다');
    expect(screen.getByText('현재 버전 0.1.0')).toBeInTheDocument();
  });

  it('시작 버튼으로 현재 탭의 메모 모드를 활성화한다', async () => {
    const onStartMemo = vi.fn().mockResolvedValue({ mode: 'overlay' });
    render(<App {...metadata} onStartMemo={onStartMemo} onOpenFileAccessSettings={openSettings} />);

    fireEvent.click(screen.getByRole('button', { name: '메모 시작' }));

    await waitFor(() => expect(onStartMemo).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent('메모 모드가 활성화되었습니다');
  });

  it('로컬 파일 접근이 꺼져 있으면 설정 이동 버튼을 제공한다', async () => {
    const onStartMemo = vi.fn().mockRejectedValue(new FileAccessRequiredError());
    const onOpenFileAccessSettings = vi.fn().mockResolvedValue(undefined);
    render(
      <App
        {...metadata}
        onStartMemo={onStartMemo}
        onOpenFileAccessSettings={onOpenFileAccessSettings}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '메모 시작' }));
    const settingsButton = await screen.findByRole('button', { name: '파일 접근 설정 열기' });
    expect(screen.getByRole('status')).toHaveTextContent('파일 URL에 대한 액세스 허용');

    fireEvent.click(settingsButton);
    expect(onOpenFileAccessSettings).toHaveBeenCalledOnce();
  });

  it('자체 검토 HTML에서는 내장 편집 도구를 안내한다', async () => {
    render(
      <App
        {...metadata}
        onStartMemo={vi.fn().mockResolvedValue({ mode: 'review-file' })}
        onOpenFileAccessSettings={openSettings}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '메모 시작' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('내장 편집 도구'));
  });
});
