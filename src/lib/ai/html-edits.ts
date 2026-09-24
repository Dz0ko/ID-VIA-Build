/** Small additions should not require reproducing an entire working website. */
export const HTML_EDITS_SYSTEM = `
OUTPUT FORMAT OVERRIDE FOR THIS EXISTING WEBSITE:
Implement only the latest requested change using exact, targeted HTML edits, not a full document rewrite. Find the existing text, logo, image, component or behavior in CURRENT DOCUMENT and edit only that target and strictly necessary dependencies. A small text change must not redesign the page, change other copy or replace its images.
Return <<<HTML_EDITS>>> followed by a JSON array of {"search":"exact existing source","replace":"replacement source"}, then <<<END HTML_EDITS>>>.
Each search must be nonempty and occur exactly once in CURRENT DOCUMENT. Include enough surrounding source to make it unique. Edits are matched against the ORIGINAL document and must not overlap. To insert before </body> or </head>, include that closing tag in both search and replacement. Keep unrelated code, branding, content and working interactions unchanged. JSON-escape quotes and newlines correctly. Never use placeholders, ellipses or omitted code inside replacements. Include the complete component styles, markup and behavior, adapted to the requested placement, scoped to avoid affecting existing UI. Respect reduced motion, responsiveness and keyboard access.
After the edit block, return <<<NOTE>>> a short explanation of the implemented change <<<END NOTE>>>.
This format supersedes earlier instructions to return the full HTML. If the requested target or replacement is genuinely ambiguous, return <<<ANSWER>>> one focused question <<<END_ANSWER>>> without any edits. Otherwise implement the request.`;

export function applyHtmlEdits(text: string, original: string): string {
  const match = text.trim().match(/^<<<HTML_EDITS>>>\s*([\s\S]*?)\s*<<<END HTML_EDITS>>>(?:\s*<<<NOTE>>>[\s\S]*?<<<END NOTE>>>)?\s*$/);
  if (!match) throw new Error("Model did not return complete HTML edits.");
  let edits: unknown;
  try { edits = JSON.parse(match[1]); } catch { throw new Error("Model did not return valid HTML edits."); }
  if (!Array.isArray(edits) || !edits.length || edits.length > 40) throw new Error("Model did not return a bounded set of HTML edits.");
  const html = applyExactEdits(edits, original);
  if (html === original || html.length > 2_000_000 || !/<html[\s>]/i.test(html) || !/<\/html\s*>/i.test(html)) throw new Error("Model did not return a complete changed HTML document.");
  return html;
}

/** Every match is checked against the same original; nothing is partially applied. */
export function applyExactEdits(edits: unknown, original: string): string {
  if (!Array.isArray(edits) || !edits.length || edits.length > 100) throw new Error("Model did not return a bounded set of source edits.");
  const replacements = edits.flatMap((edit: unknown) => {
    if (!edit || typeof edit !== "object" || !("search" in edit) || !("replace" in edit) || typeof edit.search !== "string" || typeof edit.replace !== "string" || !edit.search.length) throw new Error("Model did not return valid HTML edit fields.");
    if (edit.search.length > 2000 && edit.search.length > original.length * .6) throw new Error("Model did not return targeted edits: split the change into small exact matches instead of replacing most of a file.");
    const search: string = edit.search, replacement: string = edit.replace;
    const snippet = search.length > 60 ? `${search.slice(0, 57)}…` : search;
    const starts: number[] = [];
    for (let at = original.indexOf(search); at !== -1; at = original.indexOf(search, at + search.length)) starts.push(at);
    if (!starts.length) throw new Error(`Model did not return matching edits: ${JSON.stringify(snippet)} does not occur in the original file; copy the exact original text.`);
    // "all": true replaces every occurrence in the file (a rename); otherwise the match must be unique.
    const all = "all" in edit && edit.all === true;
    if (starts.length > 1 && !all) throw new Error(`Model did not return uniquely matching edits: ${JSON.stringify(snippet)} occurs ${starts.length} times in the file; include more surrounding context, or set "all": true to replace every occurrence.`);
    return (all ? starts : [starts[0]]).map(start => ({ start, end: start + search.length, replacement }));
  }).sort((a, b) => a.start - b.start);
  for (let i = 1; i < replacements.length; i++) if (replacements[i].start < replacements[i - 1].end) throw new Error("Model did not return non-overlapping HTML edits.");
  let html = original;
  for (const edit of replacements.reverse()) html = html.slice(0, edit.start) + edit.replacement + html.slice(edit.end);
  if (html === original) throw new Error("Model did not return a changed source file.");
  return html;
}
