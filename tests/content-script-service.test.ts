import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserMocks = vi.hoisted(() => ({
  query: vi.fn(),
  createTab: vi.fn(),
  executeScript: vi.fn(),
  isAllowedFileSchemeAccess: vi.fn(),
  activateMemoModeInTab: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: { query: browserMocks.query, create: browserMocks.createTab },
    scripting: { executeScript: browserMocks.executeScript },
    extension: { isAllowedFileSchemeAccess: browserMocks.isAllowedFileSchemeAccess },
    runtime: { id: 'extension-id' },
  },
}));

vi.mock('../services/message-service', () => ({
  activateMemoModeInTab: browserMocks.activateMemoModeInTab,
}));

import {
  FileAccessRequiredError,
  loadContentScriptForActiveTab,
  openExtensionDetailsPage,
} from '../services/contentScript';

describe('content script loader', () => {
  beforeEach(() => {
    browserMocks.query.mockResolvedValue([{ id: 7, url: 'https://example.com/' }]);
    browserMocks.isAllowedFileSchemeAccess.mockResolvedValue(true);
    browserMocks.executeScript.mockResolvedValue([
      { result: { contentType: 'text/html', isExportedReview: false } },
    ]);
    browserMocks.activateMemoModeInTab.mockResolvedValue({ isActive: true });
  });

  it('일반 HTML에는 사전 검사 후 런타임 Content Script를 주입한다', async () => {
    await expect(loadContentScriptForActiveTab()).resolves.toEqual({ mode: 'overlay' });

    expect(browserMocks.executeScript).toHaveBeenCalledTimes(2);
    expect(browserMocks.executeScript).toHaveBeenLastCalledWith({
      target: { tabId: 7 },
      files: ['/content-scripts/content.js'],
    });
    expect(browserMocks.activateMemoModeInTab).toHaveBeenCalledWith(7);
  });

  it('로컬 파일 접근이 꺼져 있으면 주입 전에 전용 오류를 반환한다', async () => {
    browserMocks.query.mockResolvedValue([{ id: 7, url: 'file:///C:/report.html' }]);
    browserMocks.isAllowedFileSchemeAccess.mockResolvedValue(false);

    await expect(loadContentScriptForActiveTab()).rejects.toBeInstanceOf(FileAccessRequiredError);
    expect(browserMocks.executeScript).not.toHaveBeenCalled();
  });

  it('자체 검토 HTML에는 확장 오버레이를 중복 주입하지 않는다', async () => {
    browserMocks.query.mockResolvedValue([{ id: 7, url: 'file:///C:/review.html' }]);
    browserMocks.executeScript.mockResolvedValue([
      { result: { contentType: 'text/html', isExportedReview: true } },
    ]);

    await expect(loadContentScriptForActiveTab()).resolves.toEqual({ mode: 'review-file' });
    expect(browserMocks.executeScript).toHaveBeenCalledOnce();
    expect(browserMocks.activateMemoModeInTab).not.toHaveBeenCalled();
  });

  it('HTML이 아닌 로컬 문서를 거부한다', async () => {
    browserMocks.query.mockResolvedValue([{ id: 7, url: 'file:///C:/document.pdf' }]);
    browserMocks.executeScript.mockResolvedValue([
      { result: { contentType: 'application/pdf', isExportedReview: false } },
    ]);

    await expect(loadContentScriptForActiveTab()).rejects.toThrow(
      'HTML 문서에서만 메모 모드를 시작할 수 있습니다.',
    );
  });

  it('확장 상세 설정 페이지를 연다', async () => {
    browserMocks.createTab.mockResolvedValue({});

    await openExtensionDetailsPage();
    expect(browserMocks.createTab).toHaveBeenCalledWith({
      url: 'chrome://extensions/?id=extension-id',
    });
  });
});
