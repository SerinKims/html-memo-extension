import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AnnotationEditor from '../features/editor/AnnotationEditor';

describe('AnnotationEditor', () => {
  it('빈 메모는 저장하지 않고 필수 오류를 표시한다', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AnnotationEditor
        initialValue={{ content: '', author: '연구원', color: 'yellow', status: 'open' }}
        isEditing={false}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.submit(screen.getByRole('button', { name: '저장' }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('메모 내용을 입력하세요');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('작성자, 내용, 기본 색상과 해결 상태를 저장한다', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AnnotationEditor
        initialValue={{ content: '이전 메모', author: '작성자', color: 'yellow', status: 'open' }}
        isEditing
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /작성자/ }), {
      target: { value: ' 새 작성자 ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /메모 내용/ }), {
      target: { value: ' 수정한 메모 ' },
    });
    fireEvent.click(screen.getByRole('radio', { name: '파랑' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '해결됨' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        content: '수정한 메모',
        author: '새 작성자',
        color: 'blue',
        status: 'resolved',
      }),
    );
  });
});
