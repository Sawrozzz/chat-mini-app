export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function ctor(): RecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  const impl = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | RecognitionCtor
    | undefined;
  return impl ?? null;
}

export function isTranscriptionSupported(): boolean {
  return ctor() !== null;
}

export function isSpeechOutputSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Live-transcribes mic audio into `onTranscript(final, interim)`. Returns a stop fn. */
export function startTranscription(
  onTranscript: (finalText: string, interimText: string) => void,
  lang = "en-US",
): () => void {
  const Impl = ctor();
  if (!Impl) return () => {};
  const rec = new Impl();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = true;
  let finals = "";
  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (!res) continue;
      if (res.isFinal) finals += res[0]?.transcript ?? "";
      else interim += res[0]?.transcript ?? "";
    }
    onTranscript(finals, interim);
  };
  rec.onerror = () => {};
  rec.onend = () => {};
  try {
    rec.start();
  } catch {
    /* already started */
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    try {
      rec.stop();
    } catch {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    }
  };
}

export function speak(text: string, onEnd?: () => void): () => void {
  if (!isSpeechOutputSupported()) {
    onEnd?.();
    return () => {};
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
  return () => {
    window.speechSynthesis.cancel();
    onEnd?.();
  };
}

export function stopSpeaking(): void {
  if (isSpeechOutputSupported()) window.speechSynthesis.cancel();
}
