import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Search, SendHorizonal, User } from "lucide-react";
import { useAppearance } from "../../hooks/useAppearance"
import { usePlatformSDK } from "../../hooks/usePlatformSDK"
import { useGicChat } from "../../hooks/useGicChat"


// const MODULE_ID = "chat-mini-app";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp?: Date;
}


export default function TestMiniApp() {

  return (
    <ChatApp />
  )
}

function TypingIndicator({ isDark }: { isDark: boolean }) {
  return (
    <span className="flex items-center gap-2 py-0.5">
      <span className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 animate-typing-bounce rounded-full ${isDark ? "bg-neutral-400" : "bg-neutral-500"}`}
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      <span className={`text-xs font-medium ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>
        Thinking
      </span>
    </span>
  );
}

function ChatApp() {

  const { sdk } = usePlatformSDK();
  const { theme } = useAppearance();
  const gic = useGicChat();

  const [messages, setMessages] = useState<Message[]>([
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
  // Typewriter state: the backend flushes all token frames in one burst after
  // ~6s, so we queue received text and reveal it progressively for a
  // streaming feel. Refs (not state) so interval ticks don't re-render.
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

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setGicStatus(gic.session ? null : "Starting session via HTTP POST…");

    const aiMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: "ai", content: "", timestamp: new Date() },
    ]);

    // GIC flow: mini-app initiated HTTP POST for session (sdk.gicChat.startSession → http.post via host proxy),
    // then streaming via GIC SSE (tool_call / token / meta / done / error)
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
          const result = await sdk.http.stream({ messages: [{ role: "user", content: trimmed }] });
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

  const isDark = theme.mode === 'dark';

  const lastMessage = messages[messages.length - 1];

  return (
    <>
      <div
        className={`flex flex-col w-full ${isDark ? "bg-neutral-900" : "bg-neutral-50"}`}
        style={{ height: "min(62dvh, 536px)" }}
      >
      {(gicStatus === "Searching knowledge base…" || gic.status === "searching") && (
        <div className={`flex items-center gap-2 border-b px-5 py-2 text-xs ${isDark ? "border-neutral-800 bg-neutral-900 text-neutral-400" : "border-neutral-200 bg-neutral-50 text-neutral-600"}`}>
          <Search className="h-3.5 w-3.5 animate-pulse" />
          <span>Searching knowledge base…</span>
          <span className={`ml-auto text-[10px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>tool_call → tool_result</span>
        </div>
      )}

      {/* Messages */}
      <div className="chat-scroll flex-1 space-y-5 overflow-y-auto px-5 py-5 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-end gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-fade-in`}
          >
            {msg.role === "ai" ? (
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isDark
                ? "bg-neutral-800 text-neutral-400"
                : "bg-neutral-200 text-neutral-500"}`}>
                <Bot className="h-4 w-4" />
              </div>
            ) : (
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isDark
                ? "bg-white text-neutral-900"
                : "bg-neutral-900 text-white"}`}>
                <User className="h-4 w-4" />
              </div>
            )}
            <div className="group max-w-[80%]">
              <div
                className={`whitespace-pre-wrap wrap-break-word rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user"
                   ? `rounded-br-md ${isDark ? "bg-white text-neutral-900" : "bg-neutral-400/90 text-neutral-900"}`
                  : `rounded-bl-md ${isDark ? "bg-neutral-800 text-neutral-100" : "bg-neutral-100 text-neutral-900"}`
                  }`}
              >
                {isLoading && msg.role === "ai" && msg.content === "" && msg.id === lastMessage?.id ? (
                  <TypingIndicator isDark={isDark} />
                ) : (
                  <>
                    {msg.content}
                    {isLoading &&
                      msg.role === "ai" &&
                      msg.id === lastMessage?.id && (
                        <span className={`ml-0.5 inline-block h-4 w-0.5 animate-blink align-middle ${isDark ? "bg-neutral-100" : "bg-neutral-900"}`} />
                      )}
                  </>
                )}
              </div>
              <p
                className={`mt-1 text-[10px] ${msg.role === "user" ? "text-right" : "text-left"} ${isDark ? "text-neutral-500" : "text-neutral-400"}`}
              >
                {msg.timestamp?.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className={`shrink-0 border-t px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4 ${isDark ? "border-neutral-800 bg-neutral-900" : "border-neutral-200 bg-neutral-100"}`}>
        <div className={`flex items-center gap-2 rounded-xl pl-4 pr-1.5 ring-1 transition-shadow focus-within:ring-2 focus-within:ring-neutral-400 ${isDark
          ? " ring-neutral-700"
          : "ring-neutral-200"}`}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about National ID, GIC services…"
            disabled={isLoading}
            maxLength={200}
            className={`flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-neutral-400 disabled:opacity-50 ${isDark ? "text-neutral-100 placeholder:text-neutral-500" : "text-neutral-900 placeholder:text-neutral-400"}`}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className={`group/send flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${isDark
              ? "bg-[#dc9a0d] text-neutral-900 hover:bg-[#e3ab38] active:bg-[#c98e0a]"
              : "bg-[#dc9a0d] text-white hover:bg-[#e3ab38] active:bg-[#c98e0a]"}`}
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
