import type {
  SewaPlatformSdkInterface,
  PlatformUser,
  ChatMessage,
  ModelCompletionOptions,
  StreamChunk,
  StreamError,
} from 'sewa-platform-types';
import type {
  GicChatSession,
  GicChatEvent,
  GicChatStreamRequest,
} from './gic/types';


declare global {
  type SewaPlatformSdk = SewaPlatformSdkInterface;
  type SdkPlatformUser = PlatformUser;
  type SdkStreamError = StreamError
  type SdkGicChatSession = GicChatSession;
  type SdkGicChatEvent = GicChatEvent;
  type SdkGicChatStreamRequest = GicChatStreamRequest;

  interface Window {
    __SEWA_SDK__?: SewaPlatformSdk;
  }
}

export {};
