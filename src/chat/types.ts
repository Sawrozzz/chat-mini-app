export interface ChatMessage {
  id: string;
  role: "user" | "gicChat";
  content: string;
  timestamp?: Date;
  audioUrl?: string;
  audioMimeType?: string;
}
