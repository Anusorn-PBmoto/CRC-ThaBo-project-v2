/**
 * Robust JSON utilities that prevent "Converting circular structure to JSON"
 * and handle non-serializable types gracefully.
 */

export function safeStringify(obj: any, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      // Strip functions, symbols, and DOM nodes / React elements
      if (
        typeof value === 'function' ||
        typeof value === 'symbol' ||
        (value && typeof value === 'object' && typeof value.nodeType === 'number') ||
        (value && typeof value === 'object' && value.$$typeof) // React element
      ) {
        return undefined;
      }
      return value;
    },
    space
  );
}

export function safeParse<T = any>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('safeParse failed to parse JSON:', err);
    return fallback;
  }
}
