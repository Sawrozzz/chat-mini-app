import { useAppearance } from "../hooks/useAppearance";
import { useChatController } from "./useChatController";
import { ChatStatusBar } from "./ChatStatusBar";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";

export default function ChatApp() {
  const { theme } = useAppearance();
  const {
    messages,
    input,
    setInput,
    isLoading,
    gicStatus,
    gicState,
    messagesEndRef,
    inputRef,
    handleSend,
    handleKeyDown,
  } = useChatController();

  const isDark = theme.mode === "dark";
  const showSearching = gicStatus === "Searching knowledge base…" || gicState === "searching";

  return (
    <div
      className={`flex flex-col w-full ${isDark ? "bg-neutral-900" : "bg-neutral-50"}`}
      style={{ height: "min(62dvh, 536px)" }}
    >
      <ChatStatusBar isDark={isDark} visible={showSearching} />

      <ChatMessageList
        messages={messages}
        isDark={isDark}
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
      />

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        isLoading={isLoading}
        isDark={isDark}
        inputRef={inputRef}
      />
    </div>
  );
}
