import { useCallback, useEffect, useRef, useState } from "react";
import { usePlatformSDK } from "./usePlatformSDK";

export type GicStatus = "idle" | "starting" | "ready" | "searching" | "composing" | "error";

export function useGicChat() {
  const { sdk, isReady } = usePlatformSDK();
  const [session, setSession] = useState<SdkGicChatSession | null>(null);
  const [status, setStatus] = useState<GicStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<SdkGicChatSession | null>(null);
  sessionRef.current = session;

  const startSession = useCallback(async () => {
    if (!sdk) throw new Error("SDK not ready");
    setStatus("starting");
    setError(null);
    try {
      // Mini-app initiated HTTP POST: sdk.gicChat.startSession now does
      // config.get(gicChatBaseUrl) + http.post via host proxy
      const s = await sdk.gicChat.startSession();
      setSession(s);
      setStatus("ready");
      return s;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("error");
      throw e;
    }
  }, [sdk]);

  // Auto-establish session when SDK becomes ready
  useEffect(() => {
    if (!isReady || !sdk || session) return;
    void startSession().catch(() => {});
  }, [isReady, sdk, session, startSession]);

  const sendMessage = useCallback(
    async (
      message: string,
      handlers: {
        onToken?: (text: string) => void;
        onToolCall?: () => void;
        onToolResult?: () => void;
        onKeepAlive?: () => void;
        onMeta?: (invocationId: string) => void;
        onDone?: () => void;
        onError?: (detail: string) => void;
      } = {},
    ): Promise<{ invocation_id?: string }> => {
      if (!sdk) throw new Error("SDK not ready");
      let s = sessionRef.current;
      if (!s) {
        s = await startSession();
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setStatus("composing");

      try {
        const result = await sdk.gicChat.stream(
          { user_id: s.user_id, session_id: s.session_id, message },
          {
            signal: controller.signal,
            onEvent: (event: SdkGicChatEvent) => {
              switch (event.type) {
                case "tool_call":
                  setStatus("searching");
                  handlers.onToolCall?.();
                  break;
                case "tool_result":
                  setStatus("composing");
                  handlers.onToolResult?.();
                  break;
                case "keep_alive":
                  handlers.onKeepAlive?.();
                  break;
                case "token": {
                  const t = (event as { text?: string }).text ?? "";
                  if (t) handlers.onToken?.(t);
                  break;
                }
                case "meta": {
                  const id = (event as { invocation_id?: string }).invocation_id;
                  if (id) handlers.onMeta?.(id);
                  break;
                }
                case "done":
                  setStatus("ready");
                  handlers.onDone?.();
                  break;
                case "error": {
                  const detail = (event as { detail?: string }).detail ?? "GIC stream error";
                  setError(detail);
                  setStatus("error");
                  handlers.onError?.(detail);
                  break;
                }
                default:
                  break;
              }
            },
          },
        );
        setStatus("ready");
        return result;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          setStatus("ready");
          return {};
        }
        const msg = e instanceof Error ? e.message : String(e);
        // 404 session expired → clear and allow retry
        if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("expired")) {
          setSession(null);
        }
        setError(msg);
        setStatus("error");
        handlers.onError?.(msg);
        throw e;
      }
    },
    [sdk, startSession],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus("ready");
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSession(null);
    setError(null);
    setStatus("idle");
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { session, status, error, startSession, sendMessage, cancel, reset, isReady: status === "ready" };
}
