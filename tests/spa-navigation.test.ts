import { describe, expect, it, vi } from 'vitest';

import { observeSpaNavigation } from '../utils/spa-navigation';

describe('observeSpaNavigation', () => {
  it('pushState, replaceState, popstate URL 변경을 감지하고 정리 후에는 알리지 않는다', () => {
    window.history.replaceState({}, '', '/start');
    const nativePushState = window.history.pushState;
    const onNavigate = vi.fn();
    const stop = observeSpaNavigation(onNavigate);

    window.history.pushState({}, '', '/pushed');
    window.history.replaceState({}, '', '/replaced');
    nativePushState.call(window.history, {}, '', '/pop-target');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('/pushed'));
    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('/replaced'));
    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('/pop-target'));

    const callCount = onNavigate.mock.calls.length;
    stop();
    window.history.pushState({}, '', '/after-cleanup');
    expect(onNavigate).toHaveBeenCalledTimes(callCount);
  });
});
