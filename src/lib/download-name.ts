export function downloadName(input: string) {
  return input.trim().replace(/\.zip$/i, "").normalize("NFKC").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/^[.\s]+|[.\s]+$/g, "").slice(0, 80) || "project";
}
