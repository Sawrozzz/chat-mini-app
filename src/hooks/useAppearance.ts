import { useEffect, useState } from "react";
import { usePlatformSDK } from "./usePlatformSDK";
import type { AppearanceState, LocaleState, ThemeState } from "@lizuz/mini-app-types";

const DEFAULT_STATE: AppearanceState = {
  locale: { locale: "en-LK", language: "en", direction: "ltr" },
  theme: { preference: "system", mode: "light" },
};

export interface UseAppearanceResult {
  locale: LocaleState;
  theme: ThemeState;
}

export function useAppearance(): UseAppearanceResult {
  const { sdk, isReady } = usePlatformSDK();
  const [state, setState] = useState<AppearanceState>(() =>
    sdk && isReady ? sdk.appearance.state() : DEFAULT_STATE,
  );

  useEffect(() => {
    if (!sdk) return;
    setState(sdk.appearance.state());
    return sdk.appearance.subscribe(setState);
  }, [sdk, isReady]);

  return { locale: state.locale, theme: state.theme };
}
