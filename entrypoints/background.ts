import { browser } from 'wxt/browser';

import { AnnotationRepository } from '../storage/annotation-repository';
import { ChromeStorageAdapter } from '../storage/storage-adapter';
import {
  BACKGROUND_MESSAGE_TYPES,
  isBackgroundMessage,
  messageFailure,
  messageSuccess,
  type MessageFailure,
  type MessageSuccess,
} from '../types/messages';

export default defineBackground(() => {
  const repository = new AnnotationRepository(ChromeStorageAdapter.fromLocal());

  browser.runtime.onMessage.addListener(
    async (message: unknown): Promise<MessageSuccess<unknown> | MessageFailure | undefined> => {
      if (!isBackgroundMessage(message)) {
        return undefined;
      }

      let result;
      switch (message.type) {
        case BACKGROUND_MESSAGE_TYPES.getPageAnnotationCount: {
          const annotations = await repository.getByPage(message.payload.url);
          if (!annotations.ok) {
            return messageFailure(annotations.error.code, annotations.error.message);
          }
          return messageSuccess(annotations.data.length);
        }
        case BACKGROUND_MESSAGE_TYPES.getPageAnnotations: {
          const annotations = await repository.getByPage(message.payload.url);
          if (!annotations.ok) {
            return messageFailure(annotations.error.code, annotations.error.message);
          }
          return messageSuccess(annotations.data);
        }
        case BACKGROUND_MESSAGE_TYPES.getPagePointAnnotations: {
          const annotations = await repository.getByPage(message.payload.url);
          if (!annotations.ok) {
            return messageFailure(annotations.error.code, annotations.error.message);
          }
          return messageSuccess(
            annotations.data.filter((annotation) => annotation.type === 'point'),
          );
        }
        case BACKGROUND_MESSAGE_TYPES.getPageTextAnnotations: {
          const annotations = await repository.getByPage(message.payload.url);
          if (!annotations.ok) {
            return messageFailure(annotations.error.code, annotations.error.message);
          }
          return messageSuccess(
            annotations.data.filter((annotation) => annotation.type === 'text'),
          );
        }
        case BACKGROUND_MESSAGE_TYPES.getPageAreaAnnotations: {
          const annotations = await repository.getByPage(message.payload.url);
          if (!annotations.ok) {
            return messageFailure(annotations.error.code, annotations.error.message);
          }
          return messageSuccess(
            annotations.data.filter((annotation) => annotation.type === 'area'),
          );
        }
        case BACKGROUND_MESSAGE_TYPES.createAnnotation:
          result = await repository.create(message.payload);
          break;
        case BACKGROUND_MESSAGE_TYPES.updateAnnotation:
          result = await repository.update(message.payload.id, message.payload.changes);
          break;
        case BACKGROUND_MESSAGE_TYPES.movePointAnnotation:
          result = await repository.updatePointPosition(
            message.payload.id,
            message.payload.position,
          );
          break;
        case BACKGROUND_MESSAGE_TYPES.deleteAnnotation:
          result = await repository.delete(message.payload.id);
          break;
        case BACKGROUND_MESSAGE_TYPES.getSettings:
          result = await repository.getSettings();
          break;
        case BACKGROUND_MESSAGE_TYPES.updateSettings:
          result = await repository.updateSettings(message.payload);
          break;
      }

      if (!result.ok) {
        return messageFailure(result.error.code, result.error.message);
      }

      return messageSuccess(result.data);
    },
  );

  console.info('[웹 메모] Background Service Worker 메시지 라우터가 로드되었습니다.');
});
