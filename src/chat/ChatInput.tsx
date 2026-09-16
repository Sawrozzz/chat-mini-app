import type { RefObject } from "react";
import { SendHorizonal } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isLoading: boolean;
  isDark: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function ChatInput({ value, onChange, onSend, onKeyDown, isLoading, isDark, inputRef }: ChatInputProps) {
  return (
    <div
      className={`shrink-0 border-t px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4 ${isDark ? "border-neutral-800 bg-neutral-900" : "border-neutral-200 bg-neutral-100"}`}
    >
      <div
        className={`flex items-center gap-2 rounded-xl pl-4 pr-1.5 ring-1 transition-shadow focus-within:ring-2 focus-within:ring-neutral-400 ${isDark ? " ring-neutral-700" : "ring-neutral-200"}`}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about National ID, GIC services…"
          disabled={isLoading}
          maxLength={200}
          className={`flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-neutral-400 disabled:opacity-50 ${isDark ? "text-neutral-100 placeholder:text-neutral-500" : "text-neutral-900 placeholder:text-neutral-400"}`}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || isLoading}
          aria-label="Send message"
          className={`group/send flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${isDark
            ? "bg-[#dc9a0d] text-neutral-900 hover:bg-[#e3ab38] active:bg-[#c98e0a]"
            : "bg-[#dc9a0d] text-white hover:bg-[#e3ab38] active:bg-[#c98e0a]"}`}
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
