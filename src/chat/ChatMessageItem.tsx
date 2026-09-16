import { Bot, User } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";
import type { ChatMessage } from "./types";

interface ChatMessageItemProps {
  message: ChatMessage;
  isDark: boolean;
  isLast: boolean;
  isLoading: boolean;
}

export function ChatMessageItem({ message: msg, isDark, isLast, isLoading }: ChatMessageItemProps) {
  const showTyping = isLoading && msg.role === "ai" && msg.content === "" && isLast;
  const showCursor = isLoading && msg.role === "ai" && isLast && !showTyping;

  return (
    <div
      className={`flex items-end gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-fade-in`}
    >
      {msg.role === "ai" ? (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isDark ? "bg-neutral-800 text-neutral-400" : "bg-neutral-200 text-neutral-500"}`}
        >
          <Bot className="h-4 w-4" />
        </div>
      ) : (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isDark ? "bg-white text-neutral-900" : "bg-neutral-900 text-white"}`}
        >
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
          {showTyping ? (
            <TypingIndicator isDark={isDark} />
          ) : (
            <>
              {msg.content}
              {showCursor && (
                <span
                  className={`ml-0.5 inline-block h-4 w-0.5 animate-blink align-middle ${isDark ? "bg-neutral-100" : "bg-neutral-900"}`}
                />
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
  );
}
