import type {
  MiniAppSdkInterface,
  PlatformUser,
  ChatMessage,
  ModelCompletionOptions,
  StreamChunk,
  StreamError,
} from '@lizuz/mini-app-types';


declare global {
  type MiniAppSdk = MiniAppSdkInterface;
  type SdkPlatformUser = PlatformUser;
  type SdkChatMessage = ChatMessage;
  type SdkModelCompletionOptions = ModelCompletionOptions;
  type SdkStreamChunk = StreamChunk;
  type SdkStreamError = StreamError

  interface Window {
    __GSA_SDK__?: MiniAppSdk;
  }
}

export {};
