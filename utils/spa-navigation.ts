export type NavigationCleanup = () => void;

const URL_CHECK_INTERVAL_MS = 300;

/**
 * SPA의 History API 이동과 브라우저 뒤로/앞으로 이동을 감지합니다.
 * 격리된 Content Script 환경에서 History 래핑이 보이지 않는 경우를 위해
 * 짧은 URL 폴링도 함께 사용합니다.
 */
export function observeSpaNavigation(
  onNavigate: (url: string) => void,
  targetWindow: Window = window,
): NavigationCleanup {
  let lastUrl = targetWindow.location.href;
  const originalPushState = targetWindow.history.pushState;
  const originalReplaceState = targetWindow.history.replaceState;

  const notifyIfChanged = (): void => {
    const nextUrl = targetWindow.location.href;
    if (nextUrl === lastUrl) {
      return;
    }

    lastUrl = nextUrl;
    onNavigate(nextUrl);
  };

  const pushState: History['pushState'] = function (this: History, ...args): void {
    originalPushState.apply(this, args);
    notifyIfChanged();
  };

  const replaceState: History['replaceState'] = function (this: History, ...args): void {
    originalReplaceState.apply(this, args);
    notifyIfChanged();
  };

  targetWindow.history.pushState = pushState;
  targetWindow.history.replaceState = replaceState;
  targetWindow.addEventListener('popstate', notifyIfChanged);
  targetWindow.addEventListener('hashchange', notifyIfChanged);
  const intervalId = targetWindow.setInterval(notifyIfChanged, URL_CHECK_INTERVAL_MS);

  return () => {
    targetWindow.removeEventListener('popstate', notifyIfChanged);
    targetWindow.removeEventListener('hashchange', notifyIfChanged);
    targetWindow.clearInterval(intervalId);

    if (targetWindow.history.pushState === pushState) {
      targetWindow.history.pushState = originalPushState;
    }
    if (targetWindow.history.replaceState === replaceState) {
      targetWindow.history.replaceState = originalReplaceState;
    }
  };
}
