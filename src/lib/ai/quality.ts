/**
 * Quality mode for a project: how deeply the agents reason before writing. Chosen once when a project
 * is first built (after the technology choice), remembered in project memory, changeable in chat.
 */
export type QualityMode = "high" | "xhigh";

export type QualityChoice = { id: QualityMode; label: string; credits: number; minutes: string; detail: string; recommended: boolean };

export const DEFAULT_QUALITY: QualityMode = "high";

/** "QUALITY CHOICE: xhigh", "best quality", "balanced" … → mode; anything else → null. */
export function parseQualityReply(request: string): QualityMode | null {
  const text = request.trim().replace(/^QUALITY CHOICE:\s*/i, "").replace(/[.!]+$/, "").trim().toLowerCase();
  if (/^(?:xhigh|best(?:\s+quality)?|deep(?:\s+reasoning)?|highest(?:\s+quality)?|(?:use |switch to )?best quality(?: mode)?)$/.test(text)) return "xhigh";
  if (/^(?:high|balanced(?:\s+quality)?|standard(?:\s+quality)?|(?:use |switch to )?balanced(?: quality)?(?: mode)?)$/.test(text)) return "high";
  return null;
}

/** A product people will pay for deserves the deepest pass; a landing page or first draft does not need it. */
export function recommendedQuality(taskClass: string, kind: string): QualityMode {
  return taskClass === "feature" || taskClass === "fullstack" || ["saas", "dashboard", "app"].includes(kind) ? "xhigh" : "high";
}

export function qualityChoices(credits: { high: number; xhigh: number }, recommended: QualityMode): QualityChoice[] {
  return [
    { id: "xhigh", label: "Best quality", credits: credits.xhigh, minutes: "8–12 min", recommended: recommended === "xhigh", detail: "The agents reason much longer about structure, copy, states and edge cases before writing. Choose this for a product you will launch to customers." },
    { id: "high", label: "Balanced", credits: credits.high, minutes: "4–7 min", recommended: recommended === "high", detail: "Same design system, same checks, shorter reasoning: about half the credits. Right for landing pages, first drafts and quick iterations." },
  ];
}

export function qualityQuestion(stack: string, choices: QualityChoice[]): string {
  const rec = choices.find(c => c.recommended)!;
  const lines = choices.map(c => `• ${c.label}${c.recommended ? " (recommended)" : ""} — about ${c.credits} credits, ${c.minutes} for the first version. ${c.detail}`);
  return `Technology: ${stack}. One more choice before I build: how deeply should the agents work on this project?\n\n${lines.join("\n")}\n\nThe difference is reasoning time: the model plans more and checks more before it writes, which costs more tokens. ${rec.label} is recommended here. The choice is saved for this project and also applies to later restyles and new sections; change it any time by writing “best quality” or “balanced quality”.`;
}
