export function TypingIndicator({ isDark }: { isDark: boolean }) {
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
