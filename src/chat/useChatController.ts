import { useCallback, useEffect, useRef, useState } from "react";
import { usePlatformSDK } from "../hooks/usePlatformSDK";
import { useGicChat } from "../hooks/useGicChat";
import { useVoiceRecorder } from "../voice/useVoiceRecorder";
import { isTranscriptionSupported, startTranscription } from "../voice/speech";
import type { ChatMessage } from "./types";

export function useChatController() {
  const { sdk } = usePlatformSDK();
  const gic = useGicChat();
  const voice = useVoiceRecorder();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "gicChat",
      content:
        "Hello! I'm your intelligent assistant. Feel free to ask me anything.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gicStatus, setGicStatus] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef("");
  const stopTranscriptionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  const runGicTurn = useCallback(
    async (trimmed: string, audio?: { url: string; mimeType: string }) => {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
        ...(audio ? { audioUrl: audio.url, audioMimeType: audio.mimeType } : {}),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setGicStatus(gic.session ? null : "Starting session…");

      const aiMsgId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: aiMsgId, role: "gicChat", content: "", timestamp: new Date() },
      ]);

      let fullText = "";
      const enqueueToken = (text: string) => {
        if (!text) return;
        fullText += text;
        setGicStatus(null);
        setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: m.content + text } : m)));
      };
      const attachAudio = (url: string, mimeType?: string) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, audioUrl: url, audioMimeType: mimeType } : m,
          ),
        );
      };

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
          onAudio: (url, mimeType) => attachAudio(url, mimeType),
          onDone: () => {
            setGicStatus(null);
            if (invocationId) console.log("[GIC] invocation_id:", invocationId);
          },
          onError: (detail) => {
            const lower = detail.toLowerCase();
            if (lower.includes("not configured") || lower.includes("not_supported")) return;
            setGicStatus(null);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: `⚠️ ${detail}` } : m,
              ),
            );
          },
        });

        setMessages((prev) => {
          const target = prev.find((m) => m.id === aiMsgId);
          if (target && target.content === "" && !target.audioUrl) {
            return prev.map((m) => (m.id === aiMsgId ? { ...m, content: fullText || "No response." } : m));
          }
          return prev;
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "An unexpected error occurred";
        const isNotConfigured = msg.toLowerCase().includes("not configured") || msg.toLowerCase().includes("not_supported");
        if (isNotConfigured && sdk) {
          try {
            setGicStatus("GIC not configured - falling back to generic chat…");
            const result = await sdk.api.request({
              method: "POST",
              endpoint: "/",
              body: { messages: [{ role: "user", content: trimmed }] },
              stream: true,
            } as unknown as Parameters<typeof sdk.api.request>[0]);
            const stream =
              typeof (result as { iterate?: () => AsyncIterable<string | Uint8Array> }).iterate === "function"
                ? (result as unknown as { iterate: () => AsyncIterable<string | Uint8Array> }).iterate()
                : (result as unknown as AsyncIterable<string | Uint8Array>);
            for await (const chunk of stream) {
              const t = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk as Uint8Array);
              enqueueToken(t);
            }
            setGicStatus(null);
            return;
          } catch (fallbackErr) {
            const fm = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: `⚠️ ${fm}` } : m)));
          }
        } else if (!String(msg).includes("GIC stream error") || gic.error) {
          console.error("GIC stream error:", err);
          // error already surfaced via onError; ensure placeholder not left empty
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId && m.content === "" && !m.audioUrl ? { ...m, content: fullText || `⚠️ ${msg}` } : m,
            ),
          );
        }
      } finally {
        setIsLoading(false);
        setGicStatus(null);
      }
    },
    [gic, sdk],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || voice.isRecording) return;

    if (trimmed.length > 200) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: trimmed, timestamp: new Date() },
        { id: crypto.randomUUID(), role: "gicChat", content: "Message must be ≤200 characters per GIC spec.", timestamp: new Date() },
      ]);
      setInput("");
      return;
    }

    await runGicTurn(trimmed);
  }, [input, isLoading, voice.isRecording, runGicTurn]);

  const handleMicToggle = useCallback(async () => {
    if (isLoading) return;
    setVoiceError(null);
    if (voice.isRecording) {
      stopTranscriptionRef.current?.();
      stopTranscriptionRef.current = null;
      const recorded = await voice.stop();
      const text = transcriptRef.current.trim();
      transcriptRef.current = "";
      if (text) {
        if (text.length > 200) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "user",
              content: text,
              timestamp: new Date(),
              ...(recorded ? { audioUrl: recorded.url, audioMimeType: recorded.mimeType } : {}),
            },
            { id: crypto.randomUUID(), role: "gicChat", content: "Message must be ≤200 characters per GIC spec.", timestamp: new Date() },
          ]);
          return;
        }
        await runGicTurn(text, recorded ? { url: recorded.url, mimeType: recorded.mimeType } : undefined);
      } else if (recorded) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: "🎤 Voice message",
            timestamp: new Date(),
            audioUrl: recorded.url,
            audioMimeType: recorded.mimeType,
          },
          {
            id: crypto.randomUUID(),
            role: "gicChat",
            content: "I couldn't transcribe that voice message on this device — please type your question.",
            timestamp: new Date(),
          },
        ]);
      }
      return;
    }
    transcriptRef.current = "";
    await voice.start();
    if (isTranscriptionSupported()) {
      stopTranscriptionRef.current = startTranscription((finalText, interimText) => {
        transcriptRef.current = finalText || interimText;
      });
    }
  }, [isLoading, voice, runGicTurn]);

  useEffect(() => {
    if (voice.error) setVoiceError(voice.error);
  }, [voice.error]);

  useEffect(
    () => () => {
      stopTranscriptionRef.current?.();
    },
    [],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    gicStatus,
    gicState: gic.status,
    voiceError,
    isRecording: voice.isRecording,
    recordingMs: voice.elapsedMs,
    handleMicToggle,
    messagesEndRef,
    inputRef,
    handleSend,
    handleKeyDown,
  };
}
