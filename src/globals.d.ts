import type {
  MiniAppSdkInterface,
  PlatformUser,
  ChatMessage,
  ModelCompletionOptions,
  StreamChunk,
  StreamError,
  GicChatSession,
  GicChatEvent,
  GicChatStreamRequest,
} from '@lizuz/mini-app-types';


declare global {
  type MiniAppSdk = MiniAppSdkInterface;
  type SdkPlatformUser = PlatformUser;
  type SdkChatMessage = ChatMessage;
  type SdkModelCompletionOptions = ModelCompletionOptions;
  type SdkStreamChunk = StreamChunk;
  type SdkStreamError = StreamError
  type SdkGicChatSession = GicChatSession;
  type SdkGicChatEvent = GicChatEvent;
  type SdkGicChatStreamRequest = GicChatStreamRequest;

  interface Window {
    __GSA_SDK__?: MiniAppSdk;
  }
}

export {};
