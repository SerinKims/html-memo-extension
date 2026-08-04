import { browser } from 'wxt/browser';

import { OverlayController } from '../../features/overlay/overlay-controller';
import {
  CONTENT_MESSAGE_TYPES,
  isContentMessage,
  messageSuccess,
  type MessageSuccess,
  type OverlayState,
} from '../../types/messages';
import overlayStyles from './style.css?inline';

const CONTENT_STATE_KEY = '__HTML_MEMO_EXTENSION_CONTENT_STATE_V1__';

interface ContentState {
  controller: OverlayController;
}

type ContentGlobal = typeof globalThis & {
  [CONTENT_STATE_KEY]?: ContentState;
};

export default defineContentScript({
  registration: 'runtime',
  main() {
    const contentGlobal = globalThis as ContentGlobal;
    const existingState = contentGlobal[CONTENT_STATE_KEY];

    if (existingState !== undefined) {
      existingState.controller.activate();
      return;
    }

    const controller = new OverlayController({ styles: overlayStyles });
    contentGlobal[CONTENT_STATE_KEY] = { controller };

    browser.runtime.onMessage.addListener(
      async (message: unknown): Promise<MessageSuccess<OverlayState> | undefined> => {
        if (!isContentMessage(message)) {
          return undefined;
        }

        switch (message.type) {
          case CONTENT_MESSAGE_TYPES.activateMemoMode:
            return messageSuccess(controller.activate());
          case CONTENT_MESSAGE_TYPES.deactivateMemoMode:
            return messageSuccess(controller.deactivate());
          case CONTENT_MESSAGE_TYPES.getOverlayState:
            return messageSuccess(controller.getState());
        }
      },
    );

    controller.activate();
    console.info('[웹 메모] Content Script 메모 오버레이가 활성화되었습니다.');
  },
});
