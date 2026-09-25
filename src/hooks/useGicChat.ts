import { useCallback, useEffect, useRef, useState } from "react";
import { usePlatformSDK } from "./usePlatformSDK";
import { getEnv } from "../env";
import { apiRequest } from "../utils/api";

export type GicStatus = "idle" | "starting" | "ready" | "searching" | "composing" | "error";

type StreamBuilderLike = {
  iterate: () => AsyncIterable<string | Uint8Array>;
  waitUntilDone: () => Promise<void>;
};

function toStreamBuilder(result: unknown): StreamBuilderLike {
  const r = result as {
    iterate?: () => AsyncIterable<string | Uint8Array>;
  };
  if (r && typeof r.iterate === "function") return r as StreamBuilderLike;
  
  const iterable = result as AsyncIterable<string | Uint8Array>;
  return {
    iterate: () => iterable,
    waitUntilDone: async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iterable) {
        /* drain */
      }
    },
  };
}

/** One parsed SSE frame from the shared SDK parser (`sdk.stream.parseSseStream`). */
interface SseEvent {
  type: string;
  [key: string]: unknown;
}

type ParseSseStream = (
  chunks: AsyncIterable<string | Uint8Array>,
) => AsyncGenerator<SseEvent>;

/**
 * Resolves the shared SSE parser from the host-injected SDK instance. The
 * host forwards BFF bytes verbatim, so all framing interpretation lives in
 * the SDK (`@lizuz/sewa-sdk >= 1.1.0`) — shared by every host platform.
 */
function getSseParser(sdk: SewaPlatformSdk): ParseSseStream {
  const parse = (sdk as unknown as { stream?: { parseSseStream?: unknown } }).stream
    ?.parseSseStream;
  if (typeof parse !== "function") {
    throw new Error("Host SDK too old — stream.parseSseStream missing (need @lizuz/sewa-sdk >= 1.1.0)");
  }
  return parse as ParseSseStream;
}

function normalizeSession(data: unknown): SdkGicChatSession {
  const root = (data ?? {}) as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : null;
  const pick = (obj: Record<string, unknown>, ...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v) return v;
    }
    return undefined;
  };
  const user_id =
    pick(root, "user_id", "userId") ?? (nested ? pick(nested, "user_id", "userId") : undefined);
  const session_id =
    pick(root, "session_id", "sessionId") ??
    (nested ? pick(nested, "session_id", "sessionId") : undefined);
  if (!user_id || !session_id) {
    throw new Error("Invalid session response from host");
  }
  const status = pick(root, "status", "message") ?? "success";
  return { status, user_id, session_id };
}

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
      const res = (await apiRequest(sdk, "POST", {
        path: getEnv('VITE_START_CHAT_SESSION_ROUTE') ?? "/chat/session",
        headers: {
          "x-mini-app-id": sdk.miniAppId
        }
      })) as { data?: unknown };
      const s = normalizeSession(
        (res as { data?: unknown })?.data ?? res,
      );
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
        onAudio?: (url: string, mimeType?: string) => void;
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
        const raw = await apiRequest(sdk, "POST", {
          path: getEnv('VITE_CHAT_STREAM_ROUTE') ?? "/chat/stream",
          headers: {
            "x-mini-app-id": sdk.miniAppId
          },
          body: { userId: s.user_id, sessionId: s.session_id, message },
          stream: true,
          signal: controller.signal,
        });
        const builder = toStreamBuilder(raw as unknown);
        const parseSse = getSseParser(sdk);

        let invocationId: string | undefined;
        let done = false;
        let sawEvent = false;
        for await (const event of parseSse(builder.iterate())) {
          sawEvent = true;
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
              if (id) {
                invocationId = id;
                handlers.onMeta?.(id);
              }
              break;
            }
            case "audio": {
              const url =
                (event as { url?: string }).url ?? (event as { data?: string }).data;
              const mimeType = (event as { mimeType?: string }).mimeType;
              if (url) handlers.onAudio?.(url, mimeType);
              break;
            }
            case "done":
              setStatus("ready");
              handlers.onDone?.();
              done = true;
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
          if (done) break;
        }
        await builder.waitUntilDone().catch(() => {});
        if (!sawEvent) {
          // Dumb host forwarded a body the SSE parser yielded nothing from
          // (e.g. a raw BFF error payload) — surface it instead of "No response."
          const detail = "Empty stream response from host";
          setError(detail);
          setStatus("error");
          handlers.onError?.(detail);
          return { invocation_id: invocationId };
        }
        setStatus("ready");
        return { invocation_id: invocationId };
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          setStatus("ready");
          return {};
        }
        const msg = e instanceof Error ? e.message : String(e);
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
