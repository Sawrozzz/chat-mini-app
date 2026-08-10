import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router";
import { usePlatformSDK } from "./usePlatformSDK";

export const NAVIGATION_EVENTS = {
  BACK_REQUESTED: "navigation.back.requested",
  ROUTE_CHANGED: "navigation.route.changed",
} as const;

export function useHostRouter() {
  const { sdk, isReady } = usePlatformSDK();

  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();

  const depthRef = useRef(0);

  const goBackRef = useRef<() => Promise<void>>(async () => {});

  const countedKeyRef = useRef<string | null>(null);
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (countedKeyRef.current === location.key) {
      return;
    }

    const isFirstObservation = countedKeyRef.current === null;
    countedKeyRef.current = location.key;

    if (isFirstObservation) {
      previousPathRef.current = location.pathname;
      return;
    }

    if (navigationType === "PUSH") {
      depthRef.current += 1;
    } else if (navigationType === "POP") {
      depthRef.current = Math.max(0, depthRef.current - 1);
    }

    if (!sdk) {
      return;
    }

    // Keep the host's back-button policy in sync with this app's history,
    // otherwise the host never knows a route was pushed and exits on back.
    sdk.emit(NAVIGATION_EVENTS.ROUTE_CHANGED, {
      previous: previousPathRef.current,
      current: location.pathname,
      canGoBack: depthRef.current > 0,
    });

    previousPathRef.current = location.pathname;

    if (navigationType === "PUSH" && sdk.navigation.router) {
      void sdk.navigation.router.push(true);
    }
  }, [location.key, location.pathname, navigationType, sdk]);

  const goBack = useCallback(async () => {
    const consumed = depthRef.current > 0;


    if (consumed) {
      navigate(-1);
    }
    if (!sdk?.navigation.router) {
      return;
    }

    await sdk.navigation.router.back(consumed);
  }, [sdk, navigate]);

  useEffect(() => {
    goBackRef.current = goBack;
  }, [goBack]);


  useEffect(() => {
    if (!sdk || !isReady) {
      return;
    }

    return sdk.on(NAVIGATION_EVENTS.BACK_REQUESTED, () => {
      void goBackRef.current();
    });
  }, [sdk, isReady]);
}