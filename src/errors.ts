/**
 * Shared error formatting for tool handlers.
 *
 * The Cosmic SDK can throw plain objects (e.g. `{ status, message, ... }`)
 * rather than `Error` instances, so the original `error instanceof Error
 * ? error.message : 'Unknown error'` pattern collapsed every non-Error
 * throw to a useless "Unknown error". This helper preserves the actual
 * detail and also logs the raw error so it shows up in CloudWatch.
 */
function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const message =
      typeof obj.message === 'string'
        ? obj.message
        : typeof obj.error === 'string'
          ? obj.error
          : undefined;
    const status = typeof obj.status === 'number' ? obj.status : undefined;
    if (message && status) return `${message} (status ${status})`;
    if (message) return message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function logRawError(error: unknown): void {
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
  try {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'tool_error',
        error: detail,
      }),
    );
  } catch {
    console.error('tool_error (unserializable)', error);
  }
}

export function formatToolError(error: unknown): string {
  logRawError(error);
  return extractMessage(error);
}

/**
 * Cosmic returns 404 from list endpoints when there are simply no matching
 * resources, not just when the bucket itself is missing. Treating that as a
 * tool error is wrong: an empty page is a valid result. Callers of list
 * tools should use this helper to distinguish "empty page" from real errors.
 */
export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const obj = error as Record<string, unknown>;
  if (obj.status === 404) return true;
  if (typeof obj.status === 'string' && obj.status === '404') return true;
  return false;
}
