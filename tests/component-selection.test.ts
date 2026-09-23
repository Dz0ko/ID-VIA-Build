import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentImplementationPrompt, selectedComponents } from '../src/lib/component-selection';
import { componentReference } from '../src/lib/component-examples';
import { COMPONENTS } from '../src/lib/library';
test('selection creates bounded deduplicated implementation prompts with real references', () => {
  const prompt = componentImplementationPrompt('Place it below the hero', ['glass-switch', 'glass-switch', COMPONENTS[0].id, 'unknown']);
  assert.equal(selectedComponents(prompt).length, 2);
  assert.match(prompt, /Place it below the hero/);
  assert.match(componentReference(prompt), /COMPONENT REFERENCE: Glass switch/);
  assert.ok(componentReference(prompt).includes(`COMPONENT REFERENCE: ${COMPONENTS[0].name}`));
  assert.equal(componentImplementationPrompt('hello', []), 'hello');
});
