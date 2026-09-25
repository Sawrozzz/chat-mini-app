import { useEffect, useReducer, useRef, type ReactNode } from "react";
import { SDKContext } from "../context/SdkContext";
import { retry } from "../utils/retry";
import { LoadError } from "../components/LoadError";
import { useHostRouter } from "../hooks/useHostRouter";

type State =
  | { phase: "loading" }
  | { phase: "ready"; sdk: SewaPlatformSdk; user: SdkPlatformUser | null }
  | { phase: "error"; error: Error };

type Action =
  | { type: "ready"; sdk: SewaPlatformSdk; user: SdkPlatformUser | null }
  | { type: "error"; error: Error };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case "ready":
      return { phase: "ready", sdk: action.sdk, user: action.user };
    case "error":
      return { phase: "error", error: action.error };
  }
}

function getSDK() {
  const instance = window.__SEWA_SDK__ ?? null;
  if (!instance) throw new Error("SDK not available");
  return instance;
}

function PlatformSDKRuntime({
  children,
}: {
  children: ReactNode;
}) {
  useHostRouter();

  return <>{children}</>;
}

export function PlatformSDKProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { phase: "loading" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const init = async () => {
      try {
        const instance = await retry(() => getSDK(), {
          maxAttempts: 10,
          delayMs: 200,
          signal: controller.signal,
        });
        const user = await instance.auth.getUser();
        if (!controller.signal.aborted) {
          dispatch({ type: "ready", sdk: instance, user: user ?? null });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          dispatch({
            type: "error",
            error:
              error instanceof Error
                ? error
                : new Error("SDK initialization failed"),
          });
        }
      }
    };

    init();

    return () => controller.abort();
  }, []);

  if (state.phase === "error") {
    return <LoadError message={state.error.message} />;
  }

  if (state.phase === "loading") {
    return <div>Connecting to platform...</div>;
  }

  return (
    <SDKContext.Provider
      value={{ sdk: state.sdk, user: state.user, isReady: true, error: null }}
    >
       <PlatformSDKRuntime>{children}</PlatformSDKRuntime>
    </SDKContext.Provider>
  );
}