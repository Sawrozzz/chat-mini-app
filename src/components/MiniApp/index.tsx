import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { useAppearance } from "../../hooks/useAppearance"
import { usePlatformSDK } from "../../hooks/usePlatformSDK"


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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const aiMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: "ai", content: "", timestamp: new Date() },
    ]);

    try {
      const result = await sdk!.http.stream({
        messages: [{ role: "user", content: trimmed }],
      });
      const stream =
        typeof (result as { iterate?: () => AsyncIterable<string | Uint8Array> }).iterate === "function"
          ? (result as unknown as { iterate: () => AsyncIterable<string | Uint8Array> }).iterate()
          : (result as unknown as AsyncIterable<string | Uint8Array>);

      let accumulated = "";
      for await (const chunk of stream) {
        const text =
          typeof chunk === "string"
            ? chunk
            : new TextDecoder().decode(chunk as Uint8Array);

        // Typewriter effect: type each chunk character by character
        let charIndex = 0;
        const chunkChars = text.split("");
        await new Promise<void>((resolve) => {
          const typeChar = () => {
            if (charIndex < chunkChars.length) {
              accumulated += chunkChars[charIndex];
              charIndex++;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, content: accumulated } : m,
                ),
              );
              // 15ms per character for a smooth typewriter feel
              setTimeout(typeChar, 15);
            } else {
              resolve();
            }
          };
          typeChar();
        });
      }
    } catch (err: unknown) {
      console.error("stream error:", err);
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: `⚠️ ${msg}` } : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDark = theme.mode === 'dark';

  const lastMessage = messages[messages.length - 1];

  // ------------------------------------------------------------------
  return (
    <div className={`flex min-h-dvh w-full items-center justify-center p-3 sm:p-6 ${isDark ? "bg-neutral-950" : "bg-neutral-100"}`}>
      <div
        className={`flex w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl ${isDark ? "border-neutral-800 bg-neutral-900 shadow-black/40" : "border-neutral-200 bg-white shadow-neutral-900/10"}`}
        style={{ height: "min(62dvh, 560px)" }}
      >
      {/* Header */}
      <header className={`flex shrink-0 items-center gap-3 border-b px-5 py-4 ${isDark ? "border-neutral-800 bg-neutral-900" : "border-neutral-200 bg-white"}`}>
        <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${isDark
          ? "bg-neutral-800 text-neutral-100"
          : "bg-neutral-100 text-neutral-900"}`}>
          <Sparkles className="h-5 w-5" />
          <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ${isDark ? "ring-neutral-900" : "ring-white"} ${isLoading ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} />
        </div>
        <div>
          <h2 className={`text-sm font-semibold ${isDark ? "text-neutral-100" : "text-neutral-900"}`}>
            AI Assistant
          </h2>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isLoading ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} />
            <span className={`text-xs ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>
              {isLoading ? "Thinking..." : "Online"}
            </span>
          </div>
        </div>
      </header>

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
                  ? `rounded-br-md ${isDark ? "bg-white text-neutral-900" : "bg-neutral-900 text-white"}`
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

      {/* Input */}
      <div className={`shrink-0 border-t px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4 ${isDark ? "border-neutral-800 bg-neutral-900" : "border-neutral-200 bg-white"}`}>
        <div className={`flex items-center gap-2 rounded-xl pl-4 pr-1.5 ring-1 transition-shadow focus-within:ring-2 focus-within:ring-neutral-400 ${isDark
          ? "bg-neutral-800 ring-neutral-700"
          : "bg-neutral-100 ring-neutral-200"}`}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading}
            className={`flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-neutral-400 disabled:opacity-50 ${isDark ? "text-neutral-100 placeholder:text-neutral-500" : "text-neutral-900 placeholder:text-neutral-400"}`}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className={`group/send flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 ${isDark
              ? "bg-white text-neutral-900 hover:bg-neutral-100"
              : "bg-neutral-900 text-white hover:bg-neutral-800"}`}
          >
            <Send className="h-4 w-4 transition-transform group-hover/send:translate-x-0.5" />
          </button>
        </div>
        <p className={`mt-2 text-center text-[10px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
          AI responses are generated live and may vary.
        </p>
      </div>
      </div>
    </div>
  );
}
