import { useCallback, useEffect, useRef, useState } from "react";
import { usePlatformSDK } from "./usePlatformSDK";

export type GicStatus = "idle" | "starting" | "ready" | "searching" | "composing" | "error";

/**
 * Endpoint-free GIC chat over `api.request`.
 *
 * - Session (on load): unary `api.request({ method: "POST",
 *   body: { action: "session.start", channel: "gic" } })` — the host maps to
 *   its own session endpoint (`/api/mock/session`). No URLs in the mini app.
 * - Chat: `api.request({ method: "STREAM",
 *   body: { channel: "gic", user_id, session_id, message },
 *   stream: { signal } })` — the host maps to its own stream endpoint and
 *   bridges SSE events back as JSON-stringified `GicChatEvent` chunks.
 */
type StreamBuilderLike = {
  iterate: () => AsyncIterable<string | Uint8Array>;
  waitUntilDone: () => Promise<void>;
};

function toStreamBuilder(result: unknown): StreamBuilderLike {
  const r = result as {
    iterate?: () => AsyncIterable<string | Uint8Array>;
  };
  if (r && typeof r.iterate === "function") return r as StreamBuilderLike;
  // Already an async iterable (older SDK shape) — wrap it.
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

function normalizeSession(data: unknown): SdkGicChatSession {
  const root = (data ?? {}) as Record<string, unknown>;
  // Host may return the flat GIC shape, camelCase, or the mock envelope
  // `{ data: { userId, sessionId } }`.
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
      // Endpoint-free: host resolves the session endpoint internally.
      const res = await sdk.api.request({
        method: "POST",
        body: { action: "session.start", channel: "gic" },
      } as unknown as Parameters<typeof sdk.api.request>[0]);
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
        // Endpoint-free STREAM — host routes `channel: "gic"` to the GIC
        // stream and bridges each SSE event back as a stream chunk.
        const raw = await sdk.api.request({
          method: "STREAM",
          body: { channel: "gic", user_id: s.user_id, session_id: s.session_id, message },
          stream: { signal: controller.signal },
        } as unknown as Parameters<typeof sdk.api.request>[0]);
        const builder = toStreamBuilder(raw as unknown);

        let invocationId: string | undefined;
        let done = false;
        for await (const chunk of builder.iterate()) {
          const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
          if (!text) continue;
          let event: SdkGicChatEvent;
          try {
            event = JSON.parse(text) as SdkGicChatEvent;
          } catch {
            continue;
          }
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
        setStatus("ready");
        return { invocation_id: invocationId };
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
