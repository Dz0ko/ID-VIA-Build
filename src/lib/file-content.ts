/** Binary assets share the existing project-file storage without losing their bytes. */
export const BINARY_PREFIX = "IDAEVIA_BINARY_V1:";
export function fileBytes(content: string): Buffer {
  return content.startsWith(BINARY_PREFIX) ? Buffer.from(content.slice(BINARY_PREFIX.length), "base64") : Buffer.from(content, "utf8");
}
