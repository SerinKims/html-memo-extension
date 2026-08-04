import { useState } from 'react';

import {
  FileAccessRequiredError,
  type MemoModeActivationResult,
} from '../../services/contentScript';
import type { ExtensionMetadata } from '../../types/extension';
import { toKoreanErrorMessage } from '../../utils/errors';

interface AppProps extends ExtensionMetadata {
  onStartMemo: () => Promise<MemoModeActivationResult>;
  onOpenFileAccessSettings: () => Promise<void>;
}

const INITIAL_STATUS = '현재 웹페이지에서 메모 모드를 시작할 수 있습니다.';

export default function App({
  name: extensionName,
  version,
  onStartMemo,
  onOpenFileAccessSettings,
}: AppProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(INITIAL_STATUS);
  const [needsFileAccess, setNeedsFileAccess] = useState(false);

  async function handleStartMemo(): Promise<void> {
    setIsLoading(true);
    setNeedsFileAccess(false);

    try {
      const result = await onStartMemo();
      setStatusMessage(
        result.mode === 'review-file'
          ? '이 검토 HTML은 화면 안의 내장 편집 도구로 메모할 수 있습니다.'
          : '현재 페이지에서 메모 모드가 활성화되었습니다.',
      );
    } catch (error: unknown) {
      setNeedsFileAccess(error instanceof FileAccessRequiredError);
      setStatusMessage(toKoreanErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-72 w-80 flex-col bg-slate-50 p-5 text-slate-900">
      <header className="mb-6">
        <p className="mb-1 text-xs font-semibold tracking-wide text-blue-700">
          LOCAL RESEARCH TOOL
        </p>
        <h1 className="text-xl font-bold">{extensionName}</h1>
      </header>

      <button
        type="button"
        disabled={isLoading}
        aria-describedby="feature-status"
        onClick={() => void handleStartMemo()}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
      >
        {isLoading ? '메모 모드 시작 중' : '메모 시작'}
      </button>

      <p id="feature-status" role="status" className="mt-3 text-sm leading-6 text-slate-600">
        {statusMessage}
      </p>

      {needsFileAccess ? (
        <button
          type="button"
          className="mt-2 w-full rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          onClick={() => void onOpenFileAccessSettings()}
        >
          파일 접근 설정 열기
        </button>
      ) : null}

      <footer className="mt-auto border-t border-slate-200 pt-4 text-xs text-slate-500">
        현재 버전 {version}
      </footer>
    </main>
  );
}
