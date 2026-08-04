import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AreaMarker from '../features/area/AreaMarker';

describe('AreaMarker', () => {
  it('영역 크기와 번호를 표시하고 테두리 클릭 시 메모를 연다', () => {
    const onOpen = vi.fn();
    render(
      <AreaMarker
        annotationId="area-1"
        number={3}
        color="blue"
        status="open"
        left={100}
        top={200}
        width={300}
        height={150}
        onOpen={onOpen}
      />,
    );

    const marker = screen.getByRole('button', { name: '영역 메모 3 열기' });
    expect(marker).toHaveStyle({ left: '100px', top: '200px', width: '300px', height: '150px' });
    fireEvent.click(marker);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('해결된 영역에 별도 스타일을 적용한다', () => {
    render(
      <AreaMarker
        annotationId="area-2"
        number={1}
        color="green"
        status="resolved"
        left={0}
        top={0}
        width={100}
        height={100}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByRole('button')).toHaveClass('is-resolved', 'area-marker--green');
  });
});
