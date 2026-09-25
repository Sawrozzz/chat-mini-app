/**
 * Positional `sdk.api.request("POST", { ... })` — the primary network call.
 *
 * The bundled SDK types still declare older shapes, so calls go through
 * this helper (typed against the current SDK contract) until the published
 * types package catches up.
 */
export interface ApiParams {
  path?: string;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
  stream?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: { uploadedBytes: number; totalBytes?: number }) => void;
}

export interface ApiResult<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

type RequestFn = {
  (method: string, params: ApiParams & { stream: true }): Promise<unknown>;
  (method?: string, params?: ApiParams): Promise<ApiResult<unknown>>;
};

export function apiRequest(
  sdk: SewaPlatformSdk,
  method: string | undefined,
  params: ApiParams,
): Promise<unknown> {
  // Call with the instance as receiver — module methods read instance
  // state, so a detached reference would throw.
  const request = sdk.api.request as unknown as RequestFn;
  return request.call(sdk.api, method, params) as Promise<unknown>;
}
