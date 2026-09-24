import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyHtmlEdits } from '../src/lib/ai/html-edits';
const original = '<!doctype html><html><head><title>KIKO</title></head><body><main>Decision wheel</main><script>window.spin=()=>42;</script></body></html>';
const output = (edits: unknown) => `<<<HTML_EDITS>>>${JSON.stringify(edits)}<<<END HTML_EDITS>>>`;
test('component insertion preserves unrelated source and literal JavaScript replacement tokens', () => {
  const html = applyHtmlEdits(output([{search:'</head>',replace:'<style>.eclipse{color:gold}</style></head>'},{search:'</main>',replace:'<section>Solar eclipse $& $`</section></main>'}]), original);
  assert.match(html, /<title>KIKO<\/title>/);
  assert.ok(html.includes('<section>Solar eclipse $& $`</section>'));
  assert.ok(html.includes('<script>window.spin=()=>42;</script>'));
});
test('mismatched, ambiguous, overlapping, empty and incomplete edits are rejected', () => {
  for (const edits of [[],[{search:'absent',replace:'x'}],[{search:'<',replace:'x'}],[{search:'',replace:'x'}],[{search:'</body></html>',replace:''}],[{search:'</body></html>',replace:'</body></html>'}],[{search:'</body></html>',replace:'x'},{search:'</html>',replace:'y'}]]) assert.throws(()=>applyHtmlEdits(output(edits),original));
  assert.throws(()=>applyHtmlEdits('<<<HTML_EDITS>>>[{"search":',original));
});
