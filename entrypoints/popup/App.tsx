import { useEffect, useState } from 'react';

import SettingsPanel from '../../features/settings/SettingsPanel';
import {
  FileAccessRequiredError,
  type MemoModeActivationResult,
} from '../../services/contentScript';
import type { ActivePageSummary } from '../../services/popup-service';
import type { ExtensionMetadata } from '../../types/extension';
import type { StorageSettings } from '../../types/storage';
import { toKoreanErrorMessage } from '../../utils/errors';

interface AppProps extends ExtensionMetadata {
  onStartMemo: () => Promise<MemoModeActivationResult>;
  onOpenFileAccessSettings: () => Promise<void>;
  onLoadPage?: () => Promise<ActivePageSummary>;
  onOpenMemoPanel?: () => Promise<unknown>;
  onSaveHtml?: () => Promise<void>;
  onBackupJson?: () => Promise<void>;
  onLoadSettings?: () => Promise<StorageSettings>;
  onSaveSettings?: (settings: StorageSettings) => Promise<StorageSettings>;
}

const INITIAL_STATUS = '현재 웹페이지에서 메모 모드를 시작할 수 있습니다.';

export default function App({
  name: extensionName,
  version,
  onStartMemo,
  onOpenFileAccessSettings,
  onLoadPage,
  onOpenMemoPanel,
  onSaveHtml,
  onBackupJson,
  onLoadSettings,
  onSaveSettings,
}: AppProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(INITIAL_STATUS);
  const [needsFileAccess, setNeedsFileAccess] = useState(false);
  const [page, setPage] = useState<ActivePageSummary | null>(null);
  const [settings, setSettings] = useState<StorageSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (onLoadPage === undefined) {
      return;
    }
    let cancelled = false;
    void onLoadPage()
      .then((summary) => {
        if (!cancelled) {
          setPage(summary);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatusMessage(toKoreanErrorMessage(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onLoadPage]);

  async function runAction(
    action: () => Promise<unknown>,
    pendingMessage: string,
    successMessage: string,
  ): Promise<void> {
    setIsLoading(true);
    setNeedsFileAccess(false);
    setStatusMessage(pendingMessage);
    try {
      await action();
      setStatusMessage(successMessage);
      if (onLoadPage !== undefined) {
        setPage(await onLoadPage());
      }
    } catch (error: unknown) {
      setNeedsFileAccess(error instanceof FileAccessRequiredError);
      setStatusMessage(toKoreanErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartMemo(): Promise<void> {
    setIsLoading(true);
    setNeedsFileAccess(false);
    setStatusMessage('메모 모드를 시작하는 중입니다.');
    try {
      const result = await onStartMemo();
      setStatusMessage(
        result.mode === 'review-file'
          ? '이 검토 HTML은 화면 안의 내장 편집 도구로 메모할 수 있습니다.'
          : '현재 페이지에서 메모 모드가 활성화되었습니다.',
      );
      if (onLoadPage !== undefined) {
        setPage(await onLoadPage());
      }
    } catch (error: unknown) {
      setNeedsFileAccess(error instanceof FileAccessRequiredError);
      setStatusMessage(toKoreanErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenSettings(): Promise<void> {
    setShowSettings(true);
    if (onLoadSettings === undefined) {
      return;
    }
    try {
      setSettings(await onLoadSettings());
    } catch (error) {
      setStatusMessage(toKoreanErrorMessage(error));
    }
  }

  if (showSettings) {
    return (
      <main className="popup-shell">
        <SettingsPanel
          key={settings === null ? 'loading' : JSON.stringify(settings)}
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={async (nextSettings) => {
            if (onSaveSettings === undefined) {
              throw new Error('설정 저장 기능을 사용할 수 없습니다.');
            }
            setSettings(await onSaveSettings(nextSettings));
          }}
        />
      </main>
    );
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <p>LOCAL RESEARCH TOOL</p>
          <h1>{extensionName}</h1>
        </div>
        <button type="button" onClick={() => void handleOpenSettings()}>
          설정
        </button>
      </header>

      <section className="popup-page" aria-label="현재 페이지 정보">
        <p>현재 페이지</p>
        <h2 title={page?.title}>{page?.title ?? '페이지 정보 확인 중'}</h2>
        <span title={page?.url}>{page?.url ?? 'URL을 불러오고 있습니다.'}</span>
        <strong>메모 {page === null ? '확인 중' : `${page.annotationCount}개`}</strong>
      </section>

      <section className="popup-actions" aria-label="메모와 내보내기 기능">
        <button
          type="button"
          className="popup-primary"
          disabled={isLoading}
          aria-describedby="feature-status"
          onClick={() => void handleStartMemo()}
        >
          {isLoading ? '처리 중' : '메모 시작'}
        </button>
        <button
          type="button"
          disabled={isLoading || onOpenMemoPanel === undefined}
          onClick={() =>
            onOpenMemoPanel === undefined
              ? undefined
              : void runAction(
                  onOpenMemoPanel,
                  '메모 패널을 여는 중입니다.',
                  '메모 패널을 열었습니다.',
                )
          }
        >
          메모 패널 열기
        </button>
        <button
          type="button"
          disabled={isLoading || onSaveHtml === undefined}
          title={
            onSaveHtml === undefined ? '전체 페이지 캡처 구현 후 사용할 수 있습니다.' : undefined
          }
          onClick={() =>
            onSaveHtml === undefined
              ? undefined
              : void runAction(
                  onSaveHtml,
                  'HTML 검토본을 저장하는 중입니다.',
                  'HTML 검토본을 저장했습니다.',
                )
          }
        >
          HTML 검토본 저장
        </button>
        <button
          type="button"
          disabled={isLoading || onBackupJson === undefined}
          onClick={() =>
            onBackupJson === undefined
              ? undefined
              : void runAction(
                  onBackupJson,
                  'JSON 백업을 준비하는 중입니다.',
                  'JSON 백업을 저장했습니다.',
                )
          }
        >
          JSON 백업
        </button>
      </section>

      <p id="feature-status" role="status" aria-live="polite" className="popup-status">
        {statusMessage}
      </p>

      {needsFileAccess ? (
        <button
          type="button"
          className="popup-file-access"
          onClick={() => void onOpenFileAccessSettings()}
        >
          파일 접근 설정 열기
        </button>
      ) : null}

      <footer>
        <span>현재 버전 {version}</span>
        <span>데이터는 브라우저에만 저장됩니다.</span>
      </footer>
    </main>
  );
}
