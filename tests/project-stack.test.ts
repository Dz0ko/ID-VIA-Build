import assert from "node:assert/strict";
import { test } from "node:test";
import { detectProjectStack, recommendedProjectStack, requestedStackName, resolveRequestedStack, isStaticStack, isReactSandboxStack, stackQuestion } from "../src/lib/project-stack";

test("detects common stacks and recommends by product type", () => {
  assert.equal(detectProjectStack("Build a Java Spring Boot API"), "java-spring");
  assert.equal(detectProjectStack("Create a React dashboard"), "react-ts");
  assert.equal(recommendedProjectStack("Build an AI data API", "app").id, "python-fastapi");
  assert.equal(recommendedProjectStack("Build a marketing landing page", "website").id, "html-css-js");
});

test("accepts custom languages from a stack answer", () => {
  assert.equal(requestedStackName("Build a compiler in C++"), "C++");
  assert.equal(requestedStackName("original request\nSTACK CHOICE: Scala"), "Scala");
});


test("explicit selection overrides technologies in the original request", () => {
  assert.equal(resolveRequestedStack("Build a React dashboard\nSTACK CHOICE: Java + Spring Boot", "app"), "Java + Spring Boot");
  assert.equal(resolveRequestedStack("Build a Java service\nSTACK CHOICE: UnlistedLanguage", "website"), "UnlistedLanguage");
  assert.equal(requestedStackName("Build a service\nLANGUAGE: Crystal"), "Crystal");
});

test("mixed frontend, backend and database choices survive resolution", () => {
  const stack = requestedStackName("Build a React app with Java Spring Boot and PostgreSQL")!;
  assert.match(stack, /React/);
  assert.match(stack, /Java/);
  assert.match(stack, /PostgreSQL/);
  assert.equal(isReactSandboxStack(stack), false);
  assert.equal(isStaticStack(stack), false);
  assert.equal(isStaticStack("HTML + CSS + JavaScript + Java"), false);
});

test("recommended reply resolves to a full-stack SaaS choice", () => {
  const stack = resolveRequestedStack("Build a SaaS subscription platform\nSTACK CHOICE: use recommended", "website");
  assert.equal(stack, "Next.js + TypeScript + PostgreSQL");
  assert.match(stackQuestion("Build a SaaS", "website"), /PostgreSQL/);
  assert.equal(resolveRequestedStack("Build a landing page\nSTACK CHOICE: recommended", "website"), "HTML + CSS + JavaScript");
});

test("ordinary language is not a Go selection and punctuation languages are recognized", () => {
  assert.equal(requestedStackName("Make the website go live"), null);
  assert.equal(detectProjectStack("Build an API in Go"), "go");
  assert.equal(detectProjectStack("Use C#"), "dotnet");
  assert.equal(detectProjectStack("Use .NET"), "dotnet");
  assert.equal(requestedStackName("Build a Vue app"), "Vue + TypeScript");
  assert.equal(requestedStackName("Build a Svelte app"), "Svelte + TypeScript");
});

test("sandbox and static modes only apply to standalone frontend stacks", () => {
  assert.equal(isReactSandboxStack("React + TypeScript"), true);
  assert.equal(isReactSandboxStack("React + Python + PostgreSQL"), false);
  assert.equal(isReactSandboxStack("Next.js + TypeScript"), false);
  assert.equal(isStaticStack("HTML + CSS + JavaScript"), true);
  assert.equal(isStaticStack("Elixir"), false);
});


test("project paths support framework routes while rejecting traversal", async () => {
  const { safeProjectPath } = await import('../src/lib/import');
  for (const path of ['/app/(dashboard)/[id]/page.tsx', '/src/routes/+page.svelte', '/app/@modal/default.tsx']) assert.equal(safeProjectPath(path), path);
  for (const path of ['/../secret', '/src/../../secret', '/src/file\u0000.ts', '/C:/secret']) assert.equal(safeProjectPath(path), null);
});
