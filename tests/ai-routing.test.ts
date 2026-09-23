import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTask, tierForTask } from "../src/lib/ai/task-routing";

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
