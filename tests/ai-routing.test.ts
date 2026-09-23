import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTask, preferredProviderForTask, requiresFrontierDesign, tierForTask } from "../src/lib/ai/task-routing";

test("visual design work always requests the frontier tier", () => {
  assert.equal(requiresFrontierDesign("change the button hover animation", "builder"), true);
  assert.equal(requiresFrontierDesign("make the layout more premium", "builder"), true);
  assert.equal(requiresFrontierDesign("rewrite the legal copy", "copywriter"), false);
  assert.equal(requiresFrontierDesign("anything", "animation"), true);
});

test("automatic provider selection follows model strengths", () => {
  assert.equal(preferredProviderForTask("design a premium hero with button hover motion", "builder", false), "anthropic");
  assert.equal(preferredProviderForTask("add authentication and database tests", "builder", true), "openai");
  assert.equal(preferredProviderForTask("rewrite this short paragraph", "copywriter", false), undefined);
});

test("automatic routing reserves efficient tiers for simple work", () => {
  assert.equal(tierForTask(classifyTask("change the button colour", true), "AGENCY"), "fast");
  assert.equal(tierForTask(classifyTask("change the font", true), "AGENCY"), "fast");
  assert.equal(tierForTask(classifyTask("add a pricing section", true), "AGENCY"), "standard");
});

test("automatic routing uses the strongest permitted tier for substantial work", () => {
  assert.equal(tierForTask(classifyTask("build a new SaaS dashboard", false), "AGENCY"), "frontier");
  assert.equal(tierForTask(classifyTask("add authentication and a database", true), "MAX"), "frontier");
  assert.equal(tierForTask(classifyTask("build a new SaaS dashboard", false), "PRO"), "advanced");
  assert.equal(tierForTask(classifyTask("build a new SaaS dashboard", false), "FREE"), "standard");
});

test("navbar requests select the visual design path even without a design adjective", () => {
  for (const request of ['add a navbar', 'improve the navigation', 'create a header', 'build a hero']) {
    assert.equal(requiresFrontierDesign(request, 'builder'), true);
    assert.equal(preferredProviderForTask(request, 'builder', true), 'anthropic');
  }
});
