import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTask, requiresFrontierDesign, tierForTask } from "../src/lib/ai/task-routing";

test("visual design work always requests the frontier tier", () => {
  assert.equal(requiresFrontierDesign("change the button hover animation", "builder"), true);
  assert.equal(requiresFrontierDesign("make the layout more premium", "builder"), true);
  assert.equal(requiresFrontierDesign("rewrite the legal copy", "copywriter"), false);
  assert.equal(requiresFrontierDesign("anything", "animation"), true);
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
