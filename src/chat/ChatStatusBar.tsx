import { Search } from "lucide-react";

interface ChatStatusBarProps {
  isDark: boolean;
  visible: boolean;
}

export function ChatStatusBar({ isDark, visible }: ChatStatusBarProps) {
  if (!visible) return null;

  return (
    <div
      className={`flex items-center gap-2 border-b px-5 py-2 text-xs ${isDark ? "border-neutral-800 bg-neutral-900 text-neutral-400" : "border-neutral-200 bg-neutral-50 text-neutral-600"}`}
    >
      <Search className="h-3.5 w-3.5 animate-pulse" />
      <span>Searching knowledge base…</span>
      <span className={`ml-auto text-[10px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
        tool_call → tool_result
      </span>
    </div>
  );
}
