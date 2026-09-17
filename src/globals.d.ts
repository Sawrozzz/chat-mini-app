import type {
  MiniAppSdkInterface,
  PlatformUser,
  ChatMessage,
  ModelCompletionOptions,
  StreamChunk,
  StreamError,
} from '@lizuz/mini-app-types';
import type {
  GicChatSession,
  GicChatEvent,
  GicChatStreamRequest,
} from './gic/types';


declare global {
  type MiniAppSdk = MiniAppSdkInterface;
  type SdkPlatformUser = PlatformUser;
  type SdkStreamError = StreamError
  type SdkGicChatSession = GicChatSession;
  type SdkGicChatEvent = GicChatEvent;
  type SdkGicChatStreamRequest = GicChatStreamRequest;

  interface Window {
    __GSA_SDK__?: MiniAppSdk;
  }
}

export {};
