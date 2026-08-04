import { useState } from 'react';

import type { ExtensionMetadata } from '../../types/extension';
import { toKoreanErrorMessage } from '../../utils/errors';

interface AppProps extends ExtensionMetadata {
  onStartMemo: () => Promise<void>;
}

const INITIAL_STATUS = '메모 작성 기능은 아직 구현되지 않았습니다.';

export default function App({ name: extensionName, version, onStartMemo }: AppProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(INITIAL_STATUS);

  async function handleStartMemo(): Promise<void> {
    setIsLoading(true);

    try {
      await onStartMemo();
      setStatusMessage(
        '준비 코드가 정상적으로 로드되었습니다. 메모 작성 기능은 아직 구현되지 않았습니다.',
      );
    } catch (error: unknown) {
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
        {isLoading ? '준비 코드 불러오는 중' : '현재 페이지에서 메모 기능 시작'}
      </button>

      <p id="feature-status" role="status" className="mt-3 text-sm leading-6 text-slate-600">
        {statusMessage}
      </p>

      <footer className="mt-auto border-t border-slate-200 pt-4 text-xs text-slate-500">
        현재 버전 {version}
      </footer>
    </main>
  );
}
