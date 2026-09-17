import { useCallback, useEffect, useRef, useState } from "react";

export interface RecordedVoice {
  blob: Blob;
  url: string;
  mimeType: string;
  durationMs: number;
}

/**
 * Mic recorder via `MediaRecorder`. The audio stays local (object URL) —
 * transcription/output are handled client-side in `speech.ts`, so no host
 * STT service is required. Upload via `api.request` remains available if a
 * backend is ever configured.
 */
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((v: RecordedVoice | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    resolveRef.current = null;
    setIsRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (recorderRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        const durationMs = Date.now() - startedAtRef.current;
        resolveRef.current?.({
          blob,
          url,
          mimeType: type,
          durationMs,
        });
        cleanup();
      };
      recorder.onerror = () => {
        setError("Recording failed.");
        resolveRef.current?.(null);
        cleanup();
      };
      recorder.start(250);
      setElapsedMs(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission denied."
          : "Could not start recording.",
      );
    }
  }, [cleanup]);

  const stop = useCallback((): Promise<RecordedVoice | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanup();
      return Promise.resolve(null);
    }
    return new Promise<RecordedVoice | null>((resolve) => {
      resolveRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        resolve(null);
        cleanup();
      }
    });
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { isRecording, elapsedMs, error, start, stop };
}

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
