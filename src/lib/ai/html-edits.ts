/** Small additions should not require reproducing an entire working website. */
export const HTML_EDITS_SYSTEM = `
OUTPUT FORMAT OVERRIDE FOR THIS EXISTING WEBSITE:
Implement the selected components using exact, targeted HTML edits, not a full document rewrite.
Return <<<HTML_EDITS>>> followed by a JSON array of {"search":"exact existing source","replace":"replacement source"}, then <<<END HTML_EDITS>>>.
Each search must be nonempty and occur exactly once in CURRENT DOCUMENT. Include enough surrounding source to make it unique. Edits are matched against the ORIGINAL document and must not overlap. To insert before </body> or </head>, include that closing tag in both search and replacement. Keep unrelated code, branding, content and working interactions unchanged. JSON-escape quotes and newlines correctly. Never use placeholders, ellipses or omitted code inside replacements. Include the complete component styles, markup and behavior, adapted to the requested placement, scoped to avoid affecting existing UI. Respect reduced motion, responsiveness and keyboard access.
After the edit block, return <<<NOTE>>> a short explanation of the implemented change <<<END NOTE>>>.
This format supersedes earlier instructions to return the full HTML. Do not return an answer instead of implementing the component.`;

export function applyHtmlEdits(text: string, original: string): string {
  const match = text.trim().match(/^<<<HTML_EDITS>>>\s*([\s\S]*?)\s*<<<END HTML_EDITS>>>(?:\s*<<<NOTE>>>[\s\S]*?<<<END NOTE>>>)?\s*$/);
  if (!match) throw new Error("Model did not return complete HTML edits.");
  let edits: unknown;
  try { edits = JSON.parse(match[1]); } catch { throw new Error("Model did not return valid HTML edits."); }
  if (!Array.isArray(edits) || !edits.length || edits.length > 40) throw new Error("Model did not return a bounded set of HTML edits.");
  const replacements = edits.map((edit: unknown) => {
    if (!edit || typeof edit !== "object" || !("search" in edit) || !("replace" in edit) || typeof edit.search !== "string" || typeof edit.replace !== "string" || !edit.search.length) throw new Error("Model did not return valid HTML edit fields.");
    const start = original.indexOf(edit.search);
    if (start < 0 || original.indexOf(edit.search, start + 1) !== -1) throw new Error("Model did not return uniquely matching HTML edits.");
    return { start, end: start + edit.search.length, replacement: edit.replace };
  }).sort((a, b) => a.start - b.start);
  for (let i = 1; i < replacements.length; i++) if (replacements[i].start < replacements[i - 1].end) throw new Error("Model did not return non-overlapping HTML edits.");
  let html = original;
  for (const edit of replacements.reverse()) html = html.slice(0, edit.start) + edit.replacement + html.slice(edit.end);
  if (html === original || html.length > 2_000_000 || !/^\s*<!doctype html[\s>]/i.test(html) || !/<html[\s>]/i.test(html) || !/<\/body\s*>\s*<\/html\s*>\s*$/i.test(html)) throw new Error("Model did not return a complete changed HTML document.");
  return html;
}
