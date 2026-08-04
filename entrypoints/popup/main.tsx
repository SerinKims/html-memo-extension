import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  loadContentScriptForActiveTab,
  openExtensionDetailsPage,
} from '../../services/contentScript';
import { getExtensionMetadata } from '../../services/extensionMetadata';
import {
  downloadCurrentPageJsonBackup,
  loadActivePageSummary,
  openMemoPanelInActiveTab,
} from '../../services/popup-service';
import { getAnnotationSettings, updateAnnotationSettings } from '../../services/message-service';
import App from './App';
import './style.css';

const rootElement = document.querySelector('#root');

if (rootElement === null) {
  throw new Error('Popup을 표시할 영역을 찾을 수 없습니다. 확장 프로그램을 다시 로드해 주세요.');
}

const metadata = getExtensionMetadata();

createRoot(rootElement).render(
  <StrictMode>
    <App
      name={metadata.name}
      version={metadata.version}
      onStartMemo={loadContentScriptForActiveTab}
      onOpenFileAccessSettings={openExtensionDetailsPage}
      onLoadPage={loadActivePageSummary}
      onOpenMemoPanel={async () => {
        await loadContentScriptForActiveTab();
        return openMemoPanelInActiveTab();
      }}
      onBackupJson={downloadCurrentPageJsonBackup}
      onLoadSettings={getAnnotationSettings}
      onSaveSettings={updateAnnotationSettings}
    />
  </StrictMode>,
);
