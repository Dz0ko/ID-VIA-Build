import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Script } from 'node:vm';
import { COMPONENT_EXAMPLES, COMPONENT_SOURCES, componentReference } from '../src/lib/component-examples';

test('all categories have original self-contained, executable examples', () => {
  assert.equal(COMPONENT_EXAMPLES.length, 44);
  assert.equal(new Set(COMPONENT_EXAMPLES.map((x) => x.id)).size, 44);
  for (const source of COMPONENT_SOURCES) assert.ok(COMPONENT_EXAMPLES.some((x) => x.source === source.id));
  for (const item of COMPONENT_EXAMPLES) {
    assert.match(item.html, /^<!doctype html>/);
    assert.match(item.html, /prefers-reduced-motion/);
    assert.match(item.html, /Content-Security-Policy/);
    assert.doesNotMatch(item.html, /<script[^>]+src=|https?:\/\//);
    for (const [, js] of item.html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new Script(js), item.id);
    assert.ok(item.prompt.length < 500, item.id);
    assert.ok(componentReference(item.prompt).includes(item.html), item.id);
  }
});

test('component handoff only resolves known IDs and bounds attached examples', () => {
  assert.equal(componentReference('[COMPONENT:missing]'), '');
  assert.equal(componentReference('ordinary prompt'), '');
  const prompt = COMPONENT_EXAMPLES.map((x) => x.prompt).join('\n');
  assert.equal((componentReference(prompt).match(/COMPONENT REFERENCE:/g) ?? []).length, 3);
  assert.equal((componentReference('[COMPONENT:orb-aurora] [COMPONENT:orb-aurora]').match(/COMPONENT REFERENCE:/g) ?? []).length, 1);
});
