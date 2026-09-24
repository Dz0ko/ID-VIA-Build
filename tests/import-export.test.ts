import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { readZip, fetchUrlOutline, fetchGithubArchive, boundedResponse } from '../src/lib/import';
import { fileBytes } from '../src/lib/file-content';
import { downloadName } from '../src/lib/download-name';
const archive = async (files: Record<string, string | Uint8Array>) => { const zip = new JSZip(); for (const [name, body] of Object.entries(files)) zip.file(name, body); return zip.generateAsync({ type: 'arraybuffer' }); };
test('ZIP retains native project paths, package metadata and binary assets, excludes credentials', async () => {
  const image = new Uint8Array([137, 80, 78, 71, 0, 1, 2]);
  const imported = await readZip(await archive({ 'repo/package.json': '{"dependencies":{"next":"1"}}', 'repo/src/app/page.tsx': 'export default function Page(){}', 'repo/public/logo.png': image, 'repo/.env': 'SECRET=never', 'repo/.env.example': 'TOKEN=', 'repo/node_modules/x.js': 'ignored' }));
  assert.equal(imported.html, null); assert.match(imported.stack, /Next/);
  assert.ok(imported.files.some(f => f.path === '/package.json'));
  assert.ok(imported.files.some(f => f.path === '/src/app/page.tsx'));
  assert.deepEqual([...fileBytes(imported.files.find(f => f.path === '/public/logo.png')!.content)], [...image]);
  assert.ok(!imported.files.some(f => f.path === '/.env')); assert.ok(imported.files.some(f => f.path === '/.env.example'));
});
test('static imports inline local styles, scripts and images and retain source for export', async () => {
  const result = await readZip(await archive({ 'site/index.html': '<html><head><link rel="stylesheet" href="css/style.css"></head><body><img src="logo.png"><script src="app.js"></script></body></html>', 'site/css/style.css': '.hero{background:url(../logo.png)}', 'site/app.js': 'window.fixture=true;', 'site/logo.png': new Uint8Array([1,2,3]) }));
  assert.match(result.html!, /<style>/); assert.match(result.html!, /window.fixture=true/); assert.match(result.html!, /data:image\/png;base64/);
  assert.equal(result.files.length, 4);
});
test('ZIP rejects unsafe paths, oversized decompression and invalid archives without silent truncation', async () => {
  await assert.rejects(readZip(await archive({ '../escape.txt': 'bad' })), /unsafe/);
  await assert.rejects(readZip(await archive({ 'large.txt': 'x'.repeat(500001) })), /500 KB/);
  await assert.rejects(readZip(new ArrayBuffer(8)), /readable ZIP/);
  await assert.rejects(boundedResponse(new Response('x'.repeat(50)), 20), /size/);
});
test('URL and GitHub inputs cannot target internal addresses or impersonate GitHub domains', async () => {
  for (const url of ['http://127.0.0.1', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'http://localhost', 'file:///etc/passwd']) await assert.rejects(fetchUrlOutline(url), /public/);
  await assert.rejects(fetchGithubArchive('https://github.com.evil.invalid/a/b'), /github/);
  assert.equal(downloadName('../My site.zip'), '-My site');
  assert.equal(downloadName(''), 'project');
});

test('editing imported projects preserves binary assets without exposing base64 to the model', async () => {
  const { buildAppUserPrompt, parseFileManifest } = await import('../src/lib/ai/prompts');
  const files = [{ path: '/logo.png', content: 'IDAEVIA_BINARY_V1:AQID' }, { path: '/main.py', content: 'print(1)' }];
  assert.doesNotMatch(buildAppUserPrompt({ files, request: 'update' }), /AQID/);
  assert.equal(parseFileManifest('<<<FILE /main.py>>>\nprint(2)\n<<<END>>>', files).find(f => f.path === '/logo.png')?.content, files[0].content);
  assert.throws(() => parseFileManifest('invalid response', files));
  assert.throws(() => parseFileManifest('<<<FILE /main.py>>>\nprint(2)\n<<<END>>>\n<<<FILE /unfinished.py>>>\nprint(', files));
  assert.throws(() => parseFileManifest('<<<FILE /../secret>>>\ninvalid\n<<<END>>>', files));
});
