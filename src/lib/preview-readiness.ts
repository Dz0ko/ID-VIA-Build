/** API roots may require authentication or only expose named routes; host rejection is never ready. */
export function previewResponseReady(status: number) {
  return status >= 200 && status < 400 || status === 401 || status === 404;
}
