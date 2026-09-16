import type { RefObject } from "react";
import { ChatMessageItem } from "./ChatMessageItem";
import type { ChatMessage } from "./types";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isDark: boolean;
  isLoading: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function ChatMessageList({ messages, isDark, isLoading, messagesEndRef }: ChatMessageListProps) {
  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className="chat-scroll flex-1 space-y-5 overflow-y-auto px-5 py-5 scroll-smooth">
      {messages.map((msg) => (
        <ChatMessageItem
          key={msg.id}
          message={msg}
          isDark={isDark}
          isLoading={isLoading}
          isLast={msg.id === lastId}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
