import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SettingsPanel from '../features/settings/SettingsPanel';

describe('SettingsPanel', () => {
  it('모든 사용자 설정을 편집하고 저장 상태를 알린다', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsPanel
        settings={{
          defaultAuthor: '기본 작성자',
          defaultColor: 'yellow',
          htmlFilenamePattern: 'web-review_{title}_{date}',
          includeResolvedInExport: true,
          showPinNumbers: true,
        }}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('기본 작성자 이름'), { target: { value: '새 작성자' } });
    fireEvent.change(screen.getByLabelText('기본 메모 색상'), { target: { value: 'purple' } });
    fireEvent.click(screen.getByLabelText('웹페이지 핀 번호 표시'));
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultAuthor: '새 작성자',
          defaultColor: 'purple',
          showPinNumbers: false,
        }),
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent('설정을 저장했습니다');
  });
});
