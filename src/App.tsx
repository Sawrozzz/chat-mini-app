import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Bot, User, Sparkles, X } from "lucide-react";
import "./index.css";

const MODULE_ID = "chat-mini-app";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

function useBridgeServices() {
  const [services, setServices] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const bridge = (window as any).__GOV_PLATFORM_BRIDGE__;
    if (bridge?.getServices) {
      setServices(bridge.getServices(MODULE_ID));
    } else {
      setError(new Error("Platform bridge not available"));
    }
  }, []);

  return { services, error };
}

function App() {
  const { services, error } = useBridgeServices();
  const [isChatOpen, setIsChatOpen] = useState(false);
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
  const [isFabHovered, setIsFabHovered] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    if (isChatOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isChatOpen]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !services) return;

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
      const result = await services.chat.chat(
        [{ role: "user", content: trimmed }],
        {},
      );

      let full = "";
      let pending = "";
      let rafId: number | null = null;

      const flush = () => {
        if (!pending) return;
        const snapshot = pending;
        pending = "";
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: snapshot } : m)),
        );
      };

      for await (const chunk of result.iterate()) {
        const text =
          typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
        full += text;
        pending = full;
        if (!rafId) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            flush();
          });
        }
      }
      if (rafId) cancelAnimationFrame(rafId);
      flush();
    } catch (err: unknown) {
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

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "white" }}>
        <p>Failed to connect to platform shell.</p>
        <p style={{ fontSize: 12, color: "#999" }}>{error.message}</p>
      </div>
    );
  }

  if (!services) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "white" }}>
        Connecting to platform...
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-linear-to-br from-gray-950 via-slate-900 to-indigo-950">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-indigo-400/5 blur-3xl" />
      </div>

      {/* Landing page */}
      <div className="relative z-10 flex flex-col items-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-400 to-purple-600 shadow-2xl shadow-indigo-500/30">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="bg-linear-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
          Welcome
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-gray-400 sm:text-base">
          Need help or have a question? Click the button below to start a
          conversation with your AI assistant.
        </p>
      </div>

      {/* FAB */}
      <div
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 sm:bottom-8 sm:right-8"
        onMouseEnter={() => setIsFabHovered(true)}
        onMouseLeave={() => setIsFabHovered(false)}
      >
        <span
          className={`whitespace-nowrap rounded-full bg-gray-900/80 px-4 py-2 text-sm font-medium text-gray-300 shadow-lg transition-all duration-300 ease-out ${isFabHovered ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0 pointer-events-none"}`}
        >
          Ask AI
        </span>
        <button
          onClick={() => setIsChatOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-2xl shadow-indigo-500/30 transition-all duration-300 hover:scale-110 hover:shadow-indigo-500/50 active:scale-95 sm:h-16 sm:w-16"
        >
          <div className="absolute inset-0 rounded-full bg-linear-to-br from-indigo-400 to-purple-500 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-60" />
          <MessageCircle className="relative h-6 w-6 sm:h-7 sm:w-7" />
        </button>
      </div>

      {/* Chat Panel */}
      {isChatOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsChatOpen(false)}
          />
          <div
            className="fixed bottom-0 right-0 z-50 flex flex-col overflow-hidden bg-gray-900/80 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all sm:bottom-6 sm:right-6 sm:rounded-2xl sm:border sm:border-gray-800/60"
            style={{ width: "min(100vw, 400px)", height: "min(100dvh, 560px)" }}
          >
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b border-gray-800/60 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    AI Assistant
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm" />
                    <span className="text-xs text-gray-400">Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 scroll-smooth">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-end gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-fade-in`}
                >
                  {msg.role === "ai" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500/20 to-purple-600/20 ring-1 ring-indigo-500/30">
                      <Bot className="h-4 w-4 text-indigo-400" />
                    </div>
                  )}
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className="group max-w-[80%]">
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-linear-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20"
                          : "bg-gray-800/90 text-gray-100 shadow-sm"
                      }`}
                      style={{
                        borderRadius:
                          msg.role === "user"
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                      }}
                    >
                      {msg.content ? (
                        <>
                          {msg.content}
                          {isLoading &&
                            msg.role === "ai" &&
                            msg.id === messages[messages.length - 1].id && (
                              <span className="inline-block w-1.5 h-4 ml-1 translate-y-0.5 bg-indigo-400 animate-pulse rounded-xs" />
                            )}
                        </>
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      )}
                    </div>
                    <p
                      className={`mt-1 text-[10px] text-gray-500 ${msg.role === "user" ? "text-right" : "text-left"}`}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.content === "" && (
                <div className="flex items-end gap-3 animate-fade-in">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500/20 to-purple-600/20 ring-1 ring-indigo-500/30">
                    <Bot className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div
                    className="rounded-2xl bg-gray-800/90 px-4 py-3 shadow-sm"
                    style={{ borderRadius: "18px 18px 18px 4px" }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="shrink-0 border-t border-gray-800/60 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2 rounded-xl bg-gray-800/60 pl-4 pr-1.5 ring-1 ring-gray-700/50 focus-within:ring-2 focus-within:ring-indigo-500/50">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent py-3 text-sm text-white placeholder-gray-500 outline-none disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 transition-all disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;