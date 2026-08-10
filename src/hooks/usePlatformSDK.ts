import { useContext } from "react";
import { SDKContext, type SDKContextValue } from "../context/SdkContext";

export function usePlatformSDK(): SDKContextValue {
  const ctx = useContext(SDKContext);
  if (!ctx.sdk && !ctx.isReady && !ctx.error) {
    throw new Error("usePlatformSDK must be used within PlatformSdkProvider");
  }
  return ctx;
}
