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

test("a Prisma schema with several enum values on one line is flagged before prisma generate fails on it", () => {
  const bad = 'generator client { provider = "prisma-client-js" }\ndatasource db { provider = "postgresql" url = env("DATABASE_URL") }\nenum Role { BUYER PRIVATE_SELLER DEALER ADMIN }\nenum Status {\n  DRAFT\n  ACTIVE\n}\nmodel User { id String @id }';
  const issues = auditProject({ kind: "app", html: "", files: [{ path: "/prisma/schema.prisma", content: bad }] }).issues.filter(i => i.area === "Code");
  assert.equal(issues.length, 1); assert.match(issues[0].message, /enum values must be one per line \(1 enum/);
  const good = 'generator client {\n  provider = "prisma-client-js"\n}\ndatasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\nenum Role {\n  BUYER\n  PRIVATE_SELLER @map("private_seller")\n  ADMIN\n}\nmodel User {\n  id String @id\n}';
  assert.equal(auditProject({ kind: "app", html: "", files: [{ path: "/prisma/schema.prisma", content: good }] }).issues.filter(i => i.area === "Code").length, 0);
  assert.match(auditProject({ kind: "app", html: "", files: [{ path: "/prisma/schema.prisma", content: "model User {\n  id String @id\n}" }] }).issues.find(i => i.area === "Code")!.message, /datasource and a generator/);
});
