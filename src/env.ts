type EnvKey =
  | "VITE_START_CHAT_SESSION_ROUTE"
  | "VITE_CHAT_STREAM_ROUTE"

export function getEnv(key: EnvKey): string {
  const value = import.meta.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}