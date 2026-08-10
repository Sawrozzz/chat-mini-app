export async function retry<T>(
  fn: () => T | Promise<T>,
  options: { maxAttempts: number; delayMs: number; signal?: AbortSignal }
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < options.maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, options.delayMs));
      }
    }
  }
  throw lastError;
}
