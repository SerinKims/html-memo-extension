import { browser } from 'wxt/browser';

import { AnnotationRepository } from '../storage/annotation-repository';
import { ChromeStorageAdapter } from '../storage/storage-adapter';
import {
  isGetPageAnnotationCountMessage,
  messageFailure,
  messageSuccess,
  type MessageFailure,
  type MessageSuccess,
} from '../types/messages';

export default defineBackground(() => {
  const repository = new AnnotationRepository(ChromeStorageAdapter.fromLocal());

  browser.runtime.onMessage.addListener(
    async (message: unknown): Promise<MessageSuccess<number> | MessageFailure | undefined> => {
      if (!isGetPageAnnotationCountMessage(message)) {
        return undefined;
      }

      const result = await repository.getByPage(message.payload.url);
      if (!result.ok) {
        return messageFailure(result.error.code, result.error.message);
      }

      return messageSuccess(result.data.length);
    },
  );

  console.info('[웹 메모] Background Service Worker 메시지 라우터가 로드되었습니다.');
});
