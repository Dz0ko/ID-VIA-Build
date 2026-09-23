import assert from "node:assert/strict";
import { test } from "node:test";
import { detectProjectStack, recommendedProjectStack, requestedStackName } from "../src/lib/project-stack";

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
