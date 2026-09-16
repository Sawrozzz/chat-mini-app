import { useCallback, useEffect, useRef, useState } from "react";
import { usePlatformSDK } from "../hooks/usePlatformSDK";
import { useGicChat } from "../hooks/useGicChat";
import type { ChatMessage } from "./types";

export function useChatController() {
  const { sdk } = usePlatformSDK();
  const gic = useGicChat();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "ai",
      content:
        "Hello! I'm your intelligent assistant. Feel free to ask me anything.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gicStatus, setGicStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const typewriterRef = useRef<{
    queue: string;
    displayed: string;
    msgId: string | null;
    timer: ReturnType<typeof setInterval> | null;
    resolveDrain: (() => void) | null;
  }>({ queue: "", displayed: "", msgId: null, timer: null, resolveDrain: null });

  useEffect(() => () => {
    const t = typewriterRef.current;
    if (t.timer) clearInterval(t.timer);
    t.timer = null;
    t.resolveDrain = null;
  }, []);

  useEffect(() => {
    // "auto" (not "smooth"): the typewriter updates ~55x/s and re-triggering
    // a smooth scroll that often janks; instant follow stays glued to bottom.
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    if (trimmed.length > 200) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: trimmed, timestamp: new Date() },
        { id: crypto.randomUUID(), role: "ai", content: "Message must be ≤200 characters per GIC spec.", timestamp: new Date() },
      ]);
      setInput("");
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setGicStatus(gic.session ? null : "Starting session…");

    const aiMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: "ai", content: "", timestamp: new Date() },
    ]);

    // Endpoint-free GIC flow: session + STREAM both go through api.request
    // (host owns endpoint mapping), streaming GIC SSE
    // (tool_call / token / meta / done / error)
    //
    // Typewriter setup: backend frames arrive in one burst, so tokens are
    // queued here and revealed by the interval below (~110 chars/s).
    const tw = typewriterRef.current;
    if (tw.timer) clearInterval(tw.timer);
    tw.queue = "";
    tw.displayed = "";
    tw.msgId = aiMsgId;
    tw.resolveDrain = null;
    let fullText = "";
    let streamDone = false;
    const drainPromise = new Promise<void>((resolve) => {
      tw.resolveDrain = resolve;
    });
    const finishDrain = () => {
      const t = typewriterRef.current;
      if (t.timer) {
        clearInterval(t.timer);
        t.timer = null;
      }
      t.resolveDrain?.();
      t.resolveDrain = null;
    };
    // Drain the queue with a typewriter reveal; snaps remainder on timeout.
    const drainTypewriter = async () => {
      streamDone = true;
      if (reduceMotion) {
        finishDrain();
        return;
      }
      await Promise.race([drainPromise, new Promise((r) => setTimeout(r, 8000))]);
      const t = typewriterRef.current;
      if (t.queue) {
        t.displayed += t.queue;
        t.queue = "";
        const content = t.displayed;
        setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content } : m)));
      }
      finishDrain();
    };
    // Drop pending animation on error (message content is set by caller).
    const abortTypewriter = () => {
      streamDone = true;
      const t = typewriterRef.current;
      if (t.timer) {
        clearInterval(t.timer);
        t.timer = null;
      }
      t.queue = "";
      t.resolveDrain?.();
      t.resolveDrain = null;
    };
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Queue incoming text; revealed progressively unless reduced-motion.
    const enqueueToken = (text: string) => {
      if (!text) return;
      fullText += text;
      setGicStatus(null);
      if (reduceMotion) {
        const t = typewriterRef.current;
        t.displayed += text;
        const id = t.msgId;
        const content = t.displayed;
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
      } else {
        typewriterRef.current.queue += text;
      }
    };

    if (!reduceMotion) {
      tw.timer = setInterval(() => {
        const t = typewriterRef.current;
        if (!t.queue) {
          if (streamDone) finishDrain();
          return;
        }
        // Adaptive pace: faster when a lot arrived at once.
        const perTick = t.queue.length > 120 ? 4 : 2;
        t.displayed += t.queue.slice(0, perTick);
        t.queue = t.queue.slice(perTick);
        const id = t.msgId;
        const content = t.displayed;
        setGicStatus(null);
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
        if (!t.queue && streamDone) finishDrain();
      }, 18);
    }

    try {
      if (!gic.session && gic.status === "error") {
        await gic.startSession();
      }

      let invocationId: string | undefined;

      await gic.sendMessage(trimmed, {
        onToolCall: () => setGicStatus("Searching knowledge base…"),
        onToolResult: () => setGicStatus("Composing response…"),
        onKeepAlive: () => setGicStatus("Composing response…"),
        onToken: enqueueToken,
        onMeta: (id) => {
          invocationId = id;
        },
        onDone: () => {
          setGicStatus(null);
          if (invocationId) console.log("[GIC] invocation_id:", invocationId);
        },
        onError: (detail) => {
          // "not configured" falls through to the generic-chat fallback below,
          // which reuses the running typewriter — don't tear it down here.
          const lower = detail.toLowerCase();
          if (lower.includes("not configured") || lower.includes("not_supported")) return;
          abortTypewriter();
          setGicStatus(null);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: `⚠️ ${detail}` } : m,
            ),
          );
        },
      });

      // All frames received (usually in one burst) — play out the typewriter,
      // then snap any remainder so nothing is lost.
      await drainTypewriter();

      // If no tokens arrived but no error was surfaced, ensure we show something
      setMessages((prev) => {
        const target = prev.find((m) => m.id === aiMsgId);
        if (target && target.content === "") {
          return prev.map((m) => (m.id === aiMsgId ? { ...m, content: fullText || "No response." } : m));
        }
        return prev;
      });
    } catch (err: unknown) {
      // Fallback: if GIC not configured on host, try generic http.stream
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      const isNotConfigured = msg.toLowerCase().includes("not configured") || msg.toLowerCase().includes("not_supported");
      if (isNotConfigured && sdk) {
        try {
          setGicStatus("GIC not configured — falling back to generic chat…");
          // Endpoint-free generic chat — `channel` omitted so the host
          // applies its `generic` default. No URLs in the mini app.
          const result = await sdk.api.request({
            method: "STREAM",
            body: { messages: [{ role: "user", content: trimmed }] },
          } as unknown as Parameters<typeof sdk.api.request>[0]);
          const stream =
            typeof (result as { iterate?: () => AsyncIterable<string | Uint8Array> }).iterate === "function"
              ? (result as unknown as { iterate: () => AsyncIterable<string | Uint8Array> }).iterate()
              : (result as unknown as AsyncIterable<string | Uint8Array>);
          for await (const chunk of stream) {
            const t = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk as Uint8Array);
            enqueueToken(t);
          }
          await drainTypewriter();
          setGicStatus(null);
          return;
        } catch (fallbackErr) {
          abortTypewriter();
          const fm = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: `⚠️ ${fm}` } : m)));
        }
      } else if (!String(msg).includes("GIC stream error") || gic.error) {
        console.error("GIC stream error:", err);
        abortTypewriter();
        // error already surfaced via onError; ensure placeholder not left empty
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId && m.content === "" ? { ...m, content: fullText || `⚠️ ${msg}` } : m,
          ),
        );
      }
    } finally {
      setIsLoading(false);
      setGicStatus(null);
    }
  }, [input, isLoading, gic, sdk]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    gicStatus,
    gicState: gic.status,
    messagesEndRef,
    inputRef,
    handleSend,
    handleKeyDown,
  };
}
