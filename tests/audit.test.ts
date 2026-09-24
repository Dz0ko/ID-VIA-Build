import assert from "node:assert/strict";
import { test } from "node:test";
import { auditProject, auditSummary } from "../src/lib/audit";

test("app audit does not manufacture eleven HTML errors from an unused empty document", () => {
  const result = auditProject({ kind: "app", html: "", files: [{ path: "/package.json", content: '{"scripts":{"dev":"next dev"},"dependencies":{"next":"15"}}' }, { path: "/app/page.tsx", content: "export default function Page() { return <main><h1>Hello</h1></main> }" }] });
  assert.equal(result.scope, "source");
  assert.deepEqual(result.issues, []);
  assert.match(auditSummary(result), /still require validation/);
});
test("app source findings identify files and disappear only when the source changes", () => {
  const project = { kind: "app", html: "", files: [{ path: "/app/layout.tsx", content: '<html><img src="a.png" /></html>' }] };
  assert.equal(auditProject(project).issues.filter(i => i.area !== "Runtime").length, 2);
  project.files[0].content = '<html lang="en"><img src="a.png" alt="" /></html>';
  assert.equal(auditProject(project).issues.filter(i => i.area !== "Runtime").length, 0);
});
test("website checks still retain real missing-document findings", () => {
  const result = auditProject({ kind: "website", html: "", files: [] });
  assert.equal(result.scope, "html");
  assert.ok(result.issues.some(i => i.message.includes("<title>")));
});
