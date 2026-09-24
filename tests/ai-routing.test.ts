import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTask, preferredProviderForTask, requiresFrontierDesign, tierForTask } from "../src/lib/ai/task-routing";
import { pickAgent } from "../src/lib/agents";
import type { ToolTurn } from "../src/lib/ai/provider";

test("whole marketplace briefs outrank incidental copy, image and animation keywords", () => {
  const brief = "Makeup Marketplace: Design Direction\nStructure\nNavbar: categories, search, cart\nHero: headline and search bar\nCategory grid with hover zoom images\nBest sellers carousel\nTestimonials with photos\nNewsletter and footer";
  assert.equal(pickAgent(brief, true), "builder");
  assert.equal(pickAgent(`the project is different its need to be like this\n${brief}`, true), "builder");
  assert.equal(classifyTask(brief, true), "feature");
  assert.equal(pickAgent("Rewrite the headline text", true), "copywriter");
  assert.equal(pickAgent("Rewrite the copy only\n" + brief, true), "copywriter");
  assert.equal(pickAgent("Fix the broken checkout", true), "debugger");
});

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

test("a new overall look is a whole-document restyle, a named target stays a targeted edit", async () => {
  const { requestsVisualOverhaul } = await import("../src/lib/ai/request-intent");
  for (const request of ["change the design to more moderen and proffesional", "make it more modern", "Make the site look better", "redesign", "the design looks outdated", "improve the overall design", "смени го дизајнот да биде помодерен", "podobar dizajn"]) {
    assert.equal(requestsVisualOverhaul(request), true, request);
    assert.equal(classifyTask(request, true), "page", request);
    assert.equal(pickAgent(request, true), request === "podobar dizajn" || request.startsWith("смени") ? "builder" : "designer", request);
  }
  for (const request of ["the navbar is so big make it simple make good design", "redesign the navbar", "change the button color to blue", "make the hero more modern", "change only the logo", "Rebuild the whole website as a modern SaaS", "how do I make the design more modern?"]) {
    assert.equal(requestsVisualOverhaul(request), false, request);
  }
  assert.equal(classifyTask("change the button color to blue", true), "tiny");
});

test("the request output limit leaves room for thinking on reasoning models", async () => {
  const { outputTokenLimit, modelMaxOutput } = await import("../src/lib/ai/output-limit");
  assert.equal(outputTokenLimit("claude-fable-5-1", 32000, "xhigh", true), 96000);
  assert.equal(outputTokenLimit("claude-fable-5-1", 64000, "max", true), 128000);
  assert.equal(outputTokenLimit("claude-sonnet-5", 32000, "high", true), 64000);
  assert.equal(outputTokenLimit("claude-haiku-4-5", 16000, undefined, false), 16000);
  assert.equal(outputTokenLimit("gpt-6-astra", 32000, "high", true), 64000);
  assert.equal(outputTokenLimit("gpt-4.1", 32000, undefined, false), 16000);
  assert.equal(modelMaxOutput("claude-opus-5"), 128000);
});

test("quality mode replies and recommendations", async () => {
  const { parseQualityReply, recommendedQuality, qualityChoices, qualityQuestion } = await import("../src/lib/ai/quality");
  for (const [text, mode] of [["QUALITY CHOICE: xhigh", "xhigh"], ["best quality", "xhigh"], ["Best", "xhigh"], ["QUALITY CHOICE: high", "high"], ["balanced", "high"], ["switch to balanced quality", "high"], ["HTML + CSS + JavaScript", null], ["make the navbar high", null], ["high contrast buttons", null]] as const) assert.equal(parseQualityReply(text), mode, text);
  assert.equal(recommendedQuality("feature", "website"), "xhigh"); assert.equal(recommendedQuality("page", "saas"), "xhigh"); assert.equal(recommendedQuality("page", "website"), "high");
  const choices = qualityChoices({ high: 354, xhigh: 718 }, "high");
  assert.equal(choices.find(c => c.recommended)!.id, "high");
  const question = qualityQuestion("HTML + CSS + JavaScript", choices);
  assert.match(question, /718 credits/); assert.match(question, /354 credits/); assert.match(question, /Balanced \(recommended\)/);
});

test("navbar requests select the visual design path even without a design adjective", () => {
  for (const request of ['add a navbar', 'improve the navigation', 'create a header', 'build a hero']) {
    assert.equal(requiresFrontierDesign(request, 'builder'), true);
    assert.equal(preferredProviderForTask(request, 'builder', true), 'anthropic');
  }
});

test('all library attachment prompts route to Builder despite incidental specialist keywords', async () => {
  const { SELECTABLE_COMPONENTS, componentImplementationPrompt } = await import('../src/lib/component-selection');
  for (const component of SELECTABLE_COMPONENTS) {
    assert.equal(pickAgent(componentImplementationPrompt('add this component to the landing page', [component.id]), true), 'builder', component.id);
  }
  assert.equal(pickAgent('Improve keyboard accessibility and screen reader support', true), 'accessibility');
});

test("OpenAI tool turns continue the previous response by id and replay the transcript after a provider switch", async () => {
  const { openaiResponsesInput } = await import("../src/lib/ai/provider");
  const user: ToolTurn = { role: "user", content: "rename it" };
  const assistant: ToolTurn = { role: "assistant", content: "", toolCalls: [{ id: "call_1", name: "search", input: { query: "Willow" } }], raw: { provider: "openai", content: { responseId: "resp_1" } } };
  const results: ToolTurn = { role: "tool", results: [{ id: "call_1", name: "search", output: "2 matches" }] };
  const chained = openaiResponsesInput([user, assistant, results]);
  assert.equal(chained.previous, "resp_1");
  assert.deepEqual(chained.input, [{ type: "function_call_output", call_id: "call_1", output: "2 matches" }]);
  const fromClaude: ToolTurn = { role: "assistant", content: "", toolCalls: assistant.role === "assistant" ? assistant.toolCalls : [], raw: { provider: "anthropic", content: [] } };
  const switched = openaiResponsesInput([user, fromClaude, results]);
  assert.equal(switched.previous, undefined);
  assert.deepEqual(switched.input.map(i => ("type" in i && i.type ? i.type : "role" in i ? i.role : "?")), ["user", "function_call", "function_call_output"]);
});
