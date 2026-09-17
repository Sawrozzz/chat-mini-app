import { useEffect, useState } from "react";
import { Bot, User, Volume2, VolumeX } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";
import { isSpeechOutputSupported, speak, stopSpeaking } from "../voice/speech";
import type { ChatMessage } from "./types";

interface ChatMessageItemProps {
  message: ChatMessage;
  isDark: boolean;
  isLast: boolean;
  isLoading: boolean;
}

export function ChatMessageItem({ message: msg, isDark, isLast, isLoading }: ChatMessageItemProps) {
  const [speaking, setSpeaking] = useState(false);
  const isAssistant = msg.role !== "user";
  const showTyping = isLoading && isAssistant && msg.content === "" && !msg.audioUrl && isLast;
  const showCursor = isLoading && isAssistant && isLast && !showTyping;
  const canSpeak = isAssistant && msg.content !== "" && isSpeechOutputSupported();

  useEffect(() => () => {
    if (speaking) stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(msg.content, () => setSpeaking(false));
  };

  return (
    <div
      className={`flex items-end gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-fade-in`}
    >
      {isAssistant ? (
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
              {msg.audioUrl && (
                <audio
                  controls
                  preload="metadata"
                  src={msg.audioUrl}
                  className="mb-1 max-w-full"
                />
              )}
              {msg.content}
              {/* Typewriter cursor while tokens stream in */}
              {showCursor && (
                <span
                  className={`ml-0.5 inline-block h-4 w-0.5 animate-blink align-middle ${isDark ? "bg-neutral-100" : "bg-neutral-900"}`}
                />
              )}
            </>
          )}
        </div>
        <div
          className={`mt-1 flex items-center gap-2 text-[10px] ${msg.role === "user" ? "justify-end" : "justify-start"} ${isDark ? "text-neutral-500" : "text-neutral-400"}`}
        >
          {canSpeak && !showTyping && (
            <button
              onClick={toggleSpeak}
              aria-label={speaking ? "Stop reading aloud" : "Read aloud"}
              className={`flex items-center gap-1 rounded transition-colors hover:opacity-80 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
            >
              {speaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              {speaking ? "Stop" : "Listen"}
            </button>
          )}
          <p>
            {msg.timestamp?.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
