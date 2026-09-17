/**
 * GIC chat protocol types — owned by this mini app.
 *
 * Session + SSE event shapes for the chat backend this app talks to
 * (via generic `api.request`: unary init, `stream: true` streaming).
 * The shared SDK/Host layers stay backend-agnostic and never import these.
 */
export interface GicChatSession {
  status?: string;
  user_id: string;
  session_id: string;
}

export interface GicChatStreamRequest {
  user_id: string;
  session_id: string;
  message: string;
}

export type GicChatEventType =
  | "tool_call"
  | "tool_result"
  | "keep_alive"
  | "token"
  | "meta"
  | "audio"
  | "done"
  | "error";

export interface GicChatEventBase {
  type: GicChatEventType | string;
  [key: string]: unknown;
}

export interface GicChatToolCallEvent extends GicChatEventBase {
  type: "tool_call";
}

export interface GicChatToolResultEvent extends GicChatEventBase {
  type: "tool_result";
}

export interface GicChatKeepAliveEvent extends GicChatEventBase {
  type: "keep_alive";
}

export interface GicChatTokenEvent extends GicChatEventBase {
  type: "token";
  text: string;
  /** Additive — e.g. citations, reasoning */
  [key: string]: unknown;
}

export interface GicChatMetaEvent extends GicChatEventBase {
  type: "meta";
  invocation_id: string;
  [key: string]: unknown;
}

export interface GicChatAudioEvent extends GicChatEventBase {
  type: "audio";
  url?: string;
  data?: string;
  mimeType?: string;
  [key: string]: unknown;
}

export interface GicChatDoneEvent extends GicChatEventBase {
  type: "done";
}

export interface GicChatErrorEvent extends GicChatEventBase {
  type: "error";
  detail: string;
  [key: string]: unknown;
}

/** Unknown future event — open union keeps the app forward-compatible */
export interface GicChatUnknownEvent extends GicChatEventBase {
  type: string;
}

export type GicChatKnownEvent =
  | GicChatToolCallEvent
  | GicChatToolResultEvent
  | GicChatKeepAliveEvent
  | GicChatTokenEvent
  | GicChatMetaEvent
  | GicChatAudioEvent
  | GicChatDoneEvent
  | GicChatErrorEvent;

export type GicChatEvent = GicChatKnownEvent | GicChatUnknownEvent;
