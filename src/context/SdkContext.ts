import { createContext } from "react";

export interface SDKContextValue {
  sdk: MiniAppSdk | null;
  user: SdkPlatformUser | null;
  isReady: boolean;
  error: Error | null;
}

export const SDKContext = createContext<SDKContextValue>({
  sdk: null,
  user: null,
  isReady: false,
  error: null,
});
