
/** Normalizes a runtime-supplied path ("camera", "/camera") to a route path. */
export function toRoutePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}
