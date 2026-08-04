import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PointMarker from '../features/point/PointMarker';

describe('PointMarker', () => {
  it('드래그한 화면 좌표를 전달하고 뒤이어 발생하는 클릭은 편집기로 처리하지 않는다', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const onOpen = vi.fn();
    render(
      <PointMarker
        annotationId="point-1"
        number={1}
        color="yellow"
        status="open"
        left={100}
        top={120}
        onMove={onMove}
        onOpen={onOpen}
      />,
    );
    const marker = screen.getByRole('button', { name: '위치 메모 1 열기' });

    fireEvent.pointerDown(marker, { pointerId: 1, button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerMove(marker, { pointerId: 1, clientX: 150, clientY: 180 });
    expect(marker).toHaveStyle({ left: '150px', top: '180px' });
    fireEvent.pointerUp(marker, { pointerId: 1, button: 0, clientX: 150, clientY: 180 });
    fireEvent.click(marker);

    await waitFor(() => expect(onMove).toHaveBeenCalledWith(150, 180));
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(marker);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('드래그 임계값보다 작은 움직임은 일반 클릭으로 유지한다', () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const onOpen = vi.fn();
    render(
      <PointMarker
        annotationId="point-2"
        number={2}
        color="blue"
        status="open"
        left={20}
        top={30}
        onMove={onMove}
        onOpen={onOpen}
      />,
    );
    const marker = screen.getByRole('button', { name: '위치 메모 2 열기' });

    fireEvent.pointerDown(marker, { pointerId: 2, button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(marker, { pointerId: 2, clientX: 22, clientY: 31 });
    fireEvent.pointerUp(marker, { pointerId: 2, button: 0, clientX: 22, clientY: 31 });
    fireEvent.click(marker);

    expect(onMove).not.toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
